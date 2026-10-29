// BWW Phase 3 – Ticket messageCreate-Logging (bww_ticket_messages:
// discord_message_id/author/content/attachments). Wird aus
// src/events/messageCreate.js aufgerufen. Silent-fail, wirft nie.

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { cleanId, clampText } = require('../../services/validation');

const log = logger.child('ticket:messages');

async function logTicketMessage(message) {
  try {
    if (!message?.guild || message.author?.bot) return null;
    if (!isConfigured()) return null;
    const channelId = message.channel?.id;
    if (!channelId) return null;
    // Nur Ticket-Channels loggen (Lookup über bww_tickets.channel_id)
    const lookup = await supabaseRequest(
      `bww_tickets?select=id,guild_id&channel_id=eq.${encodeURIComponent(channelId)}&limit=1`,
      { headers: { Prefer: 'return=representation' } }
    ).then((r) => r.json()).catch(() => []);
    const ticket = lookup?.[0];
    if (!ticket) return null;
    const attachments = [...(message.attachments?.values?.() || [])].map((a) => ({ name: a.name, url: a.url, size: a.size, contentType: a.contentType })).slice(0, 10);
    const body = {
      ticket_id: ticket.id,
      guild_id: ticket.guild_id,
      discord_message_id: message.id,
      message_id: message.id,
      author_id: message.author.id,
      user_id: message.author.id,
      content: clampText(message.content || '', 4000),
      attachments,
      is_system: false,
    };
    await supabaseRequest('bww_ticket_messages', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) }).catch(() => {});
    // Aktivität für Autoclose nachziehen
    await supabaseRequest(`bww_tickets?id=eq.${encodeURIComponent(ticket.id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ updated_at: new Date().toISOString() }),
    }).catch(() => {});
    return true;
  } catch (e) {
    log.warn('Message-Log fehlgeschlagen:', e.message);
    return null;
  }
}

module.exports = { logTicketMessage };
