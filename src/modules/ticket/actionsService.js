// BWW Phase 3 – Ticket-Aktionen (Claim/Unclaim, Member, Rename, Priority,
// Close/Reopen/Delete). Schreibt bww_ticket_actions(actor/action/old/new) +
// Audit-Log. Status/Priority NUR aus erlaubten Werten. Permissions (Phase 11):
// explizite Staff-Rolle (Typ/Panel) oder Administrator/Owner oder BWW-Matrix
// (support/moderator/manager+ via bww_guild_roles-Mapping oder Discord-Fallback
// mit ticket.*-Aktionsrecht) oder Legacy-Ticket-Rolle/-Mapping. Channel-Permissions
// werden synchron gehalten. Close erlaubt zusaetzlich Ersteller-Self-Close
// (wenn Guild-Settings allowUserClose, Service-Layer entscheidet).
// Phase 14: Best-Effort Notification ticket_closed (nie werfend, keine Logik-Aenderung).

const { PermissionFlagsBits } = require('discord.js');
const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');
const { hasCommandPermission } = require('../../services/permissions');
const { cleanId, clampText } = require('../../services/validation');
const { assertStatus, assertPriority } = require('./constants');

const log = logger.child('ticket:actions');

// Phase 11: kurzer Cache fuer bww_guild_roles-Mappings (wie Settings-Cache 5s).
const _roleMapCache = new Map();
async function loadMappingsCached(guildId) {
  try {
    const now = Date.now();
    const hit = _roleMapCache.get(String(guildId));
    if (hit && hit.expiresAt > now) return hit.rows;
    const { loadGuildRoleMappings } = require('../../services/permissions');
    const rows = await loadGuildRoleMappings(guildId).catch(() => []);
    _roleMapCache.set(String(guildId), { rows, expiresAt: now + 5000 });
    return rows;
  } catch { return []; }
}

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

async function fetchTicket(id, guildId) {
  const { getTicket } = require('./ticketService');
  const t = await getTicket(id, guildId);
  if (!t) throw new Error('Ticket nicht gefunden.');
  return t;
}

async function resolveStaffRole(guildId, ticket) {
  try {
    if (ticket?.type_id) {
      const { getTypeById } = require('./panelService');
      const type = await getTypeById(ticket.type_id, guildId).catch(() => null);
      if (type?.staff_role_id) return cleanId(type.staff_role_id);
    }
    if (ticket?.panel_id) {
      const { getPanelById } = require('./panelService');
      const panel = await getPanelById(ticket.panel_id, guildId).catch(() => null);
      if (panel?.staff_role_id) return cleanId(panel.staff_role_id);
    }
  } catch {}
  return null;
}

// Phase 11 – vereinheitlicht (vorher: staff_role/Admin/Legacy-Rolle + hasCommandPermission).
// Staff = Owner/Admin ODER Typ-/Panel-Staff-Rolle ODER Legacy-Ticket-Rolle ODER
// BWW-Matrix (bww_guild_roles-Mapping oder Discord-Fallback ManageGuild/ModerateMembers/
// ManageMessages/ManageRoles mit ticket.*-Aktionsrecht) ODER Legacy-Command-Mapping.
async function isStaff(member, guildId, ticket = null) {
  if (!member) return false;
  try {
    if (member.id === member.guild?.ownerId) return true;
    if (member.permissions?.has?.(PermissionFlagsBits.Administrator)) return true;
    const staffRole = ticket ? await resolveStaffRole(guildId, ticket) : null;
    if (staffRole && member.roles?.cache?.has?.(staffRole)) return true;
    // Fallback: zentrale Permissions (settings.permissions) + Legacy ticket-Rolle
    const { getGuildSettings } = require('../../utils/database');
    const cfg = await getGuildSettings(guildId).catch(() => null);
    if (cfg?.ticket?.roleId && member.roles?.cache?.has?.(cfg.ticket.roleId)) return true;
    // Phase 11 Matrix: bww_guild_roles-Mapping oder Discord-Fallback mit ticket.*-Recht
    try {
      const { resolveBwwRoles, hasAnyPermission } = require('../../services/permissions');
      const mappings = await loadMappingsCached(guildId);
      const roles = resolveBwwRoles(member, mappings);
      if (hasAnyPermission(roles, ['ticket.manage', 'ticket.claim', 'ticket.close', 'ticket.reopen', 'ticket.members', 'ticket.transcript', 'ticket.delete', 'ticket.settings'])) return true;
    } catch {}
    if (cfg && hasCommandPermission(member, 'ticket', cfg)) return true;
  } catch {}
  return false;
}

