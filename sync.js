const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
try { require('dotenv').config(); } catch (_) {}
const ROOT = path.resolve(__dirname);
const LOG_ENV = String(process.env.LOG_FILE || 'logs/sync.log');
const LOG_FILE = LOG_ENV.startsWith('/') || /^[A-Za-z]:[\\/]/.test(LOG_ENV) ? path.join(ROOT, '.logs', 'sync.log') : path.join(ROOT, LOG_ENV);
try { fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true }); } catch (_) {}
const WEBHOOK_URL = String(process.env.LOG_WEBHOOK_URL || process.env.DISCORD_LOG_WEBHOOK || '').trim();
const WEBHOOK_LEVEL_RAW = String(process.env.LOG_WEBHOOK_LEVEL || 'warn').toLowerCase();
const WEBHOOK_LEVEL = ['error', 'warn', 'info'].includes(WEBHOOK_LEVEL_RAW) ? WEBHOOK_LEVEL_RAW : 'info';
let webhookQueue = Promise.resolve();
function shouldNotify(level) { const l = String(level).toLowerCase(); if (WEBHOOK_LEVEL === 'error') return ['error', 'fatal', 'unhandled'].includes(l); if (WEBHOOK_LEVEL === 'warn') return ['warn', 'error', 'fatal', 'unhandled'].includes(l); return true; }
function redactSecrets(str) { return String(str)
  .replace(/https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+/gi, '[WEBHOOK-REDACTED]')
  .replace(/(DISCORD_TOKEN|LOG_WEBHOOK_URL|DISCORD_LOG_WEBHOOK)\s*[=:]\s*\S+/gi, '$1=[REDACTED]')
  .replace(/Bot\s+[A-Za-z0-9._-]{40,}/g, 'Bot [TOKEN-REDACTED]'); }
