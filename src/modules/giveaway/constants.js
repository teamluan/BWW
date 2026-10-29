// BWW Phase 7 - Giveaway-Konstanten (Quelle: 07_GIVEAWAYS.md).
// Status exakt: scheduled/running/ended/cancelled (legacy 'active' = running).
// Requirement-Typen: role/account_age/server_age/minimum_level/channel_message/booster/verified.

const STATUSES = Object.freeze(['scheduled', 'running', 'ended', 'cancelled']);
const LEGACY_ACTIVE = 'active';
const REQUIREMENT_TYPES = Object.freeze(['role', 'account_age', 'server_age', 'minimum_level', 'channel_message', 'booster', 'verified']);
const BUTTON_PREFIX_JOIN = 'bww_giveaway_join_';
const BUTTON_PREFIX_LEAVE = 'bww_giveaway_leave_';
const BUTTON_PREFIX_END = 'bww_giveaway_end_';
const BUTTON_PREFIX_REROLL = 'bww_giveaway_reroll_';
const BUTTON_PREFIX_CANCEL = 'bww_giveaway_cancel_';
const GIVEAWAY_PREFIX = 'bww_giveaway_';
const PRIZE_MAX = 256;
const DESCRIPTION_MAX = 2000;
const WINNER_MIN = 1;
const WINNER_MAX = 100;
const DURATION_MIN_MS = 5000;
const DURATION_MAX_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === LEGACY_ACTIVE) return 'running';
  if (STATUSES.includes(s)) return s;
  return s || 'running';
}
function isRunningStatus(status) {
  const s = String(status || '').toLowerCase();
  return s === 'running' || s === 'scheduled' || s === LEGACY_ACTIVE;
}
module.exports = { STATUSES, LEGACY_ACTIVE, REQUIREMENT_TYPES, BUTTON_PREFIX_JOIN, BUTTON_PREFIX_LEAVE, BUTTON_PREFIX_END, BUTTON_PREFIX_REROLL, BUTTON_PREFIX_CANCEL, GIVEAWAY_PREFIX, PRIZE_MAX, DESCRIPTION_MAX, WINNER_MIN, WINNER_MAX, DURATION_MIN_MS, DURATION_MAX_MS, normalizeStatus, isRunningStatus };
