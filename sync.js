const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_URL = 'https://github.com/teamluan/BWW.git';
const BRANCH = 'main';
const POLL_MS = 2 * 60 * 1000; // alle 2 Minuten
const BOT_DIR = path.join(__dirname, 'bot');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

let botProcess = null;

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8' }).toString().trim();
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
  ensureRepo();
  ensureDeps();
  startBot();
  for (;;) {
    await poll();
  }
})();
