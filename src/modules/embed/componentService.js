// BWW Phase 5 – Component-Service (05: container/section/text/thumbnail/media gallery/separator/button/select/action row).
// Felder exakt: embed_id/component_type/position/data. Nutzt services (supabase, logger, audit, validation).

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');
const { cleanId } = require('../../services/validation');
const { assertComponentType } = require('./constants');

const log = logger.child('embed:components');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

async function requireEmbed(embedId, guildId) {
  const { getEmbed } = require('./embedService');
  const e = await getEmbed(embedId, guildId);
  if (!e) throw new Error('Embed nicht gefunden.');
  return e;
}

async function listComponents(embedId, guildId = null) {
  const rows = await rest('bww_embed_components', `?select=*&embed_id=eq.${encodeURIComponent(String(embedId))}&order=position.asc&limit=100`);
  const list = rows || [];
  if (guildId) return list.filter((r) => !r.guild_id || String(r.guild_id) === String(cleanId(guildId)));
  return list;
}

async function getComponent(id) {
  const rows = await rest('bww_embed_components', `?select=*&id=eq.${encodeURIComponent(String(id))}&limit=1`);
  return rows?.[0] || null;
}

function sanitizeData(type, data) {
  const d = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  // Minimal-Normalisierung je Typ (05 Builder): Text braucht content, Section texts[], Gallery items[], Separator divider/spacing
  if (type === 'text' && !d.content) d.content = '';
  if (type === 'section' && !Array.isArray(d.texts)) d.texts = d.content ? [String(d.content).slice(0, 4000)] : [''];
  if ((type === 'media' || type === 'media_gallery' || type === 'gallery') && !Array.isArray(d.items)) d.items = d.url ? [{ url: String(d.url).slice(0, 1000) }] : [];
  if (type === 'separator') { if (d.divider === undefined) d.divider = true; if (!d.spacing) d.spacing = 'small'; }
  return d;
}

async function createComponent(embedId, guildId, input = {}, actorId = null) {
  const embed = await requireEmbed(embedId, guildId);
  const gid = embed.guild_id;
  const type = assertComponentType(input.component_type || input.type);
  const existing = await listComponents(embed.id).catch(() => []);
  if (existing.length >= 40) throw new Error('Discord erlaubt maximal 40 Komponenten pro Nachricht.');
  const position = Number.isFinite(Number(input.position)) ? Math.max(0, Math.min(39, Number(input.position))) : existing.length;
  const data = sanitizeData(type, input.data || input);
  const rows = await rest('bww_embed_components', '', {
    method: 'POST',
    body: JSON.stringify({ embed_id: embed.id, guild_id: gid, component_type: type, position, data }),
  });
  const created = rows?.[0] || null;
  if (created) await logAudit({ guildId: gid, actorId, action: 'embed.component.add', targetId: embed.id, details: { type, component_id: created.id } }).catch(() => {});
  return created;
}

async function updateComponent(id, guildId, patch = {}, actorId = null) {
  const current = await getComponent(id);
  if (!current) throw new Error('Komponente nicht gefunden.');
  if (guildId && current.guild_id && String(current.guild_id) !== String(cleanId(guildId))) throw new Error('Komponente gehoert zu anderem Server.');
  const body = { updated_at: new Date().toISOString() };
  if (patch.component_type !== undefined || patch.type !== undefined) body.component_type = assertComponentType(patch.component_type || patch.type);
  if (patch.position !== undefined) body.position = Math.max(0, Math.min(39, Number(patch.position) || 0));
  if (patch.data !== undefined) body.data = sanitizeData(body.component_type || current.component_type, patch.data);
  const rows = await rest('bww_embed_components', `?id=eq.${encodeURIComponent(String(id))}`, { method: 'PATCH', body: JSON.stringify(body) });
  const updated = rows?.[0] || { ...current, ...body };
  await logAudit({ guildId: current.guild_id, actorId, action: 'embed.component.update', targetId: current.embed_id, details: { component_id: String(id) } }).catch(() => {});
  return updated;
}

async function deleteComponent(id, guildId = null, actorId = null) {
  const current = await getComponent(id).catch(() => null);
  const q = `?id=eq.${encodeURIComponent(String(id))}${guildId ? `&guild_id=eq.${encodeURIComponent(cleanId(guildId))}` : ''}`;
  const res = await supabaseRequest(`bww_embed_components${q}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
  const rows = await res.json().catch(() => []);
  if (current) await logAudit({ guildId: current.guild_id, actorId, action: 'embed.component.delete', targetId: current.embed_id, details: { component_id: String(id) } }).catch(() => {});
  return (rows?.length || 0) > 0;
}

module.exports = { listComponents, getComponent, createComponent, updateComponent, deleteComponent };
