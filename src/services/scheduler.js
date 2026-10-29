// BWW Phase 1 – Scheduler-Service (Giveaway-Ende, Autoclose, Status-Refresh teilen ihn).
// Zentrale Registry statt verstreuter setInterval-Aufrufe. Fehler werden geloggt, Tasks laufen weiter.

const { logger } = require('./logger');

const log = logger.child('scheduler');
const tasks = new Map();

function register(name, intervalMs, fn, { runImmediately = false } = {}) {
  if (tasks.has(name)) stop(name);
  if (typeof fn !== 'function') throw new Error(`Scheduler-Task "${name}" braucht eine Funktion.`);
  const ms = Math.max(1000, Number(intervalMs) || 60000);
  const tick = async () => {
    try {
      await fn();
    } catch (err) {
      log.warn(`Task "${name}" fehlgeschlagen:`, err.message);
    }
  };
  const handle = setInterval(() => {
    tick().catch(() => {});
  }, ms);
  if (handle.unref) handle.unref();
  tasks.set(name, handle);
  if (runImmediately) tick().catch(() => {});
  log.info(`Task "${name}" registriert (alle ${Math.round(ms / 1000)}s).`);
  return handle;
}

function stop(name) {
  const handle = tasks.get(name);
  if (handle) clearInterval(handle);
  tasks.delete(name);
}

function stopAll() {
  for (const name of [...tasks.keys()]) stop(name);
}

module.exports = { register, stop, stopAll };
