// BWW Phase 4 – Honeypot-Konstanten (Quelle: 04_HONEYPOT.md).
// Single Source of Truth: Supabase (bww_honeypots/triggers/exemptions).
// Aktionen + Status NUR aus erlaubten Werten – jede Schreibstelle validiert hiergegen.

const HONEYPOT_ACTIONS = Object.freeze(['delete', 'warn', 'timeout', 'kick', 'ban', 'notify_staff', 'log_only']);

// Legacy-Mapping (utils/honeypot.js + bww_honeypot_events): punishment none/kick/ban/timeout.
// Neue Logik schreibt HONEYPOT_ACTIONS, liest action_taken tolerant.
const LEGACY_ACTION_TAKEN = Object.freeze(['none', 'warn', 'timeout', 'kick', 'ban', 'log']);

const ACTION_META = Object.freeze({
  delete: { label: 'Löschen', emoji: '🗑️' },
  warn: { label: 'Verwarnen', emoji: '⚠️' },
  timeout: { label: 'Timeout', emoji: '⏱️' },
  kick: { label: 'Kick', emoji: '👢' },
  ban: { label: 'Ban', emoji: '🔨' },
  notify_staff: { label: 'Staff benachrichtigen', emoji: '📢' },
  log_only: { label: 'Nur loggen', emoji: '📝' },
});

const DEFAULT_TIMEOUT_DURATION = 600; // Sekunden (10 Min.)
const TRIGGER_THROTTLE_MS = 15_000;

function assertAction(action) {
  if (!HONEYPOT_ACTIONS.includes(action)) throw new Error(`Ungültige Honeypot-Aktion: ${action}. Erlaubt: ${HONEYPOT_ACTIONS.join(', ')}`);
  return action;
}

// Legacy action_taken -> 04-Action (lesen tolerant, schreiben immer 04).
function mapLegacyActionTaken(value) {
  const v = String(value || '');
  if (HONEYPOT_ACTIONS.includes(v)) return v;
  if (v === 'none' || v === 'log') return v === 'log' ? 'notify_staff' : 'log_only';
  return 'log_only';
}

// 04-Action -> legacy action_taken (fuer bww_honeypot_triggers.action_taken Spalte).
function toLegacyActionTaken(action) {
  switch (action) {
    case 'warn': return 'warn';
    case 'timeout': return 'timeout';
    case 'kick': return 'kick';
    case 'ban': return 'ban';
    case 'notify_staff': return 'log';
    default: return 'none';
  }
}

module.exports = {
  HONEYPOT_ACTIONS,
  LEGACY_ACTION_TAKEN,
  ACTION_META,
  DEFAULT_TIMEOUT_DURATION,
  TRIGGER_THROTTLE_MS,
  assertAction,
  mapLegacyActionTaken,
  toLegacyActionTaken,
};
