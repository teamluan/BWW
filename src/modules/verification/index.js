// BWW Phase 8 - Verification-Modul Barrel (01_ARCHITECTURE Kap.4+5, 15_FOLDER_STRUCTURE).
// Duenne Fassade ueber Services (supabase, permissions, logger, audit, validation).
// Giveaway->Verification: verified-Hook via isVerified/getVerificationStatus/checkVerifiedHook
// (Giveaway importiert Verification lazy, NIE umgekehrt - kein Zirkel-Import).

const constants = require('./constants');
const verificationService = require('./verificationService');
const userService = require('./userService');
const codeService = require('./codeService');
const attemptService = require('./attemptService');
const logService = require('./logService');
const flowService = require('./flowService');
const interactionHandler = require('./interactionHandler');

module.exports = {
  ...constants,
  ...verificationService,
  ...userService,
  ...codeService,
  ...attemptService,
  ...logService,
  ...flowService,
  handleVerificationInteraction: interactionHandler.handleVerificationInteraction,
};
