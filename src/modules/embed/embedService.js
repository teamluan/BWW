// BWW Phase 5 – Embed-Service (CRUD, 05_EMBED_V2.md: bww_embeds).
// Felder exakt: name/description/enabled/created_by (+guild_id/id/created_at/updated_at).
// Phase-2-Kompat: embed_key/title/color/status/channel_id/message_id bleiben lesbar,
// neue Writes pflegen beide Modelle (name<->title/embed_key, enabled<->status).
// Klonbar + als Template speicherbar (legacy bww_embed_templates, lesend erhalten).
// Nutzt NUR src/services (supabase, logger, audit, validation). Kein Welcome/Giveaway-Code hier.

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');
const { cleanId, clampText } = require('../../services/validation');

const log = logger.child('embed:service');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

function slugify(name) {
  return String(name || 'embed').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'embed';
}

function normalizeRow(row) {
  if (!row) return null;
  const name = row.name || row.title || row.embed_key || 'embed';
  const enabled = row.enabled !== undefined ? row.enabled !== false : row.status !== 'archived';
  return { ...row, name, enabled };
}

async function listEmbeds(guildId, { onlyEnabled = false } = {}) {
  const gid = cleanId(guildId);
  if (!gid) throw new Error('Ungueltige Guild-ID.');
  let q = `?select=*&guild_id=eq.${encodeURIComponent(gid)}&order=updated_at.desc&limit=200`;
  if (onlyEnabled) q += '&enabled=eq.true';
  const rows = (await rest('bww_embeds', q)) || [];
  return rows.map(normalizeRow);
}

async function getEmbed(id, guildId = null) {
  const rows = await rest('bww_embeds', `?select=*&id=eq.${encodeURIComponent(String(id))}${guildId ? `&guild_id=eq.${encodeURIComponent(cleanId(guildId))}` : ''}&limit=1`);
  return normalizeRow(rows?.[0] || null);
}

async function getEmbedByKey(guildId, key) {
  const gid = cleanId(guildId);
  const k = slugify(key);
  const byKey = await rest('bww_embeds', `?select=*&guild_id=eq.${encodeURIComponent(gid)}&embed_key=eq.${encodeURIComponent(k)}&limit=1`).catch(() => []);
  if (byKey?.[0]) return normalizeRow(byKey[0]);
  const byName = await rest('bww_embeds', `?select=*&guild_id=eq.${encodeURIComponent(gid)}&name=eq.${encodeURIComponent(String(key).slice(0, 200))}&limit=1`).catch(() => []);
  return normalizeRow(byName?.[0] || null);
}

async function createEmbed(guildId, data = {}, actorId = null) {
  const gid = cleanId(guildId);
  if (!gid) throw new Error('Ungueltige Guild-ID.');
  const name = clampText(data.name || 'embed', 200);
  if (name.trim().length < 1) throw new Error('Embed-Name fehlt.');
  const enabled = data.enabled !== false;
  const key = slugify(data.embed_key || name);
  const row = {
    guild_id: gid,
    embed_key: key,
    title: name.slice(0, 256),
    name: name.slice(0, 200),
    description: data.description != null ? clampText(data.description, 4000) : null,
    color: /^#[0-9a-f]{6}$/i.test(String(data.color || '')) ? String(data.color) : '#5865F2',
    status: enabled ? 'published' : 'draft',
    enabled,
    channel_id: data.channel_id ? cleanId(data.channel_id) || null : null,
    message_id: data.message_id ? cleanId(data.message_id) || null : null,
    created_by: actorId ? String(actorId).slice(0, 100) : null,
    updated_by: actorId ? String(actorId).slice(0, 100) : null,
  };
  const rows = await rest('bww_embeds', '', { method: 'POST', body: JSON.stringify(row) });
  const created = normalizeRow(rows?.[0] || null);
  if (created) await logAudit({ guildId: gid, actorId, action: 'embed.create', targetId: created.id, details: { name } }).catch(() => {});
  log.info('Embed erstellt:', gid, name);
  return created;
}

