// BWW Phase 8 - Code-Service (08_VERIFICATION.md: bww_verification_codes).
// Felder: code/user_id/expires_at/used (+guild_id/code_hash/used_at legacy).
// Generieren/pruefen/verbrauchen + Ablauf. Nur Hash speichern (SHA256),
// KEIN Klartext-Code in DB (code-Spalte bleibt NULL, legacy plain lesbar).
// Nutzt NUR src/services.

const crypto = require('node:crypto');
const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { cleanId, isSnowflake } = require('../../services/validation');
const { CODE_LENGTH, CODE_VALIDITY_MINUTES_DEFAULT } = require('./constants');

const log = logger.child('verification:codes');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

function hashCode(plain) {
  return crypto.createHash('sha256').update(String(plain), 'utf8').digest('hex');
}

function randomCode(length = CODE_LENGTH) {
  const len = Math.max(4, Math.min(10, Number(length) || CODE_LENGTH));
  let out = '';
  while (out.length < len) out += String(Math.floor(Math.random() * 10));
  if (out[0] === '0') out = String(1 + Math.floor(Math.random() * 9)) + out.slice(1);
  return out;
}

function isExpiredRow(row) {
  if (!row) return true;
  if (row.used === true || row.used_at) return true;
  const t = new Date(row.expires_at).getTime();
  if (!Number.isFinite(t)) return true;
  return t <= Date.now();
}

async function generateCode(guildId, userId, { validityMinutes = CODE_VALIDITY_MINUTES_DEFAULT, createdBy = null } = {}) {
  const gid = cleanId(guildId);
  const uid = cleanId(userId);
  if (!isSnowflake(gid) || !isSnowflake(uid)) throw new Error('Ungueltige Guild-/User-ID.');
  const mins = Math.max(1, Math.min(1440, Number(validityMinutes) || CODE_VALIDITY_MINUTES_DEFAULT));
  const plain = randomCode(CODE_LENGTH);
  const expires_at = new Date(Date.now() + mins * 60000).toISOString();
  const payload = {
    guild_id: gid,
    user_id: uid,
    code_hash: hashCode(plain),
    code: null,
    expires_at,
    used: false,
    used_at: null,
    created_by: createdBy ? String(createdBy).slice(0, 100) : null,
  };
  const rows = await rest('bww_verification_codes', '', { method: 'POST', body: JSON.stringify(payload) });
  const row = rows?.[0] || null;
  log.info('Code erstellt:', gid, uid, 'gueltig bis', expires_at);
  return { code: plain, expires_at, id: row?.id || null, row };
}

async function getActiveCode(guildId, userId) {
  const gid = cleanId(guildId);
  const uid = cleanId(userId);
  const rows = await rest(
    'bww_verification_codes',
    `?select=*&guild_id=eq.${encodeURIComponent(gid)}&user_id=eq.${encodeURIComponent(uid)}&order=created_at.desc&limit=10`
  ).catch(() => []);
  const now = Date.now();
  for (const r of rows || []) {
    if (r.used === true || r.used_at) continue;
    const t = new Date(r.expires_at).getTime();
    if (Number.isFinite(t) && t > now) return r;
  }
  return null;
}

async function verifyCode(guildId, userId, inputCode) {
  const gid = cleanId(guildId);
  const uid = cleanId(userId);
  const plain = String(inputCode || '').replace(/\D/g, '').slice(0, 12);
  if (!plain) return { ok: false, reason: 'empty' };
  const rows = await rest(
    'bww_verification_codes',
    `?select=*&guild_id=eq.${encodeURIComponent(gid)}&user_id=eq.${encodeURIComponent(uid)}&order=created_at.desc&limit=10`
  ).catch(() => []);
  const now = Date.now();
  const wanted = hashCode(plain);
  for (const r of rows || []) {
    if (r.used === true || r.used_at) continue;
    const t = new Date(r.expires_at).getTime();
    if (!Number.isFinite(t) || t <= now) continue;
    const matchHash = r.code_hash && r.code_hash === wanted;
    const matchPlain = r.code && String(r.code) === plain;
    if (matchHash || matchPlain) {
      await rest('bww_verification_codes', `?id=eq.${encodeURIComponent(r.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ used: true, used_at: new Date().toISOString() }),
      }).catch(() => null);
      return { ok: true, row: r };
    }
  }
  return { ok: false, reason: 'mismatch' };
}

async function consumeCodeById(id) {
  const res = await rest('bww_verification_codes', `?id=eq.${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    body: JSON.stringify({ used: true, used_at: new Date().toISOString() }),
  }).catch(() => []);
  return res?.[0] || null;
}

async function listCodes(guildId, { userId = null, limit = 50 } = {}) {
  const gid = cleanId(guildId);
  const safe = Math.max(1, Math.min(100, Number(limit) || 50));
  let q = `?select=id,guild_id,user_id,expires_at,used,used_at,created_by,created_at&guild_id=eq.${encodeURIComponent(gid)}&order=created_at.desc&limit=${safe}`;
  if (userId) q += `&user_id=eq.${encodeURIComponent(cleanId(userId))}`;
  const rows = await rest('bww_verification_codes', q).catch(() => []);
  return (rows || []).map((r) => ({ ...r, expired: isExpiredRow(r) }));
}

module.exports = { hashCode, randomCode, isExpiredRow, generateCode, getActiveCode, verifyCode, consumeCodeById, listCodes };
