// BWW Phase 5 – Button-Service (05: Button Actions).
// Felder exakt: label/style/emoji/custom_id/action_type/action_data
// (+Phase-2-Kompat: url/disabled/position/embed_id/guild_id/component_id).
// Actions: Nachricht senden, Embed senden, Modal oeffnen, Ticket erstellen, Link oeffnen, Rolle-Aktion, Custom.

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');
const { cleanId, clampText } = require('../../services/validation');
const { assertButtonStyle, assertButtonAction } = require('./constants');

const log = logger.child('embed:buttons');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

function newCustomId() {
  return `bww_embed_btn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`.slice(0, 100);
}

function sanitizeActionData(type, data) {
  const d = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  if (type === 'open_url' && !d.url) throw new Error('Link-Button braucht action_data.url.');
  if (type === 'send_embed' && !d.embed_id && !d.response_embed_id) throw new Error('Embed-Aktion braucht action_data.embed_id.');
  if ((type === 'role_add' || type === 'role_remove' || type === 'role_toggle' || type === 'role_action') && !d.role_id && !d.roleId) throw new Error('Rolle-Aktion braucht action_data.role_id.');
  return d;
}

async function listButtons(filter = {}) {
  let q = '?select=*&order=position.asc&limit=200';
  if (filter.component_id) q += `&component_id=eq.${encodeURIComponent(String(filter.component_id))}`;
  else if (filter.embed_id) q += `&embed_id=eq.${encodeURIComponent(String(filter.embed_id))}`;
  else if (filter.guild_id) q += `&guild_id=eq.${encodeURIComponent(cleanId(filter.guild_id))}`;
  else throw new Error('Filter (component_id/embed_id/guild_id) erforderlich.');
  return (await rest('bww_embed_buttons', q)) || [];
}

async function createButton(input = {}, actorId = null) {
  const label = clampText(input.label || 'Button', 80);
  if (!label.trim()) throw new Error('Button-Label fehlt.');
  const style = assertButtonStyle(input.style || 'secondary');
  const action_type = assertButtonAction(input.action_type || input.actionType || (style === 'link' ? 'open_url' : 'send_message'));
  const action_data = sanitizeActionData(action_type, input.action_data || input.actionData || {});
  const row = {
    component_id: input.component_id || null,
    embed_id: input.embed_id || null,
    guild_id: cleanId(input.guild_id || '') || null,
    label,
    custom_id: style === 'link' ? `bww_link_${Date.now().toString(36)}` : (String(input.custom_id || input.customId || newCustomId()).slice(0, 100) || newCustomId()),
    style,
    url: style === 'link' ? String(input.url || action_data.url || '').slice(0, 512) : null,
    emoji: input.emoji ? clampText(input.emoji, 100) : null,
    disabled: !!input.disabled,
    position: Number.isFinite(Number(input.position)) ? Math.max(0, Number(input.position)) : 0,
    action_type,
    action_data,
  };
  if (!row.embed_id && !row.component_id) throw new Error('embed_id oder component_id erforderlich.');
  if (style === 'link' && !row.url) throw new Error('Link-Button braucht URL.');
  const rows = await rest('bww_embed_buttons', '', { method: 'POST', body: JSON.stringify(row) });
  const created = rows?.[0] || null;
  if (created && row.guild_id) await logAudit({ guildId: row.guild_id, actorId, action: 'embed.button.add', targetId: row.embed_id || row.component_id, details: { label, action_type } }).catch(() => {});
  return created;
}

async function updateButton(id, patch = {}, actorId = null) {
  const cur = (await rest('bww_embed_buttons', `?select=*&id=eq.${encodeURIComponent(String(id))}&limit=1`))?.[0];
  if (!cur) throw new Error('Button nicht gefunden.');
  const body = { updated_at: new Date().toISOString() };
  if (patch.label !== undefined) body.label = clampText(patch.label, 80);
  if (patch.style !== undefined) body.style = assertButtonStyle(patch.style);
  if (patch.emoji !== undefined) body.emoji = patch.emoji ? clampText(patch.emoji, 100) : null;
  if (patch.action_type !== undefined || patch.actionType !== undefined) body.action_type = assertButtonAction(patch.action_type || patch.actionType);
  if (patch.action_data !== undefined || patch.actionData !== undefined) body.action_data = sanitizeActionData(body.action_type || cur.action_type, patch.action_data || patch.actionData);
  if (patch.disabled !== undefined) body.disabled = !!patch.disabled;
  if (patch.position !== undefined) body.position = Math.max(0, Number(patch.position) || 0);
  if (patch.url !== undefined) body.url = String(patch.url || '').slice(0, 512) || null;
  const rows = await rest('bww_embed_buttons', `?id=eq.${encodeURIComponent(String(id))}`, { method: 'PATCH', body: JSON.stringify(body) });
  const updated = rows?.[0] || { ...cur, ...body };
  await logAudit({ guildId: cur.guild_id, actorId, action: 'embed.button.update', targetId: cur.embed_id, details: { button_id: String(id) } }).catch(() => {});
  return updated;
}

async function deleteButton(id, actorId = null) {
  const cur = (await rest('bww_embed_buttons', `?select=*&id=eq.${encodeURIComponent(String(id))}&limit=1`).catch(() => []))?.[0] || null;
  const res = await supabaseRequest(`bww_embed_buttons?id=eq.${encodeURIComponent(String(id))}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
  const rows = await res.json().catch(() => []);
  if (cur?.guild_id) await logAudit({ guildId: cur.guild_id, actorId, action: 'embed.button.delete', targetId: cur.embed_id, details: { button_id: String(id) } }).catch(() => {});
  return (rows?.length || 0) > 0;
}

module.exports = { listButtons, createButton, updateButton, deleteButton, newCustomId };
