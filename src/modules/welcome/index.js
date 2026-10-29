// BWW Phase 6 - Welcome-Modul Barrel (01_ARCHITECTURE Kap.4+5, 15_FOLDER_STRUCTURE).
// Duenne Fassade ueber Services (supabase, permissions, logger, audit,
// variables/messageBuilder). Wiederverwendet Embed V2 via getEmbedForWelcome/
// toV2Data (Welcome->EmbedV2). KEINE Giveaway/Verification-Logik hier.

const constants = require('./constants');
const welcomeService = require('./welcomeService');
const variableService = require('./variableService');
const dmService = require('./dmService');
const autoRoleService = require('./autoRoleService');
const logService = require('./logService');
const welcomeFlow = require('./welcomeFlow');
const interactionHandler = require('./interactionHandler');

module.exports = {
  ...constants,
  ...welcomeService,
  ...variableService,
  ...dmService,
  ...autoRoleService,
  ...logService,
  ...welcomeFlow,
  handleWelcomeInteraction: interactionHandler.handleWelcomeInteraction,
};