function truncateForWebhook(str, max = 4000) { const safe = redactSecrets(str); if (safe.length <= max) return safe; return safe.slice(0, max - 20) + '\n… (gekürzt)'; }
async function postWebhook(payload) { if (!WEBHOOK_URL) return; try { const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'bww-sync-webhook' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) }); if (res.status === 429) { const data = await res.json().catch(() => ({})); const retryAfter = Math.ceil((data.retry_after || 1) * 1000); await new Promise(r => setTimeout(r, Math.min(retryAfter, 5000))); await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) }).catch(() => {}); } } catch (_) {} }
function notifyWebhook(level, line) { if (!WEBHOOK_URL || !shouldNotify(level)) return; const color = level === 'ERROR' || level === 'FATAL' || level === 'UNHANDLED' ? 0xED4245 : level === 'WARN' ? 0xFEE75C : 0x5865F2; const payload = { allowed_mentions: { parse: [] }, embeds: [{ description: '```ansi\n' + truncateForWebhook(String(line), 4000) + '\n```', color, timestamp: new Date().toISOString(), footer: { text: `sync.js • ${level}` } }] }; webhookQueue = webhookQueue.then(() => postWebhook(payload)).catch(() => {}); }
function writeToFile(chunk) { try { fs.appendFileSync(LOG_FILE, chunk); } catch (_) {} }
function safeString(v) { try { return v && v.stack ? v.stack : String(v); } catch (_) { return '<unprintable>'; } }
function emit(level, args) { const line = `[${new Date().toISOString()}] [${level}] ${args.map((a) => (typeof a === 'string' ? a : safeString(a))).join(' ')}`; writeToFile(line + '\n'); if (level === 'ERROR') console.error(line); else if (level === 'WARN') console.warn(line); else console.log(line); notifyWebhook(level, line); }
const logger = { info: (...a) => emit('INFO', a), warn: (...a) => emit('WARN', a), error: (...a) => emit('ERROR', a) };
process.on('uncaughtException', (err) => { const msg = (err && err.stack) || err; writeToFile(`[${new Date().toISOString()}] [FATAL] ${msg}\n`); console.error(`[FATAL] ${msg}`); notifyWebhook('FATAL', `[FATAL] ${msg}`); process.exit(1); });
process.on('unhandledRejection', (reason) => { const msg = (reason && reason.stack) || reason; writeToFile(`[${new Date().toISOString()}] [UNHANDLED] ${msg}\n`); console.error(`[UNHANDLED] ${msg}`); notifyWebhook('UNHANDLED', `[UNHANDLED] ${msg}`); });
const OWNER = 'teamluan'; const REPO = 'BWW'; const BRANCH = 'main'; const API = 'https://api.github.com'; const SHA_FILE = path.join(ROOT, '.deploy-sha'); const MANIFEST_FILE = path.join(ROOT, '.sync-manifest.json'); const SKIP_DIRS = new Set(['.git', '.github', 'node_modules', 'logs', 'data', 'backups']); const SKIP_FILES = new Set(['.env', '.env.local', '.deploy-sha', '.gitignore', 'logs', 'giveaways.json', 'config.json', 'panels.json']);
const ENABLED = process.env.AUTO_UPDATE === 'true'; const INTERVAL_MS = Number(process.env.AUTO_UPDATE_INTERVAL_MS) || 120000; const INTERVAL_S = Math.round(INTERVAL_MS / 1000);
function skipped(file) { const parts = file.split('/'); return parts.some((s) => SKIP_DIRS.has(s)) || SKIP_FILES.has(parts[parts.length - 1]); }
async function retry(fn, tries = 3) { let lastErr; for (let i = 0; i < tries; i++) { try { return await fn(); } catch (err) { lastErr = err; if (i < tries - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1))); } } throw lastErr; }
async function gh(route) { const r = await retry(async () => { const res = await fetch(`${API}${route}`, { headers: { 'User-Agent': 'bww-selfsync', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30000) }); if (!res.ok) { const err = new Error(`GitHub-API ${res.status}: ${route}`); err.status = res.status; throw err; } return res; }); return r.json(); }
async function fetchRaw(file, ref) {
  const r = await retry(async () => {
    const encoded = file.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${encodeURIComponent(ref)}/${encoded}`, { headers: { 'User-Agent': 'bww-selfsync' }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`Download ${res.status}: ${file} @ ${ref}`);
    return res;
  });
  return Buffer.from(await r.arrayBuffer());
}
function safeLocalPath(file) {
  const normalized = path.posix.normalize(String(file).replaceAll('\\', '/'));
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../') || normalized.startsWith('/')) {
    throw new Error(`Unsicherer Dateipfad: ${file}`);
  }
  return path.join(ROOT, ...normalized.split('/'));
}
function writeLocal(file, buf) {
  const target = safeLocalPath(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, buf);
  try { fs.renameSync(tmp, target); } catch (err) { try { fs.rmSync(tmp, { force: true }); } catch (_) {} throw err; }
}
function removeLocal(file) { try { fs.unlinkSync(safeLocalPath(file)); } catch (_) {} }
function readSha() { try { return fs.readFileSync(SHA_FILE, 'utf8').trim(); } catch (_) { return ''; } }
function readManifest() { try { const value = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8')); return Array.isArray(value) ? value : []; } catch (_) { return []; } }
function writeManifest(files) { writeLocal('.sync-manifest.json', Buffer.from(JSON.stringify([...new Set(files)].sort(), null, 2))); }
function writeSha(sha) { try { writeLocal('.deploy-sha', Buffer.from(sha)); } catch (err) { logger.warn(`Auto-Update: SHA-Datei nicht schreibbar: ${err.message}`); } }
function latestCommitSha() { return gh(`/repos/${OWNER}/${REPO}/commits/${BRANCH}`).then((c) => c.sha); }
async function fullSync(backups = new Map()) {
  const sha = await latestCommitSha();
  const tree = await gh(`/repos/${OWNER}/${REPO}/git/trees/${sha}?recursive=1`);
  if (tree.truncated) throw new Error('GitHub Tree ist zu groß/abgeschnitten; Vollsync abgebrochen.');
  const files = (tree.tree || []).filter((e) => e.type === 'blob' && !skipped(e.path) && !e.path.startsWith('.git/')).map(e => e.path);
  const previous = new Set(readManifest());
  const current = new Set(files);
  for (const file of files) {
    const target = safeLocalPath(file);
    if (!backups.has(file)) backups.set(file, fs.existsSync(target) ? fs.readFileSync(target) : null);
    writeLocal(file, await fetchRaw(file, sha));
  }
  for (const file of previous) if (!current.has(file) && !skipped(file)) {
    const target = safeLocalPath(file);
    if (!backups.has(file)) backups.set(file, fs.existsSync(target) ? fs.readFileSync(target) : null);
    removeLocal(file);
  }
  return { sha, count: files.length, files };
}
async function applyFile(f, ref, touched, needsInstallRef, backups) {
  if (f.filename === 'package.json' || f.filename === 'package-lock.json') needsInstallRef.value = true;
  const target = safeLocalPath(f.filename);
  backups.set(f.filename, fs.existsSync(target) ? fs.readFileSync(target) : null);
  if (f.status === 'removed') { removeLocal(f.filename); touched.push(`-${f.filename}`); return; }
  if (f.previous_filename && f.previous_filename !== f.filename) {
    const previous = path.join(ROOT, f.previous_filename);
    backups.set(f.previous_filename, fs.existsSync(previous) ? fs.readFileSync(previous) : null);
    removeLocal(f.previous_filename);
  }
  const buf = await fetchRaw(f.filename, ref);
  if (/\.(js|cjs|mjs)$/i.test(f.filename)) {
    const validationFile = path.join(ROOT, `.sync-validate-${process.pid}-${Date.now()}.js`);
    try {
      fs.writeFileSync(validationFile, buf);
      const check = spawnSync(process.execPath, ['--check', validationFile], { cwd: ROOT, encoding: 'utf8' });
      if (check.status !== 0) throw new Error(`Syntaxprüfung fehlgeschlagen: ${f.filename}\n${check.stderr || check.stdout || ''}`);
    } finally { try { fs.unlinkSync(validationFile); } catch (_) {} }
  }
  if (/\.json$/i.test(f.filename)) {
    try { JSON.parse(buf.toString('utf8')); } catch (err) { throw new Error(`Ungültiges JSON: ${f.filename}: ${err.message}`); }
  }
  writeLocal(f.filename, buf);
  touched.push(`+${f.filename}`);
}
function rollback(backups) {
  for (const [file, buf] of backups) {
    if (buf === null) removeLocal(file);
    else writeLocal(file, buf);
  }
}
let busy = false; let errorCount = 0; let intervalHandle = null; let botProcess = null; let initializing = false; let restartDelay = 500; let stopping = false;
const status = { enabled: false, checks: 0, lastCheckAt: null, lastResult: null, lastCount: 0, lastFiles: [], lastError: null, sha: readSha() || null };
function statusSnapshot() { return { ...status }; }
async function tick() {
  if (busy) return;
  busy = true;
  status.checks += 1;
  status.lastCheckAt = new Date().toISOString();
  const backups = new Map();
  try {
    let applied = 0;
    let needsInstall = false;
    let head = '';
    const base = readSha();

    if (!base) {
      const result = await fullSync(backups);
      applied = result.count;
      head = result.sha;
      status.lastResult = 'installed';
      status.lastCount = applied;
      status.lastFiles = [`Erstinstallation: ${applied} Dateien`];
    } else {
      let cmp = null;
      try {
        cmp = await gh(`/repos/${OWNER}/${REPO}/compare/${base}...${BRANCH}`);
      } catch (err) {
        if (err?.status !== 404) throw err;
        logger.warn('Auto-Update: gespeicherter SHA ist nicht mehr vergleichbar – führe sicheren Vollsync durch.');
      }

      if (!cmp) {
        const result = await fullSync(backups);
        applied = result.count;
        head = result.sha;
      } else {
        head = cmp?.head?.sha || await latestCommitSha();

        if (cmp?.files?.length >= 300 || cmp?.truncated) {
          logger.warn('Auto-Update: GitHub Compare ist möglicherweise abgeschnitten – führe sicheren Vollsync durch.');
          const result = await fullSync(backups);
          applied = result.count;
          head = result.sha;
        } else if (!cmp.files || cmp.files.length === 0) {
          errorCount = 0;
          status.lastResult = 'up-to-date';
          status.lastCount = 0;
          status.lastFiles = [];
          status.lastError = null;
          status.sha = head || base;
          return;
        } else {
          const touched = [];
          const installRef = { value: false };
          for (const f of cmp.files) {
            if (skipped(f.filename)) continue;
            await applyFile(f, head, touched, installRef, backups);
          }
          applied = touched.length;
          needsInstall = installRef.value;
          status.lastResult = applied ? 'updated' : 'up-to-date';
          status.lastCount = applied;
          status.lastFiles = touched;
        }
      }
    }

    const confirmedHead = await latestCommitSha();
    if (confirmedHead !== head) {
      throw new Error(`Remote-Branch hat sich während des Syncs geändert (${head.slice(0, 7)} → ${confirmedHead.slice(0, 7)}). Änderungen wurden verworfen.`);
    }

    if (needsInstall) {
      logger.info('Auto-Update: package.json/package-lock.json geändert – installiere Abhängigkeiten neu…');
      const res = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'inherit' });
      if (res.error) throw new Error(`npm install konnte nicht gestartet werden: ${res.error.message}`);
      if (res.status !== 0) throw new Error(`npm install fehlgeschlagen (Code ${res.status}).`);
    }

    const tree = await gh(`/repos/${OWNER}/${REPO}/git/trees/${head}?recursive=1`);
    if (tree.truncated) throw new Error('GitHub Tree ist zu groß/abgeschnitten; Manifest wurde nicht aktualisiert.');
    const managedFiles = (tree.tree || []).filter((e) => e.type === 'blob' && !skipped(e.path) && !e.path.startsWith('.git/')).map(e => e.path);
    writeManifest(managedFiles);
    writeSha(head);
    status.sha = head;
    status.lastError = null;
    errorCount = 0;

    if (applied > 0) {
      logger.info(`Auto-Update: ${applied} Datei(en) aktualisiert (Commit ${head.slice(0, 7)}).`);
      if (initializing) return;
      logger.info('Auto-Update: Starte neu, um die neue Version zu laden…');
      stopBot();
      setTimeout(() => process.exit(0), 1000).unref();
    } else {
      status.lastResult = 'up-to-date';
      status.lastCount = 0;
      status.lastFiles = [];
    }
  } catch (err) {
    try { rollback(backups); } catch (rollbackErr) { logger.error(`Auto-Update Rollback fehlgeschlagen: ${rollbackErr.message}`); }
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

function stopBot() { if (botProcess && !botProcess.killed) { stopping = true; logger.info('Stoppe Bot...'); botProcess.kill('SIGTERM'); botProcess = null; } }
function startBot() { logger.info('Starte Bot (node src/index.js)...'); if (WEBHOOK_URL) logger.info(`Log-Webhook aktiv (Level: ${WEBHOOK_LEVEL})`); stopping = false; botProcess = spawn(process.execPath, ['src/index.js'], { cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }); const forward = (stream) => { if (!stream) return; stream.on('data', (buf) => { const text = buf.toString(); const chunk = text.endsWith('\n') ? text : text + '\n'; writeToFile(chunk); if (WEBHOOK_URL) { const level = text.includes('[ERROR]') || text.toLowerCase().includes('error') ? 'ERROR' : text.includes('[WARN]') ? 'WARN' : 'INFO'; notifyWebhook(level, text.trim()); } }); }; forward(botProcess.stdout); forward(botProcess.stderr); botProcess.on('exit', (code, signal) => { logger.info(`Bot-Prozess beendet (code=${code}, signal=${signal})`); botProcess = null; if (!stopping && process.exitCode !== 0) { logger.warn(`Bot unerwartet beendet – starte in ${Math.round(restartDelay / 1000)}s neu…`); const delay = restartDelay; restartDelay = Math.min(restartDelay * 2, 60000); setTimeout(() => { if (!stopping) startBot(); }, delay); } }); botProcess.on('error', (err) => { logger.error('Bot-Fehler:', err.message); }); }
async function start() { try { if (ENABLED) { status.enabled = true; logger.info(`Auto-Update aktiv – prüfe alle ${INTERVAL_S} Sekunden auf neue Commits.`); if (!readSha()) { initializing = true; logger.info('Nichts installiert – starte Erstinstallation...'); await tick(); initializing = false; } } else { logger.info('Auto-Update deaktiviert (AUTO_UPDATE != true).'); } } catch (err) { logger.error('Initialer Auto-Update-Schritt fehlgeschlagen:', err && err.message ? err.message : err); } startBot(); if (ENABLED) { intervalHandle = setInterval(() => tick().catch(() => {}), INTERVAL_MS); } const RESTART_FILE = path.join(ROOT, 'restart.requested'); setInterval(() => { try { if (fs.existsSync(RESTART_FILE)) { try { fs.unlinkSync(RESTART_FILE); } catch (_) {} logger.info('Neustart via restart.requested angefordert – starte neu…'); notifyWebhook('INFO', 'Neustart via restart.requested'); stopBot(); setTimeout(() => process.exit(0), 500).unref(); } } catch (_) {} }, 2000); }
if (require.main === module) start();
module.exports = { tick, status: statusSnapshot };
