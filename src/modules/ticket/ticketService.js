// BWW Phase 3 – Ticket-Service (Create-Flow, Nummern, Channels).
// 03: ticket_number fortlaufend pro guild, status open, priority normal,
// creator_id/type_id/channel_id. Nutzt services (supabase, logger, audit,
// validation, cache). Keine Monolith-Logik, kein Fremdmodul-Code.

const crypto = require('crypto');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');
const { cleanId, clampText } = require('../../services/validation');

const log = logger.child('ticket:service');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

function generateTicketId() {
  return `TKT-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function sanitizeChannelName(value) {
  const name = String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return name || 'anfrage';
}

async function nextTicketNumber(guildId) {
  const gid = cleanId(guildId);
  try {
    const rows = await rest('bww_tickets', `?select=ticket_number&guild_id=eq.${encodeURIComponent(gid)}&order=ticket_number.desc&limit=1`);
    const max = Number(rows?.[0]?.ticket_number) || 0;
    if (max > 0) return max + 1;
  } catch {}
  try {
    const rows = await rest('bww_tickets', `?select=id&guild_id=eq.${encodeURIComponent(gid)}`);
    return (rows?.length || 0) + 1;
  } catch { return 1; }
}

async function recordAction(ticketId, guildId, actorId, action, oldValue = null, newValue = null, details = {}) {
  try {
    await rest('bww_ticket_actions', '', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        ticket_id: String(ticketId), guild_id: String(guildId),
        actor_id: actorId ? String(actorId).slice(0, 100) : null,
        action: String(action).slice(0, 32),
        old_value: oldValue != null ? String(oldValue).slice(0, 500) : null,
        new_value: newValue != null ? String(newValue).slice(0, 500) : null,
        details: details && typeof details === 'object' ? details : {},
      }),
    });
  } catch (e) { log.warn('Action-Log fehlgeschlagen:', e.message); }
}

async function getTicket(id, guildId = null) {
  const rows = await rest('bww_tickets', `?select=*,bww_ticket_types(id,name,emoji,color,category_id,staff_role_id)&id=eq.${encodeURIComponent(id)}${guildId ? `&guild_id=eq.${encodeURIComponent(cleanId(guildId))}` : ''}&limit=1`)
    .catch(() => rest('bww_tickets', `?select=*&id=eq.${encodeURIComponent(id)}${guildId ? `&guild_id=eq.${encodeURIComponent(cleanId(guildId))}` : ''}&limit=1`));
  return rows?.[0] || null;
}

async function getTicketByChannel(channelId, guildId = null) {
  const cid = cleanId(channelId);
  const rows = await rest('bww_tickets', `?select=*&channel_id=eq.${encodeURIComponent(cid)}${guildId ? `&guild_id=eq.${encodeURIComponent(cleanId(guildId))}` : ''}&limit=1`);
  return rows?.[0] || null;
}

async function listTickets(guildId, { status = null, limit = 100 } = {}) {
  const gid = cleanId(guildId);
  let q = `?select=*&guild_id=eq.${encodeURIComponent(gid)}&order=updated_at.desc&limit=${Math.max(1, Math.min(200, limit))}`;
  if (status) q += `&status=eq.${encodeURIComponent(status)}`;
  return (await rest('bww_tickets', q)) || [];
}

// Create: Channel-Erstellung + DB (ticket_number, status open, priority normal).
async function createTicket(guild, creator, { typeId = null, panelId = null, reason = null, description = '' } = {}) {
  const gid = guild.id;
  const { getTypeById, getPanelById } = require('./panelService');
  const type = typeId ? await getTypeById(typeId, gid).catch(() => null) : null;
  const panel = panelId ? await getPanelById(panelId, gid).catch(() => null) : null;
  const categoryId = cleanId(type?.category_id || panel?.category_id || '') || null;
  const staffRoleId = cleanId(type?.staff_role_id || panel?.staff_role_id || '') || null;
  if (!categoryId) throw new Error('Keine Ticket-Kategorie konfiguriert (Typ/Panel prüfen).');
  const category = guild.channels.cache.get(categoryId) || await guild.channels.fetch(categoryId).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) throw new Error('Ticket-Kategorie nicht gefunden.');
  const me = guild.members.me;
  if (me && !category.permissionsFor(me)?.has(PermissionFlagsBits.ManageChannels)) throw new Error('Bot braucht ManageChannels in der Ticket-Kategorie.');

  const ticketNumber = await nextTicketNumber(gid);
  const id = generateTicketId();
  const reasonText = clampText(reason || type?.name || 'Support-Anfrage', 200);
  const descText = clampText(description || '', 3000);
  const creatorId = creator.id;

  const overwrites = [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }];
  overwrites.push({ id: creatorId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] });
  if (staffRoleId) overwrites.push({ id: staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] });

  const channel = await guild.channels.create({
    name: `ticket-${String(ticketNumber).padStart(4, '0')}-${sanitizeChannelName(creator.username)}`,
    type: ChannelType.GuildText, parent: category.id, topic: `BWW Ticket #${ticketNumber} · ${reasonText}`.slice(0, 1024),
    permissionOverwrites: overwrites,
  });

  const rows = await rest('bww_tickets', '', {
    method: 'POST',
    body: JSON.stringify({
      id, guild_id: gid, ticket_number: ticketNumber, channel_id: channel.id,
      creator_id: creatorId, owner_id: creatorId, user_id: creatorId,
      type_id: type?.id || null, panel_id: panel?.id || type?.panel_id || null,
      reason: reasonText, description: descText || null,
      status: 'open', priority: 'normal', participant_ids: [creatorId],
    }),
  });
  const ticket = rows?.[0] || { id, guild_id: gid, ticket_number: ticketNumber, channel_id: channel.id, creator_id: creatorId, status: 'open', priority: 'normal' };
  // Member + Action (Kap. Tabellen exakt)
  await rest('bww_ticket_members', '', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ticket_id: id, guild_id: gid, user_id: creatorId, role: 'owner', added_by: creatorId }) }).catch(() => {});
  await recordAction(id, gid, creatorId, 'create', null, 'open', { ticket_number: ticketNumber, type_id: type?.id || null });
  await logAudit({ guildId: gid, actorId: creatorId, action: 'ticket.create', targetId: id, details: { ticket_number: ticketNumber } }).catch(() => {});
  return { ticket, channel, ticketNumber };
}

module.exports = { nextTicketNumber, createTicket, getTicket, getTicketByChannel, listTickets, recordAction, generateTicketId };
