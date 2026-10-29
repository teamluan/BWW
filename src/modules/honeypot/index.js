// BWW Phase 4 – Honeypot-Modul Barrel (01_ARCHITECTURE Kap. 4+5, 15_FOLDER_STRUCTURE).
// Kein Monolith: dünne Fassade über Services (supabase, permissions, logger,
// audit). Teilt DB/Auth/Permissions/Logging/Audit, bleibt getrennt
// (kein Ticket/Embed/Welcome/Giveaway/Verification-Code hier).

const constants = require('./constants');
const honeypotService = require('./honeypotService');
const detectionService = require('./detectionService');
const actionService = require('./actionService');
const exemptionService = require('./exemptionService');
const statsService = require('./statsService');
const interactionHandler = require('./interactionHandler');

module.exports = {
  ...constants,
  ...honeypotService,
  ...detectionService,
  ...actionService,
  ...exemptionService,
  ...statsService,
  handleHoneypotInteraction: interactionHandler.handleHoneypotInteraction,
};
