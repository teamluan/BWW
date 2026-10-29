// BWW Phase 7 - Scheduler-Service (ends_at-Ueberwachung, 1min-Tick wie Ticket-Autoclose).
// Nie werfend: Fehler werden geloggt, Tick laeuft weiter. Registrierung zentral
// ueber src/services/scheduler (kein verstreutes setInterval).

const { logger } = require('../../services/logger');

const log = logger.child('giveaway:scheduler');

async function checkDueGiveaways(client) {
  try {
    const { listDueGiveaways } = require('./giveawayService');
    const { endGiveaway } = require('./endService');
    const due = await listDueGiveaways(100).catch(() => []);
    let ended = 0;
    let failed = 0;
    for (const g of due || []) {
      try { await endGiveaway(client, g, { actorId: 'system-scheduler' }); ended++; }
      catch (e) { failed++; log.warn('Giveaway ' + g?.id + ' Auto-Ende fehlgeschlagen:', e.message); }
    }
    if (ended || failed) log.info('Scheduler: ' + ended + ' beendet, ' + failed + ' Fehler.');
    return { ended, failed, checked: (due || []).length };
  } catch (e) {
    log.warn('Scheduler-Tick fehlgeschlagen:', e.message);
    return { ended: 0, failed: 0, checked: 0 };
  }
}

function registerGiveawayScheduler(client) {
  try {
    const { scheduler } = require('../../services');
    scheduler.register('giveaway-ends', 60 * 1000, () => checkDueGiveaways(client), { runImmediately: true });
  } catch (err) {
    try { require('../../services').loggerService.logger.child('giveaway').warn('Scheduler-Registrierung fehlgeschlagen:', err.message); } catch {}
  }
}

module.exports = { checkDueGiveaways, registerGiveawayScheduler };
