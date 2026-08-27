const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BRANCH = 'main';
const POLL_MS = 2 * 60 * 1000; // alle 2 Minuten

const ROOT = __dirname; // Repo-Wurzel = App-Wurzel
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

let botProcess = null;

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8' }).toString().trim();
}

function isGitRepo() {
  return fs.existsSync(path.join(ROOT, '.git'));
}

function ensureDeps() {
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    log('Installiere Abhängigkeiten (npm install)...');
    run(npm, ['install'], ROOT);
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
    cwd: ROOT,
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

// Schlägt fehl, wenn lokale (getrackte) Änderungen vorliegen — gitignored
// Dateien wie .env und config/config.json sind davon nicht betroffen.
function hasChanges() {
  try {
    return run('git', ['status', '--porcelain'], ROOT).length > 0;
  } catch {
    return false;
  }
}

async function poll() {
  await new Promise((r) => setTimeout(r, POLL_MS));
  try {
    if (!isGitRepo()) {
      log('Kein git-Repo in der App-Wurzel -> App muss als git-Clone eingerichtet sein.');
      return;
    }
    if (hasChanges()) {
      log('Lokale (getrackte) Änderungen vorhanden -> Pull übersprungen.');
      return;
    }
    run('git', ['fetch', 'origin', BRANCH], ROOT);
    const local = run('git', ['rev-parse', 'HEAD'], ROOT);
    const remote = run('git', ['rev-parse', 'FETCH_HEAD'], ROOT);

    if (local === remote) {
      log('Kein neuer Commit. Warte 2 Minuten...');
      return;
    }

    log(`Neuer Commit erkannt: ${local} -> ${remote}`);
    run('git', ['pull', '--ff-only', 'origin', BRANCH], ROOT);
    ensureDeps();
    stopBot();
    startBot();
  } catch (err) {
    log('Sync-Fehler:', err && err.message ? err.message : err);
  }
}

(async () => {
  if (!isGitRepo()) {
    log('WARNUNG: App-Verzeichnis ist kein git-Clone. sync.js kann dann nicht pullen.');
  }
  ensureDeps();
  startBot();
  for (;;) {
    await poll();
  }
})();
