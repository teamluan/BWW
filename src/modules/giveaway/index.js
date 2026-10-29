// BWW Phase 7 - Giveaway-Modul Barrel (01_ARCHITECTURE Kap.4+5, 15_FOLDER_STRUCTURE).
// Duenne Fassade ueber Services (supabase, permissions, logger, audit, scheduler,
// validation, messageBuilder via giveawayMessage). Giveaway->Verification:
// verified-Requirement ist NUR ein Hook (requirementService.checkVerifiedHook),
// KEINE Verification-Modul-Logik hier (folgt in Phase 8, 08_VERIFICATION.md).

const constants = require('./constants');
const giveawayService = require('./giveawayService');
const requirementService = require('./requirementService');
const entryService = require('./entryService');
const endService = require('./endService');
const rerollService = require('./rerollService');
const schedulerService = require('./schedulerService');
const giveawayMessage = require('./giveawayMessage');
const interactionHandler = require('./interactionHandler');

function registerGiveawayScheduler(client) {
  return schedulerService.registerGiveawayScheduler(client);
}

module.exports = {
  ...constants,
  ...giveawayService,
  ...requirementService,
  ...entryService,
  ...endService,
  ...rerollService,
  ...schedulerService,
  ...giveawayMessage,
  handleGiveawayInteraction: interactionHandler.handleGiveawayInteraction,
  registerGiveawayScheduler,
};