async function updateEmbed(id, guildId, patch = {}, actorId = null) {
  const gid = cleanId(guildId);
  const existing = await getEmbed(id, gid);
  if (!existing) throw new Error('Embed nicht gefunden.');
  const body = { updated_at: new Date().toISOString(), updated_by: actorId ? String(actorId).slice(0, 100) : existing.updated_by };
  if (patch.name !== undefined) { const n = clampText(patch.name, 200); if (!n.trim()) throw new Error('Ungueltiger Name.'); body.name = n; body.title = n.slice(0, 256); body.embed_key = slugify(n); }
  if (patch.description !== undefined) body.description = patch.description == null ? null : clampText(patch.description, 4000);
  if (patch.enabled !== undefined) { body.enabled = patch.enabled !== false; body.status = body.enabled ? 'published' : 'draft'; }
  if (patch.color !== undefined && /^#[0-9a-f]{6}$/i.test(String(patch.color))) body.color = String(patch.color);
  if (patch.channel_id !== undefined) body.channel_id = patch.channel_id ? cleanId(patch.channel_id) || null : null;
  if (patch.message_id !== undefined) body.message_id = patch.message_id ? cleanId(patch.message_id) || null : null;
  const rows = await rest('bww_embeds', `?id=eq.${encodeURIComponent(String(id))}&guild_id=eq.${encodeURIComponent(gid)}`, { method: 'PATCH', body: JSON.stringify(body) });
  const updated = normalizeRow(rows?.[0] || { ...existing, ...body });
  await logAudit({ guildId: gid, actorId, action: 'embed.update', targetId: String(id), details: { name: updated.name } }).catch(() => {});
  return updated;
}

async function deleteEmbed(id, guildId, actorId = null) {
  const gid = cleanId(guildId);
  const res = await supabaseRequest(`bww_embeds?id=eq.${encodeURIComponent(String(id))}&guild_id=eq.${encodeURIComponent(gid)}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
  const rows = await res.json().catch(() => []);
  await logAudit({ guildId: gid, actorId, action: 'embed.delete', targetId: String(id), details: {} }).catch(() => {});
  return (rows?.length || 0) > 0;
}

async function getFullEmbed(id, guildId = null) {
  const embed = await getEmbed(id, guildId);
  if (!embed) throw new Error('Embed nicht gefunden.');
  const gid = embed.guild_id;
  const [components, buttons, options, actions] = await Promise.all([
    rest('bww_embed_components', `?select=*&embed_id=eq.${encodeURIComponent(embed.id)}&order=position.asc&limit=100`).catch(() => []),
    rest('bww_embed_buttons', `?select=*&embed_id=eq.${encodeURIComponent(embed.id)}&order=position.asc&limit=100`).catch(() => []),
    rest('bww_embed_select_options', `?select=*&embed_id=eq.${encodeURIComponent(embed.id)}&order=position.asc&limit=200`).catch(() => []),
    rest('bww_embed_actions', `?select=*&embed_id=eq.${encodeURIComponent(embed.id)}&order=created_at.asc&limit=200`).catch(() => []),
  ]);
  return { embed, components: components || [], buttons: buttons || [], options: options || [], actions: actions || [], guild_id: gid };
}

async function cloneEmbed(id, guildId, newName, actorId = null) {
  const gid = cleanId(guildId);
  const full = await getFullEmbed(id, gid);
  if (full.embed.guild_id !== gid) throw new Error('Embed gehoert zu anderem Server.');
  const name = clampText(newName || `${full.embed.name}-kopie`, 200);
  const created = await createEmbed(gid, { name, description: full.embed.description, enabled: false }, actorId);
  // Komponenten tief klonen (Position + data erhalten)
  const compIdMap = new Map();
  for (const c of full.components) {
    const rows = await rest('bww_embed_components', '', {
      method: 'POST',
      body: JSON.stringify({ embed_id: created.id, guild_id: gid, component_type: c.component_type, position: c.position ?? 0, data: c.data || {} }),
    }).catch(() => []);
    if (rows?.[0]) compIdMap.set(c.id, rows[0].id);
  }
  for (const b of full.buttons) {
    await rest('bww_embed_buttons', '', {
      method: 'POST',
      body: JSON.stringify({
        component_id: (b.component_id && compIdMap.get(b.component_id)) || null, embed_id: created.id, guild_id: gid,
        label: b.label, custom_id: `bww_embed_btn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        style: b.style || 'secondary', url: b.url || null, emoji: b.emoji || null, disabled: !!b.disabled,
        action_type: b.action_type || 'send_message', action_data: b.action_data || {}, position: b.position ?? 0,
      }),
    }).catch(() => []);
  }
  for (const o of full.options) {
    await rest('bww_embed_select_options', '', {
      method: 'POST',
      body: JSON.stringify({
        component_id: (o.component_id && compIdMap.get(o.component_id)) || null, embed_id: created.id, guild_id: gid,
        label: o.label, value: o.value, description: o.description || null, emoji: o.emoji || null,
        is_default: !!o.is_default, position: o.position ?? 0,
        response_type: o.response_type || 'message', response_content: o.response_content || null, response_embed_id: o.response_embed_id || null,
      }),
    }).catch(() => []);
  }
  for (const a of full.actions) {
    await rest('bww_embed_actions', '', {
      method: 'POST',
      body: JSON.stringify({
        embed_id: created.id, component_id: (a.component_id && compIdMap.get(a.component_id)) || null, guild_id: gid,
        action_type: a.action_type, payload: a.payload || {}, action_data: a.action_data || a.payload || {}, created_by: actorId,
      }),
    }).catch(() => []);
  }
  await logAudit({ guildId: gid, actorId, action: 'embed.clone', targetId: created.id, details: { from: String(id), name } }).catch(() => {});
  return created;
}

