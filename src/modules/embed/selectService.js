// BWW Phase 5 – Select-Service (05: jede Option einzeln konfigurierbar).
// Felder exakt: label/description/value/emoji/response_type/response_content/response_embed_id (+Action).
// Beispiel: Support -> eigene Response, Regeln -> eigenes Embed, Ticket -> Ticket-Erstellung, Hilfe -> eigene Response.
// response_type: none/message/embed/ticket/modal/role_action. Nutzt services (supabase, logger, audit, validation).

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');
const { cleanId, clampText } = require('../../services/validation');
const { assertSelectResponse } = require('./constants');

const log = logger.child('embed:select');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

async function listOptions(componentId) {
  if (!componentId) throw new Error('component_id erforderlich.');
  return (await rest('bww_embed_select_options', `?select=*&component_id=eq.${encodeURIComponent(String(componentId))}&order=position.asc&limit=100`)) || [];
}

async function listOptionsByEmbed(embedId) {
  return (await rest('bww_embed_select_options', `?select=*&embed_id=eq.${encodeURIComponent(String(embedId))}&order=position.asc&limit=200`)) || [];
}

function sanitizeOption(input = {}) {
  const label = clampText(input.label || 'Option', 100);
  if (!label.trim()) throw new Error('Option-Label fehlt.');
  const value = clampText(input.value || label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 100) || 'option', 100);
  const response_type = assertSelectResponse(input.response_type || input.responseType || 'message');
  if (response_type === 'embed' && !(input.response_embed_id || input.responseEmbedId)) throw new Error('Response-Typ embed braucht response_embed_id.');
  return {
    label,
    value,
    description: input.description ? clampText(input.description, 100) : null,
    emoji: input.emoji ? clampText(input.emoji, 100) : null,
    is_default: !!input.is_default,
    position: Number.isFinite(Number(input.position)) ? Math.max(0, Number(input.position)) : 0,
    response_type,
    response_content: input.response_content != null ? clampText(input.response_content, 2000) : (input.response != null ? clampText(input.response, 2000) : null),
    response_embed_id: input.response_embed_id || input.responseEmbedId || null,
  };
}

async function createOption(componentId, embedId, guildId, input = {}, actorId = null) {
  if (!componentId && !embedId) throw new Error('component_id oder embed_id erforderlich.');
  const clean = sanitizeOption(input);
  const existing = componentId ? await listOptions(componentId).catch(() => []) : [];
  if (existing.length >= 25) throw new Error('Maximal 25 Optionen pro Select.');
  const row = { component_id: componentId || null, embed_id: embedId || null, guild_id: cleanId(guildId), ...clean };
  if (!row.guild_id) throw new Error('Ungueltige Guild-ID.');
  if (clean.position === 0 && existing.length) row.position = existing.length;
  const rows = await rest('bww_embed_select_options', '', { method: 'POST', body: JSON.stringify(row) });
  const created = rows?.[0] || null;
  if (created) await logAudit({ guildId: row.guild_id, actorId, action: 'embed.select_option.add', targetId: row.embed_id || row.component_id, details: { label: clean.label, response_type: clean.response_type } }).catch(() => {});
  return created;
}

async function updateOption(id, patch = {}, actorId = null) {
  const cur = (await rest('bww_embed_select_options', `?select=*&id=eq.${encodeURIComponent(String(id))}&limit=1`))?.[0];
  if (!cur) throw new Error('Option nicht gefunden.');
  const merged = sanitizeOption({ ...cur, ...patch, response_type: patch.response_type || patch.responseType || cur.response_type });
  const body = { ...merged, updated_at: new Date().toISOString() };
  const rows = await rest('bww_embed_select_options', `?id=eq.${encodeURIComponent(String(id))}`, { method: 'PATCH', body: JSON.stringify(body) });
  const updated = rows?.[0] || { ...cur, ...body };
  await logAudit({ guildId: cur.guild_id, actorId, action: 'embed.select_option.update', targetId: cur.embed_id, details: { option_id: String(id) } }).catch(() => {});
  return updated;
}

async function deleteOption(id, actorId = null) {
  const cur = (await rest('bww_embed_select_options', `?select=*&id=eq.${encodeURIComponent(String(id))}&limit=1`).catch(() => []))?.[0] || null;
  const res = await supabaseRequest(`bww_embed_select_options?id=eq.${encodeURIComponent(String(id))}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
  const rows = await res.json().catch(() => []);
  if (cur?.guild_id) await logAudit({ guildId: cur.guild_id, actorId, action: 'embed.select_option.delete', targetId: cur.embed_id, details: { option_id: String(id) } }).catch(() => {});
  return (rows?.length || 0) > 0;
}

module.exports = { listOptions, listOptionsByEmbed, createOption, updateOption, deleteOption };
