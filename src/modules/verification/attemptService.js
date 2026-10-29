// BWW Phase 8 - Attempt-Service (08_VERIFICATION.md: bww_verification_attempts).
// Felder: user_id/method/success/ip_hash/user_agent - KEINE Klartext-IPs, nur Hash (DSGVO)!
// Rate Limits: max 5 Versuche/10min (konfigurierbar via Config), dann Sperre + Log (Caller loggt).
// Nutzt NUR src/services.

const crypto = require('node:crypto');
const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { cleanId, clampText } = require('../../services/validation');
const { MAX_ATTEMPTS_DEFAULT, ATTEMPT_WINDOW_MINUTES_DEFAULT } = require('./constants');

const log = logger.child('verification:attempts');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

function hashIp(ip) {
  const raw = String(ip || '').trim();
  if (!raw) return null;
  return crypto.createHash('sha256').update(raw + '|bww-verification', 'utf8').digest('hex');
}

async function recordAttempt({ guildId, userId, method = null, success = false, ip = null, ipHash = null, userAgent = null, error = null } = {}) {
  try {
    if (!isConfigured()) return null;
    const gid = cleanId(guildId);
    const uid = cleanId(userId);
    if (!gid || !uid) return null;
    const payload = {
      guild_id: gid,
      user_id: uid,
      method: method ? String(method).slice(0, 50) : null,
      success: Boolean(success),
      ip_hash: ipHash ? String(ipHash).slice(0, 128) : hashIp(ip),
      user_agent: userAgent ? clampText(userAgent, 500) : null,
      error: error ? String(error).slice(0, 1000) : null,
    };
    const rows = await rest('bww_verification_attempts', '', { method: 'POST', body: JSON.stringify(payload) });
    return rows?.[0] || null;
  } catch (err) {
    log.warn('Attempt-Log fehlgeschlagen:', err?.message || err);
    return null;
  }
}

async function countRecentFailures(guildId, userId, windowMinutes = ATTEMPT_WINDOW_MINUTES_DEFAULT) {
  const gid = cleanId(guildId);
  const uid = cleanId(userId);
  const mins = Math.max(1, Math.min(1440, Number(windowMinutes) || ATTEMPT_WINDOW_MINUTES_DEFAULT));
  const since = new Date(Date.now() - mins * 60000).toISOString();
  const rows = await rest(
    'bww_verification_attempts',
    `?select=id,created_at&guild_id=eq.${encodeURIComponent(gid)}&user_id=eq.${encodeURIComponent(uid)}&success=eq.false&created_at=gt.${encodeURIComponent(since)}&limit=100`
  ).catch(() => []);
  return (rows || []).length;
}

async function checkRateLimit(guildId, userId, { maxAttempts = MAX_ATTEMPTS_DEFAULT, windowMinutes = ATTEMPT_WINDOW_MINUTES_DEFAULT } = {}) {
  const max = Math.max(1, Math.min(100, Number(maxAttempts) || MAX_ATTEMPTS_DEFAULT));
  const win = Math.max(1, Math.min(1440, Number(windowMinutes) || ATTEMPT_WINDOW_MINUTES_DEFAULT));
  try {
    const fails = await countRecentFailures(guildId, userId, win);
    if (fails >= max) {
      return { allowed: false, blocked: true, fails, remaining: 0, windowMinutes: win, message: `Zu viele Versuche (${fails}/${max} in ${win} Min). Bitte spaeter erneut versuchen.` };
    }
    return { allowed: true, blocked: false, fails, remaining: max - fails, windowMinutes: win };
  } catch {
    return { allowed: true, blocked: false, fails: 0, remaining: max, windowMinutes: win };
  }
}

async function listAttempts(guildId, { userId = null, limit = 50 } = {}) {
  const gid = cleanId(guildId);
  const safe = Math.max(1, Math.min(100, Number(limit) || 50));
  let q = `?select=id,guild_id,user_id,method,success,ip_hash,user_agent,error,created_at&guild_id=eq.${encodeURIComponent(gid)}&order=created_at.desc&limit=${safe}`;
  if (userId) q += `&user_id=eq.${encodeURIComponent(cleanId(userId))}`;
  return (await rest('bww_verification_attempts', q).catch(() => [])) || [];
}

module.exports = { hashIp, recordAttempt, countRecentFailures, checkRateLimit, listAttempts };
