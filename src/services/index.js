// BWW Phase 1 – Service-Barrel (Single Source of Truth fuer Bot-Module).
// Module importieren zentrale Services NUR von hier:
//   const { logger, supabase, permissions, audit } = require('../services');

module.exports = {
  supabase: require('./supabase'),
  loggerService: require('./logger'),
  permissions: require('./permissions'),
  audit: require('./audit'),
  variables: require('./variables'),
  cache: require('./cache'),
  scheduler: require('./scheduler'),
  messageBuilder: require('./messageBuilder'),
  discord: require('./discord'),
  validation: require('./validation'),
};
