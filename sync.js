const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

// Lädt .env (AUTO_UPDATE, DISCORD_TOKEN, LOG_FILE …), damit sync.js dieselben
// Werte sieht wie der Bot. Sicherer Fallback, falls dotenv nicht installiert ist.
try {
  require('dotenv').config();
} catch (_) {}

const ROOT = path.resolve(__dirname);

// ---------------------------------------------------------------------------
// Boot-Logger: Erzeugt die Log-Datei SOFORT (synchron) und schreibt ab der
// allerersten Zeile hinein - unabhängig davon, ob der Sync oder die Erst-
// installation schon lief. So sind auch Crashs und der Zustand vor dem ersten
// Sync nachvollziehbar. Der Logger ist selbst-enthaltend (keine Abhängigkeit
// von src/logger.js), damit er immer funktioniert.
// ---------------------------------------------------------------------------

const LOG_ENV = String(process.env.LOG_FILE || 'logs/sync.log');
// Einzig erlaubter Zielpfad: immer unter ROOT (keine Pfad-Traversale).
const LOG_FILE = LOG_ENV.startsWith('/') || /^[A-Za-z]:[\\/]/.test(LOG_ENV)
  ? path.join(ROOT, '.logs', 'sync.log')
  : path.join(ROOT, LOG_ENV);

try {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
} catch (_) {}

function writeToFile(chunk) {
  try {
    fs.appendFileSync(LOG_FILE, chunk);
  } catch (_) {}
}

function safeString(v) {
  try {
    return v && v.stack ? v.stack : String(v);
  } catch (_) {
    return '<unprintable>';
  }
}

function emit(level, args) {
  const line = `[${new Date().toISOString()}] [${level}] ${args.map((a) => (typeof a === 'string' ? a : safeString(a))).join(' ')}`;
  writeToFile(line + '\n');
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

const logger = {
  info: (...a) => emit('INFO', a),
  warn: (...a) => emit('WARN', a),
  error: (...a) => emit('ERROR', a),
};

process.on('uncaughtException', (err) => {
  writeToFile(`[${new Date().toISOString()}] [FATAL] ${(err && err.stack) || err}\n`);
  console.error(`[FATAL] ${(err && err.stack) || err}`);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  writeToFile(`[${new Date().toISOString()}] [UNHANDLED] ${(reason && reason.stack) || reason}\n`);
  console.error(`[UNHANDLED] ${(reason && reason.stack) || reason}`);
});

const OWNER = 'teamluan';
const REPO = 'BWW';
const BRANCH = 'main';
const API = 'https://api.github.com';
const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/`;
const SHA_FILE = path.join(ROOT, '.deploy-sha');
const SKIP_DIRS = new Set(['.git', '.github', 'node_modules', 'logs', 'data', 'backups']);
const SKIP_FILES = new Set(['.env', '.env.local', '.deploy-sha', '.gitignore', 'sync.js', 'logs']);

const ENABLED = process.env.AUTO_UPDATE === 'true';
const INTERVAL_MS = Number(process.env.AUTO_UPDATE_INTERVAL_MS) || 120000;
const INTERVAL_S = Math.round(INTERVAL_MS / 1000);

function skipped(file) {
  const parts = file.split('/');
  return parts.some((s) => SKIP_DIRS.has(s)) || SKIP_FILES.has(parts[parts.length - 1]);
}

async function retry(fn, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

async function gh(route) {
  const r = await retry(async () => {
    const res = await fetch(`${API}${route}`, {
      headers: { 'User-Agent': 'bww-selfsync', Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const err = new Error(`GitHub-API ${res.status}: ${route}`);
      err.status = res.status;
      throw err;
    }
    return res;
  });
  return r.json();
}

async function fetchRaw(file) {
  const r = await retry(async () => {
    const encoded = file.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(RAW + encoded, {
      headers: { 'User-Agent': 'bww-selfsync' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Download ${res.status}: ${file}`);
    return res;
  });
  return Buffer.from(await r.arrayBuffer());
}

function writeLocal(file, buf) {
  const target = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buf);
}

function removeLocal(file) {
  try {
    fs.unlinkSync(path.join(ROOT, file));
  } catch (_) {}
}

function readSha() {
  try {
    return fs.readFileSync(SHA_FILE, 'utf8').trim();
  } catch (_) {
    return '';
  }
}

function writeSha(sha) {
  try {
    writeLocal('.deploy-sha', Buffer.from(sha));
  } catch (err) {
    logger.warn(`Auto-Update: SHA-Datei nicht schreibbar: ${err.message}`);
  }
}

function latestCommitSha() {
  return gh(`/repos/${OWNER}/${REPO}/commits/${BRANCH}`).then((c) => c.sha);
}

async function fullSync() {
  const sha = await latestCommitSha();
  const tree = await gh(`/repos/${OWNER}/${REPO}/git/trees/${sha}?recursive=1`);
  const files = (tree.tree || []).filter((e) => e.type === 'blob' && !skipped(e.path));
  for (const e of files) writeLocal(e.path, await fetchRaw(e.path));
  return { sha, count: files.length };
}

async function applyFile(f, touched, needsInstallRef) {
  if (f.filename === 'package.json' || f.filename === 'package-lock.json') needsInstallRef.value = true;
  if (f.status === 'removed') {
    removeLocal(f.filename);
    touched.push(`-${f.filename}`);
    return;
  }
  if (f.previous_filename && f.previous_filename !== f.filename) removeLocal(f.previous_filename);
  writeLocal(f.filename, await fetchRaw(f.filename));
  touched.push(`+${f.filename}`);
}