async function patchTicket(id, patch) {
  const rows = await rest('bww_tickets', `?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) });
  return rows?.[0] || null;
}

async function writeAction(ticketId, guildId, actorId, action, oldValue, newValue, details = {}) {
  const { recordAction } = require('./ticketService');
  await recordAction(ticketId, guildId, actorId, action, oldValue, newValue, details);
  await logAudit({ guildId, actorId, action: `ticket.${action}`, targetId: ticketId, details: { old: oldValue, new: newValue, ...details } }).catch(() => {});
}

async function claimTicket(client, ticketId, member) {
  const ticket = await fetchTicket(ticketId, member.guild.id);
  if (!(await isStaff(member, member.guild.id, ticket))) throw new Error('Nur das Support-Team darf Tickets übernehmen.');
  if (['closed', 'deleted'].includes(ticket.status)) throw new Error('Ticket ist bereits geschlossen.');
  const updated = await patchTicket(ticket.id, { status: 'claimed', claimed_by: member.id });
  await writeAction(ticket.id, ticket.guild_id, member.id, 'claim', ticket.claimed_by || null, member.id);
  return updated || { ...ticket, status: 'claimed', claimed_by: member.id };
}

async function unclaimTicket(client, ticketId, member) {
  const ticket = await fetchTicket(ticketId, member.guild.id);
  if (!(await isStaff(member, member.guild.id, ticket))) throw new Error('Nur das Support-Team darf Tickets freigeben.');
  const updated = await patchTicket(ticket.id, { status: 'open', claimed_by: null });
  await writeAction(ticket.id, ticket.guild_id, member.id, 'unclaim', ticket.claimed_by || null, null);
  return updated || { ...ticket, status: 'open', claimed_by: null };
}

async function addMember(client, ticketId, member, targetUserId) {
  const ticket = await fetchTicket(ticketId, member.guild.id);
  if (!(await isStaff(member, member.guild.id, ticket))) throw new Error('Nur das Support-Team darf Mitglieder hinzufügen.');
  if (['closed', 'deleted'].includes(ticket.status)) throw new Error('Ticket ist geschlossen.');
  const uid = cleanId(targetUserId);
  if (!uid) throw new Error('Ungültige Benutzer-ID.');
  const channel = ticket.channel_id ? await client.channels.fetch(ticket.channel_id).catch(() => null) : null;
  if (channel?.isTextBased()) await channel.permissionOverwrites.edit(uid, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
  await rest('bww_ticket_members', '', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ticket_id: ticket.id, guild_id: ticket.guild_id, user_id: uid, role: 'member', added_by: member.id }) }).catch(() => {});
  await writeAction(ticket.id, ticket.guild_id, member.id, 'add', null, uid);
  return true;
}

async function removeMember(client, ticketId, member, targetUserId) {
  const ticket = await fetchTicket(ticketId, member.guild.id);
  if (!(await isStaff(member, member.guild.id, ticket))) throw new Error('Nur das Support-Team darf Mitglieder entfernen.');
  const uid = cleanId(targetUserId);
  if (!uid || uid === ticket.creator_id || uid === ticket.owner_id) throw new Error('Ersteller kann nicht entfernt werden.');
  const channel = ticket.channel_id ? await client.channels.fetch(ticket.channel_id).catch(() => null) : null;
  if (channel?.isTextBased()) await channel.permissionOverwrites.delete(uid).catch(() => {});
  await supabaseRequest(`bww_ticket_members?ticket_id=eq.${encodeURIComponent(ticket.id)}&user_id=eq.${encodeURIComponent(uid)}`, { method: 'DELETE' }).catch(() => {});
  await writeAction(ticket.id, ticket.guild_id, member.id, 'remove', uid, null);
  return true;
}

async function renameTicket(client, ticketId, member, newName) {
  const ticket = await fetchTicket(ticketId, member.guild.id);
  if (!(await isStaff(member, member.guild.id, ticket))) throw new Error('Nur das Support-Team darf umbenennen.');
  const safe = String(newName || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  if (safe.length < 2) throw new Error('Ungültiger Name.');
  const channel = ticket.channel_id ? await client.channels.fetch(ticket.channel_id).catch(() => null) : null;
  if (!channel?.isTextBased()) throw new Error('Ticket-Channel nicht gefunden.');
  const old = channel.name;
  await channel.setName(`ticket-${safe}`).catch(() => { throw new Error('Umbenennen fehlgeschlagen (Rechte?).'); });
  await writeAction(ticket.id, ticket.guild_id, member.id, 'rename', old, `ticket-${safe}`);
  return `ticket-${safe}`;
}

async function setPriority(client, ticketId, member, priority) {
  assertPriority(priority);
  const ticket = await fetchTicket(ticketId, member.guild.id);
  if (!(await isStaff(member, member.guild.id, ticket))) throw new Error('Nur das Support-Team darf die Priorität ändern.');
  if (['closed', 'deleted'].includes(ticket.status)) throw new Error('Ticket ist geschlossen.');
  const updated = await patchTicket(ticket.id, { priority });
  await writeAction(ticket.id, ticket.guild_id, member.id, 'priority', ticket.priority, priority);
  return updated || { ...ticket, priority };
}

async function setStatusPending(client, ticketId, member) {
  const ticket = await fetchTicket(ticketId, member.guild.id);
  if (!(await isStaff(member, member.guild.id, ticket))) throw new Error('Nur das Support-Team.');
  const updated = await patchTicket(ticket.id, { status: assertStatus('pending') });
  await writeAction(ticket.id, ticket.guild_id, member.id, 'pending', ticket.status, 'pending');
  return updated;
}

async function closeTicket(client, ticketId, memberOrSystem, reason = 'Kein Grund angegeben') {
  const actorId = typeof memberOrSystem === 'string' ? memberOrSystem : memberOrSystem?.id;
  const guildId = typeof memberOrSystem === 'string' ? null : memberOrSystem?.guild?.id;
  const ticket = await fetchTicket(ticketId, guildId || memberOrSystem?.guild?.id || (await getTicketGuild(ticketId)));
  if (memberOrSystem?.guild && !(await isStaff(memberOrSystem, ticket.guild_id, ticket))) {
    // Ersteller darf selbst schließen wenn in Guild-Settings erlaubt (Legacy allowUserClose)
    const { getGuildSettings } = require('../../utils/database');
    const cfg = await getGuildSettings(ticket.guild_id).catch(() => null);
    const ownClose = cfg?.ticket?.allowUserClose !== false && (memberOrSystem.id === ticket.creator_id || memberOrSystem.id === ticket.owner_id);
    if (!ownClose) throw new Error('Du darfst dieses Ticket nicht schließen.');
  }
  if (ticket.status === 'closed') throw new Error('Ticket ist bereits geschlossen.');
  const cleanReason = clampText(reason || 'Kein Grund angegeben', 1000);
  const updated = await patchTicket(ticket.id, { status: 'closed', closed_by: actorId || null, closed_at: new Date().toISOString(), close_reason: cleanReason });
  await writeAction(ticket.id, ticket.guild_id, actorId, 'close', ticket.status, 'closed', { reason: cleanReason });
  // Phase 14: Best-Effort Notification ticket_closed (nie werfend, keine Business-Logik-Aenderung).
  try { const { notifyTicketClosed } = require('../../services/notifications'); notifyTicketClosed(ticket.guild_id, ticket.ticket_number ?? ticket.id, ticket.id).catch(() => {}); } catch {}
  return updated || { ...ticket, status: 'closed' };
}

async function getTicketGuild(ticketId) {
  try {
    const rows = await rest('bww_tickets', `?select=guild_id&id=eq.${encodeURIComponent(ticketId)}&limit=1`);
    return rows?.[0]?.guild_id || null;
  } catch { return null; }
}

async function reopenTicket(client, ticketId, member) {
  const ticket = await fetchTicket(ticketId, member.guild.id);
  if (!(await isStaff(member, member.guild.id, ticket))) throw new Error('Nur das Support-Team darf wieder öffnen.');
  if (ticket.status !== 'closed') throw new Error('Nur geschlossene Tickets können geöffnet werden.');
  const updated = await patchTicket(ticket.id, { status: 'open', closed_at: null, closed_by: null, close_reason: null, reopened_at: new Date().toISOString() });
  // Channel-Zugriff wiederherstellen (falls noch vorhanden)
  const channel = ticket.channel_id ? await client.channels.fetch(ticket.channel_id).catch(() => null) : null;
  if (channel?.isTextBased()) {
    const { getTypeById, getPanelById } = require('./panelService');
    const type = ticket.type_id ? await getTypeById(ticket.type_id, ticket.guild_id).catch(() => null) : null;
    const panel = ticket.panel_id ? await getPanelById(ticket.panel_id, ticket.guild_id).catch(() => null) : null;
    const staffRole = cleanId(type?.staff_role_id || panel?.staff_role_id || '');
    await channel.permissionOverwrites.edit(ticket.creator_id || ticket.owner_id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
    if (staffRole) await channel.permissionOverwrites.edit(staffRole, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
  }
  await writeAction(ticket.id, ticket.guild_id, member.id, 'reopen', 'closed', 'open');
  return updated || { ...ticket, status: 'open' };
}

async function deleteTicket(client, ticketId, member, { deleteChannel = true } = {}) {
  const ticket = await fetchTicket(ticketId, member.guild.id);
  if (!(await isStaff(member, member.guild.id, ticket))) throw new Error('Nur das Support-Team darf löschen.');
  const updated = await patchTicket(ticket.id, { status: assertStatus('deleted') });
  await writeAction(ticket.id, ticket.guild_id, member.id, 'delete', ticket.status, 'deleted');
  if (deleteChannel && ticket.channel_id) {
    const channel = await client.channels.fetch(ticket.channel_id).catch(() => null);
    if (channel) await channel.delete('BWW Ticket gelöscht').catch((e) => log.warn('Channel-Löschen fehlgeschlagen:', e.message));
  }
  return updated || { ...ticket, status: 'deleted' };
}

module.exports = { isStaff, claimTicket, unclaimTicket, addMember, removeMember, renameTicket, setPriority, setStatusPending, closeTicket, reopenTicket, deleteTicket };
