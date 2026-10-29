// BWW Phase 8 - User-Service (08_VERIFICATION.md: bww_verification_users).
// Felder: discord_user_id/verification_status/verification_code/verified_at/verified_by
// (+guild_id/user_id/status legacy lesbar). Status: pending/verified/failed/expired (+blocked lesbar).
// Reset Verification setzt zurueck auf pending. Nutzt NUR src/services.

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { cleanId, isSnowflake } = require('../../services/validation');
const { normalizeUserStatus } = require('./constants');

const log = logger.child('verification:users');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

function normalizeRow(row) {
  if (!row) return null;
  const user_id = row.user_id || row.discord_user_id || null;
  const status = normalizeUserStatus(row.status || row.verification_status) || 'pending';
  return {
    ...row,
    user_id,
    discord_user_id: row.discord_user_id || row.user_id || null,
    status,
    verification_status: row.verification_status || row.status || 'pending',
    verification_code: row.verification_code || null,
    verified_at: row.verified_at || null,
    verified_by: row.verified_by || null,
    attempt_count: Number(row.attempt_count ?? 0) || 0,
  };
}

async function getUser(guildId, userId) {
  const gid = cleanId(guildId);
  const uid = cleanId(userId);
  if (!isSnowflake(gid) || !isSnowflake(uid)) throw new Error('Ungueltige Guild-/User-ID.');
  const rows = await rest('bww_verification_users', `?select=*&guild_id=eq.${encodeURIComponent(gid)}&user_id=eq.${encodeURIComponent(uid)}&limit=1`);
  if (rows?.[0]) return normalizeRow(rows[0]);
  const fb = await rest('bww_verification_users', `?select=*&guild_id=eq.${encodeURIComponent(gid)}&discord_user_id=eq.${encodeURIComponent(uid)}&limit=1`).catch(() => []);
  return normalizeRow(fb?.[0] || null);
}

async function ensureUser(guildId, userId) {
  const gid = cleanId(guildId);
  const uid = cleanId(userId);
  if (!isSnowflake(gid) || !isSnowflake(uid)) throw new Error('Ungueltige Guild-/User-ID.');
  const existing = await getUser(gid, uid).catch(() => null);
  if (existing) return existing;
  const payload = {
    guild_id: gid,
    user_id: uid,
    discord_user_id: uid,
    status: 'pending',
    verification_status: 'pending',
    attempt_count: 0,
    updated_at: new Date().toISOString(),
  };
  const rows = await rest('bww_verification_users', '?on_conflict=guild_id,user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload),
  }).catch(async () => rest('bww_verification_users', '', { method: 'POST', body: JSON.stringify(payload) }));
  return normalizeRow(rows?.[0] || { ...payload });
}

async function setStatus(guildId, userId, status, opts = {}) {
  const gid = cleanId(guildId);
  const uid = cleanId(userId);
  const st = normalizeUserStatus(status) || 'pending';
  await ensureUser(gid, uid).catch(() => null);
  const body = {
    status: st,
    verification_status: st,
    updated_at: new Date().toISOString(),
  };
  if (opts.verifiedAt !== undefined) body.verified_at = opts.verifiedAt;
  if (opts.verifiedBy !== undefined) { body.verified_by = opts.verifiedBy; }
  if (opts.verificationCode !== undefined) body.verification_code = opts.verificationCode;
  if (st === 'verified' && !body.verified_at) body.verified_at = new Date().toISOString();
  if (st !== 'verified' && opts.verifiedAt === undefined && opts.keepVerifiedAt !== true) {
    // verified_at behalten fuer Audit? Bei failed/expired loeschen? Behalten, nur bei pending loeschen.
    if (st === 'pending') body.verified_at = null;
  }
  if (typeof opts.attemptCount === 'number') body.attempt_count = Math.max(0, Math.floor(opts.attemptCount));
  let rows = await rest('bww_verification_users', `?guild_id=eq.${encodeURIComponent(gid)}&user_id=eq.${encodeURIComponent(uid)}`, { method: 'PATCH', body: JSON.stringify(body) }).catch(() => []);
  if (!rows?.[0]) {
    rows = await rest('bww_verification_users', `?guild_id=eq.${encodeURIComponent(gid)}&discord_user_id=eq.${encodeURIComponent(uid)}`, { method: 'PATCH', body: JSON.stringify(body) }).catch(() => []);
  }
  return normalizeRow(rows?.[0] || { guild_id: gid, user_id: uid, ...body });
}

async function markVerified(guildId, userId, verifiedBy = null) {
  return setStatus(guildId, userId, 'verified', { verifiedAt: new Date().toISOString(), verifiedBy: verifiedBy ? String(verifiedBy).slice(0, 100) : null, verificationCode: null });
}

async function markFailed(guildId, userId) {
  const cur = await getUser(guildId, userId).catch(() => null);
  const next = Number(cur?.attempt_count ?? 0) + 1;
  return setStatus(guildId, userId, 'failed', { attemptCount: next, keepVerifiedAt: true });
}

async function markExpired(guildId, userId) {
  return setStatus(guildId, userId, 'expired', { keepVerifiedAt: true });
}

async function resetVerification(guildId, userId) {
  const gid = cleanId(guildId);
  const uid = cleanId(userId);
  await ensureUser(gid, uid).catch(() => null);
  const body = {
    status: 'pending',
    verification_status: 'pending',
    verification_code: null,
    verified_at: null,
    verified_by: null,
    attempt_count: 0,
    updated_at: new Date().toISOString(),
  };
  let rows = await rest('bww_verification_users', `?guild_id=eq.${encodeURIComponent(gid)}&user_id=eq.${encodeURIComponent(uid)}`, { method: 'PATCH', body: JSON.stringify(body) }).catch(() => []);
  if (!rows?.[0]) {
    rows = await rest('bww_verification_users', `?guild_id=eq.${encodeURIComponent(gid)}&discord_user_id=eq.${encodeURIComponent(uid)}`, { method: 'PATCH', body: JSON.stringify(body) }).catch(() => []);
  }
  log.info('Verification reset:', gid, uid);
  return normalizeRow(rows?.[0] || { guild_id: gid, user_id: uid, ...body });
}

async function listUsers(guildId, { status = null, limit = 50 } = {}) {
  const gid = cleanId(guildId);
  const safe = Math.max(1, Math.min(200, Number(limit) || 50));
  let q = `?select=*&guild_id=eq.${encodeURIComponent(gid)}&order=updated_at.desc&limit=${safe}`;
  const st = status ? normalizeUserStatus(status) : null;
  if (st) q += `&status=eq.${encodeURIComponent(st)}`;
  const rows = await rest('bww_verification_users', q).catch(() => []);
  return (rows || []).map(normalizeRow);
}

module.exports = { getUser, ensureUser, setStatus, markVerified, markFailed, markExpired, resetVerification, listUsers, normalizeRow };