let busy = false;
let errorCount = 0;
let intervalHandle = null;
let botProcess = null;
let initializing = false;

const status = {
  enabled: false,
  checks: 0,
  lastCheckAt: null,
  lastResult: null,
  lastCount: 0,
  lastFiles: [],
  lastError: null,
  sha: readSha() || null,
};
function statusSnapshot() {
  return { ...status };
}

async function tick() {
  if (busy) return;
  busy = true;
  status.checks += 1;
  status.lastCheckAt = new Date().toISOString();
  try {
    let applied = 0;
    let needsInstall = false;
    let head = '';
    const base = readSha();
    if (!base) {
      const r = await fullSync();
      applied = r.count;
      head = r.sha;
      status.lastResult = 'installed';
      status.lastCount = applied;
      status.lastFiles = [`Erstinstallation: ${applied} Dateien`];
      status.sha = head;
      logger.info(`Auto-Update: Erstinstallation mit ${applied} Dateien (Commit ${head.slice(0, 7)}).`);
    } else {
      let cmp = null;
      try {
        cmp = await gh(`/repos/${OWNER}/${REPO}/compare/${base}...${BRANCH}`);
      } catch (err) {
        if (!/404/.test(String(err.message))) throw err;
        const r = await fullSync();
        applied = r.count;
        head = r.sha;
        status.lastResult = 'installed';
        status.lastCount = applied;
        status.lastFiles = [`Erstinstallation: ${applied} Dateien`];
        status.sha = head;
        logger.info(`Auto-Update: Basis unbekannt, Erstinstallation mit ${applied} Dateien (Commit ${head.slice(0, 7)}).`);
      }
      if (cmp) {
        if (!cmp.files || !cmp.files.length) {
          errorCount = 0;
          status.lastResult = 'up-to-date';
          status.lastCount = 0;
          status.lastFiles = [];
          status.lastError = null;
          status.sha = base;
          return;
        }
        const touched = [];
        const installRef = { value: false };
        for (const f of cmp.files) {
          if (skipped(f.filename)) continue;
          await applyFile(f, touched, installRef);
        }
        applied = touched.length;
        needsInstall = installRef.value;
        head = await latestCommitSha();
        if (!applied) {
          writeSha(head);
          status.lastResult = 'up-to-date';
          status.lastCount = 0;
          status.lastFiles = [];
          status.lastError = null;
          status.sha = head;
          return;
        }
        logger.info(`Auto-Update: ${applied} Datei(en) aktualisiert (${touched.join(', ')}, Commit ${head.slice(0, 7)}).`);
        status.lastResult = 'updated';
        status.lastCount = applied;
        status.lastFiles = touched;
        status.sha = head;
      }
    }
    writeSha(head);
    errorCount = 0;
    if (needsInstall) {
      logger.info('Auto-Update: package.json geändert – installiere Abhängigkeiten neu…');
      const res = spawnSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: ROOT, shell: true, stdio: 'inherit' });
      if (res.status !== 0) logger.warn(`Auto-Update: npm install beendet mit Code ${res.status}.`);
    }
    logger.info('Auto-Update: Starte neu, um die neue Version zu laden…');
    if (initializing) return;
    stopBot();
    setTimeout(() => process.exit(0), 1500).unref();
  } catch (err) {
    errorCount += 1;
    status.lastResult = 'error';
    status.lastError = err.message;
    logger.error(`Auto-Update fehlgeschlagen (${errorCount}): ${err.stack || err.message}`);
    if (errorCount >= 5) {
      logger.error('Auto-Update nach 5 Fehlern deaktiviert – bitte Logs prüfen.');
      if (intervalHandle) clearInterval(intervalHandle);
    }
  } finally {
    busy = false;
  }
}

function stopBot() {
  if (botProcess && !botProcess.killed) {
    logger.info('Stoppe Bot...');
    botProcess.kill('SIGTERM');
    botProcess = null;
  }
}

function startBot() {
  logger.info('Starte Bot (node src/index.js)...');
  botProcess = spawn('node', ['src/index.js'], {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const forward = (stream) => {
    if (!stream) return;
    stream.on('data', (buf) => {
      const text = buf.toString();
      writeToFile(text.endsWith('\n') ? text : text + '\n');
    });
  };
  forward(botProcess.stdout);
  forward(botProcess.stderr);
  botProcess.on('exit', (code, signal) => {
    logger.info(`Bot-Prozess beendet (code=${code}, signal=${signal})`);
    botProcess = null;
  });
  botProcess.on('error', (err) => {
    logger.error('Bot-Fehler:', err.message);
  });
}

async function start() {
  try {
    if (ENABLED) {
      status.enabled = true;
      logger.info(`Auto-Update aktiv – prüfe alle ${INTERVAL_S} Sekunden auf neue Commits.`);
      // Beim allerersten Start zuerst (Erst-)Installation, dann Bot starten.
      if (!readSha()) {
        initializing = true;
        logger.info('Nichts installiert – starte Erstinstallation...');
        await tick();
        initializing = false;
      }
    } else {
      logger.info('Auto-Update deaktiviert (AUTO_UPDATE != true).');
    }
  } catch (err) {
    logger.error('Initialer Auto-Update-Schritt fehlgeschlagen:', err && err.message ? err.message : err);
  }

  startBot();

  if (ENABLED) {
    intervalHandle = setInterval(() => tick().catch(() => {}), INTERVAL_MS);
  }
}

start();

module.exports = { tick, status: statusSnapshot };
