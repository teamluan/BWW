// BWW Phase 6 - Welcome-Service (Config CRUD, 06_WELCOME.md: bww_welcome).
// Felder exakt: enabled/channel_id/message/embed_id/dm_enabled/dm_message/
// auto_role_enabled/auto_role_id/delete_after (+guild_id/id/created_at/updated_at).
// Legacy-Spalten title/banner_url/status bleiben lesbar, Writes pflegen enabled<->status.
// Nutzt NUR src/services (supabase, logger, audit, validation).

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');
const { cleanId, isSnowflake, clampText } = require('../../services/validation');
const { MESSAGE_MAX, DEFAULT_MESSAGE, assertDeleteAfter } = require('./constants');

const log = logger.child('welcome:service');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

function normalizeRow(row) {
  if (!row) return null;
  const enabled = row.enabled !== undefined ? row.enabled !== false : row.status !== 'inactive';
  return {
    ...row,
    enabled,
    channel_id: row.channel_id || null,
    message: row.message != null ? String(row.message) : DEFAULT_MESSAGE,
    embed_id: row.embed_id || null,
    dm_enabled: Boolean(row.dm_enabled),
    dm_message: row.dm_message != null ? String(row.dm_message) : null,
    auto_role_enabled: Boolean(row.auto_role_enabled),
    auto_role_id: row.auto_role_id || null,
    delete_after: Number(row.delete_after ?? 0) || 0,
  };
}

async function getWelcomeConfig(guildId) {
  const gid = cleanId(guildId);
  if (!isSnowflake(gid)) throw new Error('Ungueltige Guild-ID.');
  const rows = await rest('bww_welcome', `?select=*&guild_id=eq.${encodeURIComponent(gid)}&limit=1`);
  return normalizeRow(rows?.[0] || null);
}

function sanitizeInput(data = {}) {
  const out = {};
  if (data.channel_id !== undefined || data.channelId !== undefined) {
    const cid = cleanId(data.channel_id ?? data.channelId ?? '');
    if (cid && !isSnowflake(cid)) throw new Error('Ungueltige Channel-ID.');
    out.channel_id = cid || null;
  }
  if (data.message !== undefined) {
    out.message = data.message == null ? null : clampText(data.message, MESSAGE_MAX);
  }
  if (data.embed_id !== undefined || data.embedId !== undefined) {
    const raw = String(data.embed_id ?? data.embedId ?? '').trim().slice(0, 100);
    out.embed_id = raw || null;
  }
  if (data.dm_enabled !== undefined || data.dmEnabled !== undefined) {
    out.dm_enabled = Boolean(data.dm_enabled ?? data.dmEnabled);
  }
  if (data.dm_message !== undefined || data.dmMessage !== undefined) {
    const raw = data.dm_message ?? data.dmMessage;
    out.dm_message = raw == null || String(raw).trim() === '' ? null : clampText(raw, MESSAGE_MAX);
  }
  if (data.auto_role_enabled !== undefined || data.autoRoleEnabled !== undefined) {
    out.auto_role_enabled = Boolean(data.auto_role_enabled ?? data.autoRoleEnabled);
  }
  if (data.auto_role_id !== undefined || data.autoRoleId !== undefined) {
    const rid = cleanId(data.auto_role_id ?? data.autoRoleId ?? '');
    if (rid && !isSnowflake(rid)) throw new Error('Ungueltige Rollen-ID.');
    out.auto_role_id = rid || null;
  }
  if (data.delete_after !== undefined || data.deleteAfter !== undefined) {
    out.delete_after = assertDeleteAfter(data.delete_after ?? data.deleteAfter ?? 0);
  }
  if (data.enabled !== undefined) out.enabled = Boolean(data.enabled);
  return out;
}

async function upsertWelcomeConfig(guildId, data = {}, actorId = null) {
  const gid = cleanId(guildId);
  if (!isSnowflake(gid)) throw new Error('Ungueltige Guild-ID.');
  const clean = sanitizeInput(data);
  const payload = {
    guild_id: gid,
    ...clean,
    status: (clean.enabled !== undefined ? clean.enabled : true) ? 'active' : 'inactive',
    updated_at: new Date().toISOString(),
  };
  if (payload.message == null) payload.message = DEFAULT_MESSAGE;
  const rows = await rest('bww_welcome', '?on_conflict=guild_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload),
  });
  const created = normalizeRow(rows?.[0] || null);
  await logAudit({ guildId: gid, actorId, action: 'welcome.upsert', targetId: created?.id || gid, details: { enabled: created?.enabled } }).catch(() => {});
  log.info('Welcome gespeichert:', gid, created?.enabled ? 'aktiv' : 'inaktiv');
  return created;
}

async function updateWelcomeConfig(guildId, patch = {}, actorId = null) {
  const gid = cleanId(guildId);
  const existing = await getWelcomeConfig(gid);
  if (!existing) return upsertWelcomeConfig(gid, patch, actorId);
  const clean = sanitizeInput(patch);
  const body = { ...clean, updated_at: new Date().toISOString() };
  if (clean.enabled !== undefined) body.status = clean.enabled ? 'active' : 'inactive';
  const rows = await rest('bww_welcome', `?guild_id=eq.${encodeURIComponent(gid)}`, { method: 'PATCH', body: JSON.stringify(body) });
  const updated = normalizeRow(rows?.[0] || { ...existing, ...body });
  await logAudit({ guildId: gid, actorId, action: 'welcome.update', targetId: updated?.id || gid, details: {} }).catch(() => {});
  return updated;
}

async function setEnabled(guildId, enabled, actorId = null) {
  const gid = cleanId(guildId);
  if (!isSnowflake(gid)) throw new Error('Ungueltige Guild-ID.');
  const flag = Boolean(enabled);
  const existing = await getWelcomeConfig(gid).catch(() => null);
  if (!existing) return upsertWelcomeConfig(gid, { enabled: flag }, actorId);
  const rows = await rest('bww_welcome', `?guild_id=eq.${encodeURIComponent(gid)}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled: flag, status: flag ? 'active' : 'inactive', updated_at: new Date().toISOString() }),
  });
  const updated = normalizeRow(rows?.[0] || { ...existing, enabled: flag });
  await logAudit({ guildId: gid, actorId, action: flag ? 'welcome.enable' : 'welcome.disable', targetId: updated?.id || gid, details: {} }).catch(() => {});
  return updated;
}

module.exports = { getWelcomeConfig, upsertWelcomeConfig, updateWelcomeConfig, setEnabled, sanitizeInput, normalizeRow };
