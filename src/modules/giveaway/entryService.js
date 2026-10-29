// BWW Phase 7 - Entry-Service (Quelle: 07_GIVEAWAYS.md Teilnahme).
// Ablauf: Button-Interaction -> Requirements pruefen (nicht erfuellt -> Meldung) -> Entry speichern.
// Felder: giveaway_id/guild_id/user_id/joined_at/eligible (+entered_at/entry_count dual-write legacy).
// Nutzt supabase, logger, audit, validation via requirementService/giveawayService.

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');

const log = logger.child('giveaway:entries');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

async function getEntry(giveawayId, userId) {
  const rows = await rest('bww_giveaway_entries', '?select=*&giveaway_id=eq.' + encodeURIComponent(String(giveawayId)) + '&user_id=eq.' + encodeURIComponent(String(userId)) + '&limit=1');
  return rows?.[0] || null;
}

async function listEntries(giveawayId, limit = 500) {
  const safe = Math.max(1, Math.min(2000, Number(limit) || 500));
  try {
    return (await rest('bww_giveaway_entries', '?select=*&giveaway_id=eq.' + encodeURIComponent(String(giveawayId)) + '&order=entered_at.asc&limit=' + safe)) || [];
  } catch {
    return (await rest('bww_giveaway_entries', '?select=*&giveaway_id=eq.' + encodeURIComponent(String(giveawayId)) + '&limit=' + safe)) || [];
  }
}

async function countEntries(giveawayId) {
  return (await listEntries(giveawayId, 2000)).length;
}

async function joinGiveawayEntry(giveaway, member) {
  const { checkRequirements, listRequirements } = require('./requirementService');
  const g = giveaway;
  if (!g) throw new Error('Giveaway nicht gefunden.');
  if (!['running', 'scheduled', 'active'].includes(String(g.status || '').toLowerCase())) throw new Error('Dieses Giveaway laeuft nicht mehr.');
  const userId = String(member?.user?.id || member?.id || '');
  if (!userId) throw new Error('User konnte nicht bestimmt werden.');
  if (member?.user?.bot) throw new Error('Bots koennen nicht teilnehmen.');
  if (await getEntry(g.id, userId).catch(() => null)) throw new Error('Du nimmst bereits teil.');
  const dbReqs = await listRequirements(g.id).catch(() => []);
  const check = await checkRequirements(g, member, dbReqs);
  if (!check.ok) {
    const err = new Error(check.failed.map((f) => f.message).join(' ') || 'Anforderungen nicht erfuellt.');
    err.failed = check.failed; err.pending = check.pending;
    throw err;
  }
  const now = new Date().toISOString();
  const payload = { giveaway_id: String(g.id), guild_id: String(g.guild_id), user_id: String(userId), joined_at: now, entered_at: now, eligible: true, entry_count: 1 };
  try {
    const rows = await rest('bww_giveaway_entries', '', { method: 'POST', body: JSON.stringify(payload) });
    await logAudit({ guildId: String(g.guild_id), actorId: String(userId), action: 'giveaway.join', targetId: String(g.id), details: {} }).catch(() => {});
    return { entry: rows?.[0] || payload, pending: check.pending };
  } catch (e) {
    const msg = String(e.message);
    if (/duplicate|conflict|409|unique/i.test(msg)) throw new Error('Du nimmst bereits teil.');
    if (msg.includes('joined_at') || msg.includes('eligible')) {
      const fb = { giveaway_id: payload.giveaway_id, user_id: payload.user_id, entered_at: now, entry_count: 1 };
      try {
        const rows = await rest('bww_giveaway_entries', '', { method: 'POST', body: JSON.stringify({ ...fb, guild_id: payload.guild_id }) });
        return { entry: rows?.[0] || fb, pending: check.pending };
      } catch (e2) {
        if (/duplicate|conflict|409|unique/i.test(String(e2.message))) throw new Error('Du nimmst bereits teil.');
        throw e2;
      }
    }
    throw e;
  }
}

async function leaveGiveawayEntry(giveaway, userId) {
  const g = giveaway;
  if (!g) throw new Error('Giveaway nicht gefunden.');
  if (!['running', 'scheduled', 'active'].includes(String(g.status || '').toLowerCase())) throw new Error('Dieses Giveaway laeuft nicht mehr.');
  const uid = String(userId);
  if (!(await getEntry(g.id, uid).catch(() => null))) throw new Error('Du nimmst nicht teil.');
  await rest('bww_giveaway_entries', '?giveaway_id=eq.' + encodeURIComponent(String(g.id)) + '&user_id=eq.' + encodeURIComponent(uid), { method: 'DELETE' });
  await logAudit({ guildId: String(g.guild_id), actorId: uid, action: 'giveaway.leave', targetId: String(g.id), details: {} }).catch(() => {});
  log.info('Entry entfernt:', String(g.id), uid);
  return true;
}

module.exports = { getEntry, listEntries, countEntries, joinGiveawayEntry, leaveGiveawayEntry };
