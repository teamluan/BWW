const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_URL = 'https://github.com/teamluan/BWW.git';
const BRANCH = 'main';
const POLL_MS = 2 * 60 * 1000; // alle 2 Minuten
const BOT_DIR = path.join(__dirname, 'bot');
const BACKUP_DIR = path.join(__dirname, 'backups');
const STATE_FILE = path.join(__dirname, '.synced');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const SKIP_BACKUP = new Set(['node_modules', 'bot', 'backups', '.git', '.synced']);

const SECURITY_PATTERNS = [
  { name: 'Hardcoded Discord-Token', re: /(?:[A-Za-z0-9]{24}\.[A-Za-z0-9_]{6}\.[A-Za-z0-9_-]{27,})/ },
  { name: 'eval / new Function', re: /\beval\s*\(|\bnew\s*Function\s*\(/ },
  { name: 'exec/spawn mit verkettetem Ausdruck', re: /(?:exec|spawn|execSync|spawnSync)\s*\(\s*[^'"`/]+[+]/ },
  { name: 'Hardcodiertes Secret', re: /\b(?:api[_-]?key|secret|password|passwd|client_secret)\s*[:=]\s*['"][^'"]{8,}/i },
  { name: 'Sk-API-Key', re: /\bsk-[A-Za-z0-9_-]{16,}/ },
];

let botProcess = null;

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function warn(...args) {
  console.warn(`[${new Date().toISOString()}]`, ...args);
}

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8' }).toString().trim();
}

function isFirstRun() {
  return !fs.existsSync(STATE_FILE);
}

function localSha() {
  try {
    return run('git', ['rev-parse', 'HEAD'], BOT_DIR);
  } catch {
    return null;
  }
}

function remoteSha() {
  try {
    return run('git', ['rev-parse', 'FETCH_HEAD'], BOT_DIR);
  } catch {
    return null;
  }
}

function walk(dir, base, out) {
  out = out || [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const rel = path.join(base, e.name);
    if (e.isDirectory()) {
      if (SKIP_BACKUP.has(e.name)) continue;
      walk(abs, rel, out);
    } else {
      out.push(rel);
    }
  }
  return out;
}

// FIRST RUN: kopiert alle bestehenden KataBump-Dateien (mit Ordnern) in ein
// Zeitstempel-Backup, damit bei einem Sync-Vorfall nichts verloren geht.
function backupExisting() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, stamp);
  const files = walk(__dirname, '.');
  if (files.length === 0) {
    log('Nichts zu sichern (keine Dateien in der App-Wurzel).');
  } else {
    log(`Sichere ${files.length} Datei(en) nach backups/${stamp} ...`);
    for (const rel of files) {
      const src = path.join(__dirname, rel);
      const dst = path.join(dest, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      try {
        fs.copyFileSync(src, dst);
      } catch (err) {
        warn('Backup übersprungen:', rel, err.message);
      }
    }
    log('Backup abgeschlossen.');
  }
  fs.writeFileSync(STATE_FILE, new Date().toISOString());
}

function ensureRepo() {
  if (!fs.existsSync(path.join(BOT_DIR, '.git'))) {
    log(`Repo nicht vorhanden -> klone ${REPO_URL}`);
    fs.mkdirSync(BOT_DIR, { recursive: true });
    run('git', ['clone', '--depth', '1', '--single-branch', '-b', BRANCH, REPO_URL, BOT_DIR], __dirname);
  }
}

function ensureDeps() {
  if (!fs.existsSync(path.join(BOT_DIR, 'node_modules'))) {
    log('Installiere Abhängigkeiten (npm install)...');
    run(npm, ['install'], BOT_DIR);
  }
}

// Sicherheits-Check: scannt Bot-Quellcode + lokale .env/config auf kritische Muster.
function securityCheck() {
  const targets = [];
  const scanRoot = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git' || e.name === 'backups') continue;
        scanRoot(path.join(dir, e.name));
      } else {
        if (/\.(js|ts|json|env|mjs|cjs)$/i.test(e.name)) {
          targets.push(path.join(dir, e.name));
        }
      }
    }
  };
  scanRoot(BOT_DIR);

  let findings = 0;
  for (const file of targets) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const p of SECURITY_PATTERNS) {
      const m = p.re.exec(content);
      if (m) {
        findings++;
        warn(`SICHERHEIT: ${p.name} in ${path.relative(__dirname, file)}`);
      }
    }
  }

  if (!process.env.DISCORD_TOKEN) {
    findings++;
    warn('SICHERHEIT: DISCORD_TOKEN ist nicht als Umgebungsvariable gesetzt.');
  }

  if (findings === 0) {
    log('Sicherheits-Check: keine kritischen Befunde.');
  } else {
    log(`Sicherheits-Check: ${findings} potenzielle Befunde geprüft — siehe Warnungen oben.`);
  }
}

function stopBot() {
  if (botProcess && !botProcess.killed) {
    log('Stoppe Bot...');
    botProcess.kill('SIGTERM');
    botProcess = null;
  }
}

function startBot() {
  log('Starte Bot (node src/index.js)...');
  botProcess = spawn('node', ['src/index.js'], {
    cwd: BOT_DIR,
    env: process.env,
    stdio: 'inherit',
  });
  botProcess.on('exit', (code, signal) => {
    log(`Bot-Prozess beendet (code=${code}, signal=${signal})`);
    botProcess = null;
  });
  botProcess.on('error', (err) => {
    log('Bot-Fehler:', err.message);
  });
}

async function poll() {
  await new Promise((r) => setTimeout(r, POLL_MS));
  try {
    const before = localSha();
    run('git', ['fetch', 'origin', BRANCH], BOT_DIR);
    const after = remoteSha();

    if (!before || before !== after) {
      log(`Neuer Commit erkannt: ${before} -> ${after}`);
      run('git', ['reset', '--hard', 'origin/' + BRANCH], BOT_DIR);
      run(npm, ['install', '--prefer-offline'], BOT_DIR);
      securityCheck();
      stopBot();
      startBot();
    } else {
      log('Kein neuer Commit. Warte 2 Minuten...');
    }
  } catch (err) {
    log('Sync-Fehler:', err && err.message ? err.message : err);
  }
}

(async () => {
  if (isFirstRun()) {
    log('Erster Start: erstelle Backup der bestehenden KataBump-Dateien...');
    backupExisting();
  }
  ensureRepo();
  ensureDeps();
  securityCheck();
  startBot();
  for (;;) {
    await poll();
  }
})();
