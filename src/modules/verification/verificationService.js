// BWW Phase 8 - Verification-Service (Config CRUD, 08_VERIFICATION.md: bww_verification).
// Felder exakt: enabled/verification_channel_id/verification_role_id/unverified_role_id/
// verified_role_id/method/log_channel_id (+code_validity_minutes/max_attempts/attempt_window_minutes).
// Legacy-Spalten channel_id/status lesbar, Writes pflegen enabled<->status + Aliase.
// Nutzt NUR src/services (supabase, logger, audit, validation).

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');
const { cleanId, isSnowflake } = require('../../services/validation');
const { normalizeMethod, CODE_VALIDITY_MINUTES_DEFAULT, MAX_ATTEMPTS_DEFAULT, ATTEMPT_WINDOW_MINUTES_DEFAULT } = require('./constants');

const log = logger.child('verification:service');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

function normalizeRow(row) {
  if (!row) return null;
  const enabled = row.enabled !== undefined && row.enabled !== null
    ? Boolean(row.enabled)
    : (row.status ? row.status !== 'inactive' && row.status !== 'draft' : true);
  const verification_channel_id = row.verification_channel_id || row.channel_id || null;
  const verified_role_id = row.verified_role_id || row.verification_role_id || null;
  const verification_role_id = row.verification_role_id || row.verified_role_id || null;
  return {
    ...row,
    enabled,
    verification_channel_id,
    verification_role_id,
    unverified_role_id: row.unverified_role_id || null,
    verified_role_id,
    method: normalizeMethod(row.method) || 'button',
    log_channel_id: row.log_channel_id || null,
    code_validity_minutes: Number(row.code_validity_minutes ?? CODE_VALIDITY_MINUTES_DEFAULT) || CODE_VALIDITY_MINUTES_DEFAULT,
    max_attempts: Number(row.max_attempts ?? MAX_ATTEMPTS_DEFAULT) || MAX_ATTEMPTS_DEFAULT,
    attempt_window_minutes: Number(row.attempt_window_minutes ?? ATTEMPT_WINDOW_MINUTES_DEFAULT) || ATTEMPT_WINDOW_MINUTES_DEFAULT,
  };
}

function sanitizeInput(data = {}) {
  const out = {};
  const pick = (obj, keys) => {
    for (const k of keys) if (obj[k] !== undefined) return obj[k];
    return undefined;
  };
  const vChannel = pick(data, ['verification_channel_id', 'verificationChannelId', 'channel_id', 'channelId']);
  if (vChannel !== undefined) {
    const cid = cleanId(vChannel || '');
    if (cid && !isSnowflake(cid)) throw new Error('Ungueltige Verification-Channel-ID.');
    out.verification_channel_id = cid || null;
    out.channel_id = cid || null;
  }
  const vRole = pick(data, ['verification_role_id', 'verificationRoleId', 'verified_role_id', 'verifiedRoleId']);
  if (vRole !== undefined) {
    const rid = cleanId(vRole || '');
    if (rid && !isSnowflake(rid)) throw new Error('Ungueltige Verified-Rollen-ID.');
    out.verification_role_id = rid || null;
    out.verified_role_id = rid || null;
  }
  const uvRole = pick(data, ['unverified_role_id', 'unverifiedRoleId']);
  if (uvRole !== undefined) {
    const rid = cleanId(uvRole || '');
    if (rid && !isSnowflake(rid)) throw new Error('Ungueltige Unverified-Rollen-ID.');
    out.unverified_role_id = rid || null;
  }
  const logCh = pick(data, ['log_channel_id', 'logChannelId']);
  if (logCh !== undefined) {
    const cid = cleanId(logCh || '');
    if (cid && !isSnowflake(cid)) throw new Error('Ungueltige Log-Channel-ID.');
    out.log_channel_id = cid || null;
  }
  const method = pick(data, ['method']);
  if (method !== undefined) {
    const m = normalizeMethod(method);
    if (!m || !['button', 'code', 'captcha'].includes(m)) throw new Error('Ungueltige Methode (button/code/captcha).');
    out.method = m;
  }
  const cv = pick(data, ['code_validity_minutes', 'codeValidityMinutes', 'code_validity', 'codeValidity']);
  if (cv !== undefined) {
    const n = Number(cv);
    if (!Number.isFinite(n) || n < 1 || n > 1440) throw new Error('Ungueltige Code-Gueltigkeit (1-1440 Minuten).');
    out.code_validity_minutes = Math.floor(n);
  }
  const ma = pick(data, ['max_attempts', 'maxAttempts']);
  if (ma !== undefined) {
    const n = Number(ma);
    if (!Number.isFinite(n) || n < 1 || n > 100) throw new Error('Ungueltiges Rate-Limit (max_attempts 1-100).');
    out.max_attempts = Math.floor(n);
  }
  const aw = pick(data, ['attempt_window_minutes', 'attemptWindowMinutes']);
  if (aw !== undefined) {
    const n = Number(aw);
    if (!Number.isFinite(n) || n < 1 || n > 1440) throw new Error('Ungueltiges Rate-Limit-Fenster (1-1440 Minuten).');
    out.attempt_window_minutes = Math.floor(n);
  }
  if (data.enabled !== undefined) out.enabled = Boolean(data.enabled);
  return out;
}

