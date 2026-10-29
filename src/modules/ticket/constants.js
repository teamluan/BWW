// BWW Phase 3 – Ticket-Konstanten (Quelle: 03_TICKETS.md Kap. Tabellen/Status).
// Single Source of Truth: Supabase (bww_ticket_*). Status/Priority NUR aus
// erlaubten Werten – jede Schreibstelle muss hiergegen validieren.

const TICKET_STATUS = Object.freeze(['open', 'claimed', 'pending', 'closed', 'deleted']);
// Legacy-DB kennt zusaetzlich locked/archived (utils/tickets.js + altes Dashboard).
// Neue Logik schreibt NUR TICKET_STATUS, liest aber LEGACY_STATUS tolerant.
const LEGACY_STATUS = Object.freeze(['open', 'claimed', 'pending', 'closed', 'deleted', 'locked', 'archived']);
const TICKET_PRIORITY = Object.freeze(['low', 'normal', 'high', 'urgent']);

const PRIORITY_META = Object.freeze({
  low: { label: 'Niedrig', emoji: '🟢' },
  normal: { label: 'Normal', emoji: '🔵' },
  high: { label: 'Hoch', emoji: '🟠' },
  urgent: { label: 'Dringend', emoji: '🔴' },
});

const STATUS_META = Object.freeze({
  open: { label: 'Offen', emoji: '🟢' },
  claimed: { label: 'Übernommen', emoji: '👤' },
  pending: { label: 'Wartend', emoji: '⏳' },
  closed: { label: 'Geschlossen', emoji: '✅' },
  deleted: { label: 'Gelöscht', emoji: '🗑️' },
  locked: { label: 'Gesperrt (legacy)', emoji: '🔒' },
  archived: { label: 'Archiviert (legacy)', emoji: '📦' },
});

const BUTTON_IDS = Object.freeze({
  CLAIM: 'bww_ticket_claim',
  CLOSE: 'bww_ticket_close',
  REOPEN: 'bww_ticket_reopen',
  DELETE: 'bww_ticket_delete',
  TRANSCRIPT: 'bww_ticket_transcript',
});

const SELECT_IDS = Object.freeze({
  TYPE_SELECT: 'bww_ticket_type_select',
});

const BUTTON_STYLES = Object.freeze(['primary', 'secondary', 'success', 'danger']);

const AUTOCLOSE_DEFAULTS = Object.freeze({
  enabled: true,
  warnAfterHours: 24,
  closeAfterHours: 48,
});

function assertStatus(status) {
  if (!TICKET_STATUS.includes(status)) throw new Error(`Ungültiger Ticket-Status: ${status}. Erlaubt: ${TICKET_STATUS.join(', ')}`);
  return status;
}

function assertPriority(priority) {
  if (!TICKET_PRIORITY.includes(priority)) throw new Error(`Ungültige Priorität: ${priority}. Erlaubt: ${TICKET_PRIORITY.join(', ')}`);
  return priority;
}

module.exports = {
  TICKET_STATUS,
  LEGACY_STATUS,
  TICKET_PRIORITY,
  PRIORITY_META,
  STATUS_META,
  BUTTON_IDS,
  SELECT_IDS,
  BUTTON_STYLES,
  AUTOCLOSE_DEFAULTS,
  assertStatus,
  assertPriority,
};