// Als Template speicherbar: schreibt in legacy bww_embed_templates (guild_id/name/data),
// damit altes Dashboard (website/app/embeds) weiterliest. Neues Modell bleibt fuehrend.
async function saveAsTemplate(embedId, guildId, templateName = null, actorId = null) {
  const full = await getFullEmbed(embedId, guildId);
  const name = slugify(templateName || full.embed.name).slice(0, 64);
  const data = {
    title: full.embed.name, description: full.embed.description || '', color: (full.embed.color || '#5865F2').replace('#', ''),
    components: (full.components || []).map((c) => ({ type: c.component_type === 'media_gallery' ? 'media_gallery' : c.component_type, ...(c.data || {}) })),
  };
  const rows = await rest('bww_embed_templates', '?on_conflict=guild_id,name', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ guild_id: full.embed.guild_id, name, data, created_by: actorId, updated_by: actorId, updated_at: new Date().toISOString() }),
  });
  await logAudit({ guildId: full.embed.guild_id, actorId, action: 'embed.save_template', targetId: full.embed.id, details: { template: name } }).catch(() => {});
  return rows?.[0] || null;
}

// Wiederverwendbarkeit (01_ARCHITECTURE Kap.5): Welcome -> Embed V2.
// Liefert erstes aktives Embed (bevorzugt Key 'welcome'), KEINE Welcome-Logik hier.
async function getEmbedForWelcome(guildId) {
  const gid = cleanId(guildId);
  const preferred = await getEmbedByKey(gid, 'welcome').catch(() => null);
  if (preferred && preferred.enabled !== false) return preferred;
  const list = await listEmbeds(gid, { onlyEnabled: true }).catch(() => []);
  return list?.[0] || null;
}

module.exports = { listEmbeds, getEmbed, getEmbedByKey, createEmbed, updateEmbed, deleteEmbed, getFullEmbed, cloneEmbed, saveAsTemplate, getEmbedForWelcome };
