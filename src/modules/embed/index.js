// BWW Phase 5 – Embed-Modul Barrel (01_ARCHITECTURE Kap.4+5, 15_FOLDER_STRUCTURE).
// Kein Monolith: duenne Fassade ueber Services (supabase, permissions, logger,
// audit, messageBuilder/variables, validation). Wiederverwendbarer Service fuer
// Welcome/Ticket (z.B. getEmbedForWelcome(), renderTicketPanel()).
// KEINE Welcome/Giveaway/Verification-Logik hier (nur Embed-seitige Wiederverwendbarkeit).

const constants = require('./constants');
const embedService = require('./embedService');
const componentService = require('./componentService');
const buttonService = require('./buttonService');
const selectService = require('./selectService');
const actionService = require('./actionService');
const sendService = require('./sendService');
const interactionHandler = require('./interactionHandler');

module.exports = {
  ...constants,
  ...embedService,
  ...componentService,
  ...buttonService,
  ...selectService,
  ...actionService,
  ...sendService,
  handleEmbedInteraction: interactionHandler.handleEmbedInteraction,
};
