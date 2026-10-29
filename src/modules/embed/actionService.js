// BWW Phase 5 – Embed-Action-Service (action_type/action_data an embed/component).
// Validierung + Permissions (Phase 11: BWW-Matrix – Administrator/Owner oder
// bww_guild_roles-Mapping/Discord-Fallback mit embed.*-Aktionsrecht, ersatzweise
// Legacy settings.permissions embed-create/embed-send). Action-Typen:
// send/send_message/send_embed/update/dm/role_*/ticket_create/open_url/modal_open/custom/none.
// Nutzt services (supabase, permissions, logger, audit, validation). Keine Ticket/Welcome-Logik hier
// (nur Validierung; Ausfuehrung liegt in interactionHandler/sendService).

const { PermissionFlagsBits } = require('discord.js');
const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');
const { hasCommandPermission } = require('../../services/permissions');
const { cleanId } = require('../../services/validation');
const { assertEmbedAction } = require('./constants');

const log = logger.child('embed:actions');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

// Phase 11 – vereinheitlicht (vorher: nur Owner/Admin + Legacy embed-create/embed-send).
// Embed-Manager = Owner/Admin ODER BWW-Matrix (bww_guild_roles-Mapping oder
// Discord-Fallback ManageGuild/ManageMessages mit embed.*-Aktionsrecht) ODER Legacy-Mapping.
async function isEmbedManager(member, guildId) {
  if (!member) return false;
  try {
    if (member.id === member.guild?.ownerId) return true;
    if (member.permissions?.has?.(PermissionFlagsBits.Administrator)) return true;
    // Phase 11 Matrix zuerst (einheitlich mit allen Modulen)
    try {
      const { resolveBwwRoles, hasAnyPermission, loadGuildRoleMappings } = require('../../services/permissions');
      const mappings = await loadGuildRoleMappings(guildId).catch(() => []);
      const roles = resolveBwwRoles(member, mappings);
      if (hasAnyPermission(roles, ['embed.create', 'embed.edit', 'embed.send', 'embed.delete', 'embed.templates'])) return true;
    } catch {}
    const { getGuildSettings } = require('../../utils/database');
    const cfg = await getGuildSettings(guildId).catch(() => null);
    const settings = cfg?.settings || cfg;
    if (settings && hasCommandPermission(member, 'embed-create', settings)) return true;
    if (settings && hasCommandPermission(member, 'embed-send', settings)) return true;
  } catch {}
  return false;
}

function validateActionData(type, data) {
  const d = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  switch (type) {
    case 'send_message':
    case 'send':
      if (!d.content && !d.text && !d.message) throw new Error('send braucht action_data.content.');
      break;
    case 'send_embed':
      if (!d.embed_id && !d.response_embed_id) throw new Error('send_embed braucht action_data.embed_id.');
      break;
    case 'open_url':
      if (!d.url) throw new Error('open_url braucht action_data.url.');
      try { const u = new URL(String(d.url)); if (!['http:', 'https:'].includes(u.protocol)) throw new Error(); } catch { throw new Error('Ungueltige URL in action_data.url.'); }
      break;
    case 'role_assign':
    case 'role_remove':
    case 'role_add':
    case 'role_toggle':
    case 'role_action':
      if (!d.role_id && !d.roleId) throw new Error('Rolle-Aktion braucht action_data.role_id.');
      break;
    case 'ticket_create':
      break; // type_id/panel_id optional; Ticket-Modul entscheidet
    case 'modal_open':
      if (!d.title && !d.modal_id) throw new Error('modal_open braucht action_data.title.');
      break;
    case 'dm':
      if (!d.content && !d.text) throw new Error('dm braucht action_data.content.');
      break;
    case 'custom':
    case 'update':
    case 'none':
      break;
    default:
      break;
  }
  return d;
}

async function listActions(embedId, componentId = null) {
  if (!embedId && !componentId) throw new Error('embed_id oder component_id erforderlich.');
  let q = '?select=*&order=created_at.asc&limit=200';
  if (embedId) q += `&embed_id=eq.${encodeURIComponent(String(embedId))}`;
  if (componentId) q += `&component_id=eq.${encodeURIComponent(String(componentId))}`;
  return (await rest('bww_embed_actions', q)) || [];
}

async function createAction(embedId, guildId, input = {}, actorMember = null, actorId = null) {
  const gid = cleanId(guildId);
  if (actorMember && !(await isEmbedManager(actorMember, gid))) throw new Error('Keine Embed-Berechtigung (Administrator oder Embed-Manager).');
  const action_type = assertEmbedAction(input.action_type || input.actionType || 'send_message');
  const action_data = validateActionData(action_type, input.action_data || input.actionData || input.payload || {});
  const payload = input.payload && typeof input.payload === 'object' ? input.payload : action_data;
  const row = {
    embed_id: embedId || input.embed_id || null,
    component_id: input.component_id || input.componentId || null,
    guild_id: gid,
    action_type,
    payload,
    action_data,
    created_by: actorId || actorMember?.id || null,
  };
  if (!row.embed_id) throw new Error('embed_id erforderlich.');
  const rows = await rest('bww_embed_actions', '', { method: 'POST', body: JSON.stringify(row) });
  const created = rows?.[0] || null;
  if (created) await logAudit({ guildId: gid, actorId: row.created_by, action: 'embed.action.create', targetId: row.embed_id, details: { action_type } }).catch(() => {});
  return created;
}

async function deleteAction(id, guildId, actorMember = null, actorId = null) {
  const gid = cleanId(guildId);
  if (actorMember && !(await isEmbedManager(actorMember, gid))) throw new Error('Keine Embed-Berechtigung.');
  const res = await supabaseRequest(`bww_embed_actions?id=eq.${encodeURIComponent(String(id))}&guild_id=eq.${encodeURIComponent(gid)}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
  const rows = await res.json().catch(() => []);
  await logAudit({ guildId: gid, actorId: actorId || actorMember?.id || null, action: 'embed.action.delete', targetId: String(id), details: {} }).catch(() => {});
  return (rows?.length || 0) > 0;
}

module.exports = { isEmbedManager, validateActionData, listActions, createAction, deleteAction };