async function getVerificationConfig(guildId) {
  const gid = cleanId(guildId);
  if (!isSnowflake(gid)) throw new Error('Ungueltige Guild-ID.');
  const rows = await rest('bww_verification', `?select=*&guild_id=eq.${encodeURIComponent(gid)}&limit=1`);
  return normalizeRow(rows?.[0] || null);
}

async function upsertVerificationConfig(guildId, data = {}, actorId = null) {
  const gid = cleanId(guildId);
  if (!isSnowflake(gid)) throw new Error('Ungueltige Guild-ID.');
  const clean = sanitizeInput(data);
  const enabled = clean.enabled !== undefined ? clean.enabled : true;
  const payload = {
    guild_id: gid,
    ...clean,
    enabled,
    status: enabled ? 'active' : 'inactive',
    updated_at: new Date().toISOString(),
  };
  if (payload.method == null) delete payload.method;
  const rows = await rest('bww_verification', '?on_conflict=guild_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload),
  });
  const created = normalizeRow(rows?.[0] || null);
  await logAudit({ guildId: gid, actorId, action: 'verification.upsert', targetId: created?.id || gid, details: { enabled: created?.enabled, method: created?.method } }).catch(() => {});
  log.info('Verification gespeichert:', gid, created?.enabled ? 'aktiv' : 'inaktiv', created?.method || 'button');
  return created;
}

async function updateVerificationConfig(guildId, patch = {}, actorId = null) {
  const gid = cleanId(guildId);
  const existing = await getVerificationConfig(gid).catch(() => null);
  if (!existing) return upsertVerificationConfig(gid, patch, actorId);
  const clean = sanitizeInput(patch);
  const body = { ...clean, updated_at: new Date().toISOString() };
  if (clean.enabled !== undefined) body.status = clean.enabled ? 'active' : 'inactive';
  const rows = await rest('bww_verification', `?guild_id=eq.${encodeURIComponent(gid)}`, { method: 'PATCH', body: JSON.stringify(body) });
  const updated = normalizeRow(rows?.[0] || { ...existing, ...body });
  await logAudit({ guildId: gid, actorId, action: 'verification.update', targetId: updated?.id || gid, details: {} }).catch(() => {});
  return updated;
}

async function setEnabled(guildId, enabled, actorId = null) {
  const gid = cleanId(guildId);
  if (!isSnowflake(gid)) throw new Error('Ungueltige Guild-ID.');
  const flag = Boolean(enabled);
  const existing = await getVerificationConfig(gid).catch(() => null);
  if (!existing) return upsertVerificationConfig(gid, { enabled: flag }, actorId);
  const rows = await rest('bww_verification', `?guild_id=eq.${encodeURIComponent(gid)}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled: flag, status: flag ? 'active' : 'inactive', updated_at: new Date().toISOString() }),
  });
  const updated = normalizeRow(rows?.[0] || { ...existing, enabled: flag });
  await logAudit({ guildId: gid, actorId, action: flag ? 'verification.enable' : 'verification.disable', targetId: updated?.id || gid, details: {} }).catch(() => {});
  return updated;
}

module.exports = { getVerificationConfig, upsertVerificationConfig, updateVerificationConfig, setEnabled, sanitizeInput, normalizeRow };
