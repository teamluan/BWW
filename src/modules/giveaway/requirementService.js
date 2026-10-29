// BWW Phase 8 - Requirement-Service (Quelle: 07_GIVEAWAYS.md + 08_VERIFICATION.md).
// Typen: role/account_age/server_age/minimum_level/channel_message/booster/verified.
// verified ist ECHT verdrahtet (Phase 8): Giveaway->Verification via isVerified(guild_id, user_id)
// aus src/modules/verification/flowService (lazy require, KEIN Zirkel-Import:
// Verification importiert NIE Giveaway). Falls Verification deaktiviert/fehlt -> pending (nie blockierend).
// Nutzt NUR src/services (supabase, logger, validation).

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { cleanId } = require('../../services/validation');
const { REQUIREMENT_TYPES } = require('./constants');

const log = logger.child('giveaway:requirements');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

function normalizeType(t) {
  const raw = String(t || '').toLowerCase().trim();
  if (raw === 'min_account_age_days' || raw === 'accountage') return 'account_age';
  if (raw === 'min_server_age_days' || raw === 'serverage') return 'server_age';
  if (raw === 'minimumlevel' || raw === 'level' || raw === 'min_level') return 'minimum_level';
  if (raw === 'channelmessage' || raw === 'message' || raw === 'messages') return 'channel_message';
  if (raw === 'bonus' || raw === 'premium') return 'booster';
  return raw;
}

function validateRequirement(input) {
  const type = normalizeType(input?.requirement_type ?? input?.type);
  if (!REQUIREMENT_TYPES.includes(type)) throw new Error('Ungueltiger Requirement-Typ (role/account_age/server_age/minimum_level/channel_message/booster/verified).');
  const value = input?.requirement_value ?? input?.value ?? '';
  const str = String(value ?? '').slice(0, 500);
  if (type === 'role' && !/^\d{5,25}$/.test(cleanId(str))) throw new Error('role-Requirement braucht eine Rollen-ID.');
  if ((type === 'account_age' || type === 'server_age') && !(Number(str) >= 0 && Number(str) <= 3650)) throw new Error(type + ' braucht Tage (0-3650).');
  if (type === 'minimum_level' && !(Number(str) >= 0 && Number(str) <= 10000)) throw new Error('minimum_level braucht ein Level (0-10000).');
  return { requirement_type: type, requirement_value: str };
}

async function listRequirements(giveawayId) {
  const gid = String(giveawayId || '').slice(0, 200);
  if (!gid) return [];
  try {
    return (await rest('bww_giveaway_requirements', '?select=*&giveaway_id=eq.' + encodeURIComponent(gid) + '&order=created_at.asc&limit=100')) || [];
  } catch (e) { log.warn('Requirements lesen fehlgeschlagen:', e.message); return []; }
}

async function syncRequirements(giveawayId, guildId, requirements = []) {
  const clean = (requirements || []).map(validateRequirement);
  const existing = await listRequirements(giveawayId);
  for (const row of existing) await rest('bww_giveaway_requirements', '?id=eq.' + encodeURIComponent(row.id), { method: 'DELETE' }).catch(() => {});
  const out = [];
  for (const r of clean) {
    try {
      const rows = await rest('bww_giveaway_requirements', '', { method: 'POST', body: JSON.stringify({ giveaway_id: String(giveawayId), guild_id: cleanId(guildId), requirement_type: r.requirement_type, requirement_value: r.requirement_value }) });
      if (rows?.[0]) out.push(rows[0]);
    } catch (e) { log.warn('Requirement speichern fehlgeschlagen:', e.message); }
  }
  return out;
}

function collectChecks(giveaway, dbRequirements = []) {
  const checks = [];
  const g = giveaway || {};
  for (const r of dbRequirements || []) {
    try { checks.push(validateRequirement({ requirement_type: r.requirement_type, requirement_value: r.requirement_value })); } catch {}
  }
  if (Array.isArray(g.requirements)) for (const r of g.requirements) {
    try { if (r && typeof r === 'object') checks.push(validateRequirement(r)); } catch {}
  }
  if (g.required_role_id || g.requiredRoleId) checks.push({ requirement_type: 'role', requirement_value: cleanId(g.required_role_id || g.requiredRoleId) });
  const minAcc = Number(g.min_account_age_days ?? g.minAccountAgeDays ?? 0);
  if (minAcc > 0) checks.push({ requirement_type: 'account_age', requirement_value: String(minAcc) });
  const minSrv = Number(g.min_server_age_days ?? g.minServerAgeDays ?? 0);
  if (minSrv > 0) checks.push({ requirement_type: 'server_age', requirement_value: String(minSrv) });
  const seen = new Set();
  return checks.filter((c) => { const k = c.requirement_type + ':' + c.requirement_value; if (seen.has(k)) return false; seen.add(k); return true; });
}

