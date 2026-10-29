// BWW Phase 3 – Ticket-Modul Barrel (01_ARCHITECTURE Kap. 4+5, 15_FOLDER_STRUCTURE).
// Kein Monolith: dünne Fassade über Services (supabase, permissions, logger,
// audit, messageBuilder, scheduler, cache, validation). Module teilen DB/Auth/
// Permissions/Logging/Audit/Scheduler, bleiben aber getrennt (kein Honeypot/Embed/
// Welcome/Giveaway/Verification-Code hier).

const constants = require('./constants');
const panelService = require('./panelService');
const ticketService = require('./ticketService');
const actionsService = require('./actionsService');
const transcriptService = require('./transcriptService');
const templateService = require('./templateService');
const autocloseService = require('./autocloseService');
const interactionHandler = require('./interactionHandler');
const messageLogger = require('./messageLogger');

// Scheduler-Verdrahtung: Autoclose läuft zentral über src/services/scheduler.
// Aufruf aus src/index.js nach ClientReady: registerTicketAutoclose(client).
function registerTicketAutoclose(client) {
  try {
    const { scheduler } = require('../../services');
    scheduler.register('ticket-autoclose', 15 * 60 * 1000, () => autocloseService.checkAutoclose(client), { runImmediately: false });
  } catch (err) {
    try { require('../../services').loggerService.logger.child('ticket').warn('Autoclose-Registrierung fehlgeschlagen:', err.message); } catch {}
  }
}

module.exports = {
  ...constants,
  ...panelService,
  ...ticketService,
  ...actionsService,
  ...transcriptService,
  ...templateService,
  ...autocloseService,
  handleTicketInteraction: interactionHandler.handleTicketInteraction,
  logTicketMessage: messageLogger.logTicketMessage,
  registerTicketAutoclose,
};
