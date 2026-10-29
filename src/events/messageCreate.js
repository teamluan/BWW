// BWW Phase 4 – events/messageCreate.js (Ziel-Struktur).
// Honeypot-Check ZUERST (04_HONEYPOT via src/modules/honeypot),
// dann Ticket-Logging (Phase 3). Beide Zweige silent-fail, werfen nie
// (Bot-Flow darf nie brechen). Keine Doppel-Verarbeitung: Bots/Webhooks
// werden sofort ignoriert, Legacy-utils/honeypot wird NICHT mehr aufgerufen.

async function execute(message, client = null) {
  if (!message?.guild || message.author?.bot || message.webhookId) return;
  // 1) Honeypot (Phase 4, 04_HONEYPOT.md)
  try {
    const { handleHoneypotMessage } = require('../modules/honeypot/detectionService');
    await handleHoneypotMessage(message, client);
  } catch (err) {
    console.error('[BWW] Honeypot Fehler:', err?.message || err);
  }
  // 2) Ticket-Logging (Phase 3, 03_TICKETS.md)
  try {
    const { logTicketMessage } = require('../modules/ticket/messageLogger');
    await logTicketMessage(message);
  } catch (err) {
    console.error('[BWW] Ticket-Log Fehler:', err?.message || err);
  }
}

module.exports = execute;
module.exports.execute = execute;
