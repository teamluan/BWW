// BWW Phase 14 – src/services/notifications.js (14_PLATTFORM: Notifications echt).
// Best-Effort-Trigger aus Bot-Modulen in bww_notifications (nie werfend, nie blockierend).
// Typen: ticket_closed, honeypot_triggered, giveaway_ended, verification, system.
// Dashboard liest via website/lib/notifications.js (bww_notifications zuerst, sonst derived).
// Keine Business-Logik-Aenderung: nur Protokollierung, Aufrufer faengt nie Fehler.

const { supabaseRequest, isConfigured } = require('./supabase');

function clamp(s, max) {
  return String(s ?? '').slice(0, Math.max(1, Math.min(2000, max || 500)));
}

async function notifyGuild(guildId, { type, title, message, link } = {}) {
  try {
    const g = String(guildId || '').trim();
    if (!g || !isConfigured()) return null;
    const t = String(type || 'system').slice(0, 50);
    const allowed = ['ticket_closed', 'honeypot_triggered', 'giveaway_ended', 'verification', 'system'];
    const safeType = allowed.includes(t) ? t : 'system';
    const res = await supabaseRequest('bww_notifications', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        guild_id: g.slice(0, 32),
        type: safeType,
        title: clamp(title || safeType, 200),
        message: clamp(message || '', 1000),
        link: link ? clamp(link, 500) : null,
      }),
    }).catch(() => null);
    return res ? true : null;
  } catch {
    return null;
  }
}

async function notifyTicketClosed(guildId, ticketNumber, ticketId) {
  return notifyGuild(guildId, {
    type: 'ticket_closed',
    title: `Ticket #${ticketNumber ?? ticketId} geschlossen`,
    message: `Ticket ${ticketId} wurde geschlossen.`,
    link: '/tickets/closed',
  });
}

async function notifyHoneypotTriggered(guildId, userId, action) {
  return notifyGuild(guildId, {
    type: 'honeypot_triggered',
    title: 'Honeypot ausgelöst',
    message: `User ${userId} · ${action || 'log_only'}`,
    link: '/honeypot/hits',
  });
}

async function notifyGiveawayEnded(guildId, prize, giveawayId) {
  return notifyGuild(guildId, {
    type: 'giveaway_ended',
    title: 'Giveaway beendet',
    message: String(prize || giveawayId || '').slice(0, 500),
    link: '/giveaways/past',
  });
}

async function notifyVerification(guildId, userId, status) {
  return notifyGuild(guildId, {
    type: 'verification',
    title: 'Verification aktualisiert',
    message: `User ${userId} · ${status || ''}`.slice(0, 500),
    link: '/verification/users',
  });
}

async function notifySystem(guildId, message) {
  return notifyGuild(guildId, {
    type: 'system',
    title: 'System-Hinweis',
    message: String(message || '').slice(0, 1000),
    link: '/system/bot',
  });
}

module.exports = {
  notifyGuild,
  notifyTicketClosed,
  notifyHoneypotTriggered,
  notifyGiveawayEnded,
  notifyVerification,
  notifySystem,
};
