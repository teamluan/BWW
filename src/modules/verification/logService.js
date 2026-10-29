// BWW Phase 8 - Log-Service (08_VERIFICATION.md: bww_verification_logs).
// Felder: user/action/result/reason (+guild_id/details/actor_id).
// Nie werfend. Nutzt NUR src/services.

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { cleanId } = require('../../services/validation');

const log = logger.child('verification:logs');

const ALLOWED_ACTIONS = Object.freeze([
  'request', 'verify', 'fail', 'block', 'unblock', 'expire',
  'join', 'assign', 'success', 'failed', 'reset', 'status',
  'code_created', 'code_consumed', 'rate_limited', 'panel', 'button', 'modal',
]);

function normalizeAction(action) {
  const raw = String(action || 'verify').toLowerCase().trim().slice(0, 50);
  if (ALLOWED_ACTIONS.includes(raw)) return raw;
  if (raw.includes('success') || raw === 'verified') return 'success';
  if (raw.includes('fail')) return 'failed';
  if (raw.includes('reset')) return 'reset';
  if (raw.includes('rate') || raw.includes('limit')) return 'rate_limited';
  if (raw.includes('code')) return 'request';
  return 'verify';
}

async function logVerification({ guildId, userId = null, user = null, action = 'verify', result = null, reason = null, details = {}, actorId = null } = {}) {
  try {
    if (!isConfigured()) return null;
    const gid = cleanId(guildId || '');
    if (!gid) return null;
    const uid = cleanId(userId || user || '') || null;
    const act = normalizeAction(action);
    const res = result != null ? String(result).slice(0, 50) : null;
    const rsn = reason != null ? String(reason).slice(0, 1000) : null;
    const payload = {
      guild_id: gid,
      user_id: uid,
      action: act,
      result: res,
      reason: rsn,
      details: details && typeof details === 'object' ? details : { value: String(details || '').slice(0, 1000) },
      actor_id: actorId ? String(actorId).slice(0, 100) : null,
    };
    // details um result/reason ergaenzen (Kompatibilitaet Dashboard Phase 2).
    try {
      payload.details = { ...payload.details };
      if (res && payload.details.result == null) payload.details.result = res;
      if (rsn && payload.details.reason == null) payload.details.reason = rsn;
    } catch {}
    const resq = await supabaseRequest('bww_verification_logs', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload),
    });
    const rows = await resq.json().catch(() => []);
    return rows?.[0] || null;
  } catch (err) {
    log.warn('Verification-Log fehlgeschlagen:', err?.message || err);
    return null;
  }
}

async function listLogs(guildId, { userId = null, limit = 50 } = {}) {
  const gid = cleanId(guildId);
  const safe = Math.max(1, Math.min(100, Number(limit) || 50));
  let q = `?select=id,guild_id,user_id,action,result,reason,details,actor_id,created_at&guild_id=eq.${encodeURIComponent(gid)}&order=created_at.desc&limit=${safe}`;
  if (userId) q += `&user_id=eq.${encodeURIComponent(cleanId(userId))}`;
  const { supabaseRequest: req } = require('../../services/supabase');
  try {
    const r = await req(`bww_verification_logs${q}`, { headers: { Prefer: 'return=representation' } });
    return (await r.json()) || [];
  } catch {
    // Fallback ohne neue Spalten (alte DB ohne Phase-8-Migration).
    try {
      const { supabaseRequest: req2 } = require('../../services/supabase');
      const r2 = await req2(`bww_verification_logs?select=id,guild_id,user_id,action,details,actor_id,created_at&guild_id=eq.${encodeURIComponent(gid)}&order=created_at.desc&limit=${safe}`, { headers: { Prefer: 'return=representation' } });
      return (await r2.json()) || [];
    } catch { return []; }
  }
}

module.exports = { logVerification, listLogs, normalizeAction, ALLOWED_ACTIONS };
