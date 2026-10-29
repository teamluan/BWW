// BWW Phase 8 - Verification-Konstanten (Quelle: 08_VERIFICATION.md).
// Methoden: button/code/captcha (legacy oauth/manual lesbar).
// User-Status: pending/verified/failed/expired (+blocked legacy lesbar).
// Prefix-Gruppe: bww_verification_* (eigene Gruppe, kein Doppel-Handling).
// Single Source of Truth: Supabase (bww_verification* Tabellen aus Phase 2).

const METHODS = Object.freeze(['button', 'code', 'captcha']);
const LEGACY_METHODS = Object.freeze(['oauth', 'manual']);
const ALL_METHODS = Object.freeze([...METHODS, ...LEGACY_METHODS]);

const USER_STATUSES = Object.freeze(['pending', 'verified', 'failed', 'expired']);
const LEGACY_USER_STATUSES = Object.freeze(['blocked']);
const ALL_USER_STATUSES = Object.freeze([...USER_STATUSES, ...LEGACY_USER_STATUSES]);

const VERIFICATION_PREFIX = 'bww_verification_';
const BUTTON_VERIFY = 'bww_verification_verify';
const MODAL_CODE = 'bww_verification_code_modal';
const MODAL_CAPTCHA = 'bww_verification_captcha_modal';

const CODE_LENGTH = 6;
const CODE_VALIDITY_MINUTES_DEFAULT = 10;
const CODE_VALIDITY_MIN = 1;
const CODE_VALIDITY_MAX = 1440;

const MAX_ATTEMPTS_DEFAULT = 5;
const ATTEMPT_WINDOW_MINUTES_DEFAULT = 10;
const ATTEMPT_WINDOW_MIN = 1;
const ATTEMPT_WINDOW_MAX = 1440;

function normalizeMethod(value) {
  const raw = String(value || '').toLowerCase().trim();
  if (METHODS.includes(raw)) return raw;
  if (LEGACY_METHODS.includes(raw)) return raw;
  if (raw === 'knopf') return 'button';
  return null;
}

function assertMethod(value) {
  const m = normalizeMethod(value);
  if (!m) throw new Error('Ungueltige Methode (button/code/captcha).');
  if (!METHODS.includes(m)) throw new Error('Methode wird nicht mehr angeboten (button/code/captcha).');
  return m;
}

function normalizeUserStatus(value) {
  const raw = String(value || '').toLowerCase().trim();
  if (ALL_USER_STATUSES.includes(raw)) return raw;
  return null;
}

function assertUserStatus(value) {
  const s = normalizeUserStatus(value);
  if (!s) throw new Error('Ungueltiger Status (pending/verified/failed/expired).');
  return s;
}

function assertCodeValidityMinutes(value) {
  const n = Number(value ?? CODE_VALIDITY_MINUTES_DEFAULT);
  if (!Number.isFinite(n) || n < CODE_VALIDITY_MIN || n > CODE_VALIDITY_MAX) {
    throw new Error('Ungueltige Code-Gueltigkeit (1-1440 Minuten).');
  }
  return Math.floor(n);
}

function assertRateLimit(value, fallback, min, max) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error('Ungueltiges Rate-Limit.');
  return Math.floor(n);
}

module.exports = {
  METHODS,
  LEGACY_METHODS,
  ALL_METHODS,
  USER_STATUSES,
  LEGACY_USER_STATUSES,
  ALL_USER_STATUSES,
  VERIFICATION_PREFIX,
  BUTTON_VERIFY,
  MODAL_CODE,
  MODAL_CAPTCHA,
  CODE_LENGTH,
  CODE_VALIDITY_MINUTES_DEFAULT,
  CODE_VALIDITY_MIN,
  CODE_VALIDITY_MAX,
  MAX_ATTEMPTS_DEFAULT,
  ATTEMPT_WINDOW_MINUTES_DEFAULT,
  ATTEMPT_WINDOW_MIN,
  ATTEMPT_WINDOW_MAX,
  normalizeMethod,
  assertMethod,
  normalizeUserStatus,
  assertUserStatus,
  assertCodeValidityMinutes,
  assertRateLimit,
};
