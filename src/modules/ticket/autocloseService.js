// BWW Phase 3 – Autoclose-Service (03: inaktiv -> Warnung 24h -> close 48h).
// Konfigurierbar via bww_guild_settings.settings.ticket.autoclose:
// { enabled, warnAfterHours, closeAfterHours }. Scheduler: registerTicketAutoclose
// (alle 15 Min). Warnung einmalig (bww_ticket_actions action=warn).

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { AUTOCLOSE_DEFAULTS } = require('./constants');

const log = logger.child('ticket:autoclose');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) return [];
  try {
    const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
    return await res.json();
  } catch (e) { log.warn('Autoclose-DB-Fehler:', e.message); return []; }
}

async function getAutocloseConfig(guildId) {
  try {
    const { getGuildSettings } = require('../../utils/database');
    const cfg = await getGuildSettings(guildId);
    const raw = cfg?.ticket?.autoclose || {};
    return {
      enabled: raw.enabled !== false && AUTOCLOSE_DEFAULTS.enabled,
      warnAfterHours: Math.max(1, Math.min(720, Number(raw.warnAfterHours ?? raw.warn_after_hours ?? AUTOCLOSE_DEFAULTS.warnAfterHours))),
      closeAfterHours: Math.max(2, Math.min(1440, Number(raw.closeAfterHours ?? raw.close_after_hours ?? AUTOCLOSE_DEFAULTS.closeAfterHours))),
    };
  } catch { return { ...AUTOCLOSE_DEFAULTS }; }
}

async function wasWarned(ticketId) {
  const rows = await rest('bww_ticket_actions', `?select=id&ticket_id=eq.${encodeURIComponent(ticketId)}&action=eq.warn&limit=1`);
  return (rows?.length || 0) > 0;
}

async function checkAutoclose(client) {
  if (!isConfigured()) return { warned: 0, closed: 0 };
  let warned = 0, closed = 0;
  const tickets = await rest('bww_tickets', '?select=id,guild_id,channel_id,status,updated_at,creator_id,owner_id&status=in.(open,claimed,pending)&order=updated_at.asc&limit=200');
  for (const t of tickets || []) {
    try {
      const cfg = await getAutocloseConfig(t.guild_id);
      if (!cfg.enabled) continue;
      const inactiveH = (Date.now() - new Date(t.updated_at).getTime()) / 36e5;
      if (inactiveH >= cfg.closeAfterHours) {
        const { closeTicket } = require('./actionsService');
        const guild = client.guilds.cache.get(t.guild_id) || await client.guilds.fetch(t.guild_id).catch(() => null);
        if (!guild) continue;
        await closeTicket(client, t.id, { id: 'system-autoclose', guild }, `Automatisch geschlossen nach ${cfg.closeAfterHours}h Inaktivität.`);
        closed++;
      } else if (inactiveH >= cfg.warnAfterHours && !(await wasWarned(t.id))) {
        const channel = t.channel_id ? await client.channels.fetch(t.channel_id).catch(() => null) : null;
        if (channel?.isTextBased()) await channel.send(`⏳ Dieses Ticket ist seit ${Math.floor(inactiveH)}h inaktiv und wird in ${Math.max(1, Math.round(cfg.closeAfterHours - inactiveH))}h automatisch geschlossen. Bitte melde dich, falls noch Bedarf besteht.`).catch(() => {});
        const { recordAction } = require('./ticketService');
        await recordAction(t.id, t.guild_id, 'system-autoclose', 'warn', t.status, t.status, { inactiveHours: Math.round(inactiveH) });
        warned++;
      }
    } catch (e) { log.warn(`Autoclose ${t.id} fehlgeschlagen:`, e.message); }
  }
  if (warned || closed) log.info(`Autoclose: ${warned} gewarnt, ${closed} geschlossen.`);
  return { warned, closed };
}

module.exports = { getAutocloseConfig, checkAutoclose };
