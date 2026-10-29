// BWW Phase 6 - Welcome-Konstanten (Quelle: 06_WELCOME.md).
// Standardvariablen exakt aus Plan, Limits, Defaults.
// Single Source of Truth: Supabase (bww_welcome/variables/logs).

const STANDARD_VARIABLES = Object.freeze([
  '{user}',
  '{user.id}',
  '{user.name}',
  '{user.displayName}',
  '{server}',
  '{server.id}',
  '{server.name}',
  '{member.count}',
  '{channel}',
  '{channel.name}',
]);

const DEFAULT_MESSAGE = 'Willkommen {user} auf {server}! Du bist Mitglied {member.count}.';
const DEFAULT_DM_MESSAGE = 'Hey {user.name}, willkommen auf {server}! Schau gerne in {channel} vorbei.';

const MESSAGE_MAX = 4000;
const DELETE_AFTER_MIN = 0;
const DELETE_AFTER_MAX = 86400;

function assertDeleteAfter(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < DELETE_AFTER_MIN || n > DELETE_AFTER_MAX) {
    throw new Error('Ungueltige Loesch-Verzoegerung (0-86400s).');
  }
  return Math.floor(n);
}

module.exports = {
  STANDARD_VARIABLES,
  DEFAULT_MESSAGE,
  DEFAULT_DM_MESSAGE,
  MESSAGE_MAX,
  DELETE_AFTER_MIN,
  DELETE_AFTER_MAX,
  assertDeleteAfter,
};
