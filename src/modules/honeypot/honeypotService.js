// BWW Phase 4 – Honeypot-Service (CRUD, 04_HONEYPOT.md Kap. Tabellen).
// Felder exakt: channel_id/name/description/action/delete_message/
// timeout_enabled/timeout_duration/ban_enabled/log_channel_id/enabled.
// Nutzt services (supabase, logger, audit, validation). Kein Fremdmodul-Code.

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');
const { cleanId, isSnowflake, clampText } = require('../../services/validation');
const { assertAction, DEFAULT_TIMEOUT_DURATION } = require('./constants');

const log = logger.child('honeypot:service');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    ...row,
    enabled: row.enabled !== false && row.status !== 'inactive' && row.status !== 'archived',
  };
}

async function listHoneypots(guildId, { onlyEnabled = false } = {}) {
  const gid = cleanId(guildId);
  let q = `?select=*&guild_id=eq.${encodeURIComponent(gid)}&order=created_at.asc&limit=100`;
  if (onlyEnabled) q += '&enabled=eq.true';
  const rows = (await rest('bww_honeypots', q)) || [];
  return rows.map(normalizeRow);
}

async function getHoneypot(id, guildId = null) {
  const rows = await rest('bww_honeypots', `?select=*&id=eq.${encodeURIComponent(String(id))}${guildId ? `&guild_id=eq.${encodeURIComponent(cleanId(guildId))}` : ''}&limit=1`);
  return normalizeRow(rows?.[0] || null);
}

async function getHoneypotByChannel(channelId, guildId) {
  const cid = cleanId(channelId);
  const gid = cleanId(guildId);
  const rows = await rest('bww_honeypots', `?select=*&guild_id=eq.${encodeURIComponent(gid)}&channel_id=eq.${encodeURIComponent(cid)}&limit=10`);
  return (rows || []).map(normalizeRow).filter((h) => h.enabled);
}

function sanitizeInput(data = {}) {
  const channel_id = cleanId(data.channel_id || data.channelId || '');
  if (channel_id && !isSnowflake(channel_id)) throw new Error('Ungültige Channel-ID.');
  const log_channel_id = cleanId(data.log_channel_id ?? data.logChannelId ?? '');
  const action = assertAction(String(data.action || 'log_only'));
  const timeout_duration = Math.max(60, Math.min(2419200, Number(data.timeout_duration ?? data.timeoutDuration ?? DEFAULT_TIMEOUT_DURATION) || DEFAULT_TIMEOUT_DURATION));
  return {
    channel_id: channel_id || null,
    name: clampText(data.name || 'honeypot', 100),
    description: data.description != null ? clampText(data.description, 1000) : null,
    action,
    delete_message: data.delete_message ?? data.deleteMessage ?? true ? true : false,
    timeout_enabled: Boolean(data.timeout_enabled ?? data.timeoutEnabled ?? (action === 'timeout')),
    timeout_duration,
    ban_enabled: Boolean(data.ban_enabled ?? data.banEnabled ?? (action === 'ban')),
    log_channel_id: log_channel_id || null,
    enabled: data.enabled !== false,
  };
}

async function createHoneypot(guildId, data, actorId = null) {
  const gid = cleanId(guildId);
  if (!isSnowflake(gid)) throw new Error('Ungültige Guild-ID.');
  const clean = sanitizeInput(data);
  if (!clean.channel_id) throw new Error('Channel-ID ist erforderlich.');
  const payload = {
    guild_id: gid, ...clean,
    status: clean.enabled ? 'active' : 'inactive',
    hit_count: 0,
  };
  const rows = await rest('bww_honeypots', '', { method: 'POST', body: JSON.stringify(payload) });
  const created = normalizeRow(rows?.[0] || null);
  await logAudit({ guildId: gid, actorId, action: 'honeypot.create', targetId: created?.id || null, details: { channel_id: clean.channel_id, action: clean.action } }).catch(() => {});
  log.info('Honeypot erstellt:', gid, clean.channel_id, clean.action);
  return created;
}

async function updateHoneypot(id, guildId, patch, actorId = null) {
  const gid = cleanId(guildId);
  const existing = await getHoneypot(id, gid);
  if (!existing) throw new Error('Honeypot nicht gefunden.');
  const merged = sanitizeInput({ ...existing, ...patch, channel_id: patch.channel_id ?? patch.channelId ?? existing.channel_id, log_channel_id: patch.log_channel_id ?? patch.logChannelId ?? existing.log_channel_id });
  // enabled aus patch übernehmen falls explizit gesetzt, sonst Bestand
  if (patch.enabled === undefined && patch.status !== undefined) merged.enabled = patch.status !== 'inactive' && patch.status !== 'archived';
  const payload = { ...merged, status: merged.enabled ? 'active' : 'inactive' };
  const rows = await rest('bww_honeypots', `?id=eq.${encodeURIComponent(String(id))}&guild_id=eq.${encodeURIComponent(gid)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  const updated = normalizeRow(rows?.[0] || existing);
  await logAudit({ guildId: gid, actorId, action: 'honeypot.update', targetId: String(id), details: { action: merged.action } }).catch(() => {});
  return updated;
}

async function setEnabled(id, guildId, enabled, actorId = null) {
  const gid = cleanId(guildId);
  const rows = await rest('bww_honeypots', `?id=eq.${encodeURIComponent(String(id))}&guild_id=eq.${encodeURIComponent(gid)}`, {
    method: 'PATCH', body: JSON.stringify({ enabled: Boolean(enabled), status: enabled ? 'active' : 'inactive' }),
  });
  if (!rows?.[0]) throw new Error('Honeypot nicht gefunden.');
  await logAudit({ guildId: gid, actorId, action: enabled ? 'honeypot.enable' : 'honeypot.disable', targetId: String(id), details: {} }).catch(() => {});
  return normalizeRow(rows[0]);
}

async function deleteHoneypot(id, guildId, actorId = null) {
  const gid = cleanId(guildId);
  const res = await supabaseRequest(`bww_honeypots?id=eq.${encodeURIComponent(String(id))}&guild_id=eq.${encodeURIComponent(gid)}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
  const rows = await res.json().catch(() => []);
  await logAudit({ guildId: gid, actorId, action: 'honeypot.delete', targetId: String(id), details: {} }).catch(() => {});
  return (rows?.length || 0) > 0;
}

async function bumpHitCount(id, guildId) {
  try {
    const current = await getHoneypot(id, guildId);
    if (!current) return;
    const next = Number(current.hit_count || 0) + 1;
    await rest('bww_honeypots', `?id=eq.${encodeURIComponent(String(id))}&guild_id=eq.${encodeURIComponent(cleanId(guildId))}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ hit_count: next, status: 'triggered' }),
    }).catch(() => {});
  } catch { /* silent-fail: Statistik darf Flow nie brechen */ }
}

module.exports = { listHoneypots, getHoneypot, getHoneypotByChannel, createHoneypot, updateHoneypot, setEnabled, deleteHoneypot, bumpHitCount, sanitizeInput };