// Legacy-Hook (Phase 7 Stub kompatibel): nie blockierend, nur Hinweis.
function checkVerifiedHook() {
  return { ok: true, pending: true, message: 'verified-Hook: Verification folgt in Phase 8, vorerst als erfuellt gewertet.' };
}

// Echter Hook (Phase 8): prueft Verification-Status via Verification-Modul (lazy, ohne Zirkel-Import).
// Gibt { ok, pending?, message? } zurueck. Deaktiviert/fehlend -> pending (nie blockierend).
async function checkVerifiedRequirement(guildId, userId) {
  const gid = cleanId(guildId || '');
  const uid = cleanId(userId || '');
  if (!gid || !uid) return { ok: true, pending: true, message: 'verified: IDs fehlen, als erfuellt gewertet.' };
  try {
    const ver = require('../verification/flowService');
    if (typeof ver.getVerificationStatus === 'function') {
      const st = await ver.getVerificationStatus(gid, uid).catch(() => null);
      if (!st || st.enabled === false) return { ok: true, pending: true, message: 'Verification deaktiviert - als erfuellt gewertet.' };
      if (st.verified) return { ok: true };
      return { ok: false, message: 'Du musst verifiziert sein, um teilzunehmen. Nutze den Verification-Channel.' };
    }
    if (typeof ver.isVerified === 'function') {
      const ok = await ver.isVerified(gid, uid).catch(() => true);
      if (ok) return { ok: true };
      return { ok: false, message: 'Du musst verifiziert sein, um teilzunehmen.' };
    }
  } catch (e) {
    log.warn('Verified-Hook Fallback:', e.message);
  }
  const hook = checkVerifiedHook();
  return { ok: true, pending: true, message: hook.message };
}

async function checkRequirements(giveaway, member, dbRequirements = []) {
  const checks = collectChecks(giveaway, dbRequirements);
  const failed = [];
  const pending = [];
  const user = member?.user || member;
  const guildId = member?.guild?.id || giveaway?.guild_id || giveaway?.guildId || '';
  const userId = user?.id || member?.id || '';
  for (const c of checks) {
    try {
      if (c.requirement_type === 'role') {
        const rid = cleanId(c.requirement_value);
        if (!member?.roles?.cache?.has?.(rid)) failed.push({ type: 'role', message: 'Du benoetigst die Rolle <@&' + rid + '>.' });
      } else if (c.requirement_type === 'account_age') {
        const days = Number(c.requirement_value) || 0;
        const created = user?.createdTimestamp;
        if (!created) failed.push({ type: 'account_age', message: 'Accountalter konnte nicht geprueft werden.' });
        else { const age = Math.floor((Date.now() - created) / 86400000); if (age < days) failed.push({ type: 'account_age', message: 'Dein Discord-Account muss mindestens ' + days + ' Tag(e) alt sein (aktuell ca. ' + age + ').' }); }
      } else if (c.requirement_type === 'server_age') {
        const days = Number(c.requirement_value) || 0;
        const joined = member?.joinedTimestamp;
        if (!joined) failed.push({ type: 'server_age', message: 'Dein Server-Beitritt konnte nicht geprueft werden.' });
        else { const age = Math.floor((Date.now() - joined) / 86400000); if (age < days) failed.push({ type: 'server_age', message: 'Du musst seit mindestens ' + days + ' Tag(en) auf dem Server sein (aktuell ca. ' + age + ').' }); }
      } else if (c.requirement_type === 'minimum_level') {
        pending.push({ type: 'minimum_level', message: 'Level-Check (min. ' + c.requirement_value + ') vorbereitet, Level-System folgt.' });
      } else if (c.requirement_type === 'channel_message') {
        pending.push({ type: 'channel_message', message: 'Nachrichten-Check (' + c.requirement_value + ') vorbereitet, Zaehler folgt.' });
      } else if (c.requirement_type === 'booster') {
        const want = String(c.requirement_value || 'true').toLowerCase();
        if (!['false', '0'].includes(want) && !member?.premiumSince) failed.push({ type: 'booster', message: 'Nur Server-Booster koennen teilnehmen.' });
      } else if (c.requirement_type === 'verified') {
        const res = await checkVerifiedRequirement(guildId, userId);
        if (!res.ok) failed.push({ type: 'verified', message: res.message || 'Du musst verifiziert sein.' });
        else if (res.pending) pending.push({ type: 'verified', message: res.message });
      }
    } catch (e) { failed.push({ type: c.requirement_type, message: 'Check fehlgeschlagen: ' + e.message }); }
  }
  return { ok: failed.length === 0, failed, pending, checks: checks.length };
}

module.exports = { REQUIREMENT_TYPES, normalizeType, validateRequirement, listRequirements, syncRequirements, collectChecks, checkVerifiedHook, checkVerifiedRequirement, checkRequirements };
