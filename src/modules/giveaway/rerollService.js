// BWW Phase 7 - Reroll-Service (Quelle: 07_GIVEAWAYS.md Reroll).
// bww_giveaway_rerolls (old/new/reason -> old_winner_id/new_winner_id/reason), Gewinner neu ziehen.
// Nutzt supabase, logger, audit. Keine Verification-Logik.

const crypto = require('crypto');
const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');

const log = logger.child('giveaway:reroll');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

async function rerollGiveaway(client, giveaway, opts = {}) {
  const { getGiveaway } = require('./giveawayService');
  const actorId = opts.actorId || null;
  const reason = opts.reason || null;
  const g = typeof giveaway === 'string' ? await getGiveaway(giveaway) : giveaway;
  if (!g) throw new Error('Giveaway nicht gefunden.');
  if (String(g.status).toLowerCase() !== 'ended') throw new Error('Nur beendete Giveaways koennen neu gezogen werden.');
  const { listEntries } = require('./entryService');
  const entries = await listEntries(g.id, 2000).catch(() => []);
  const eligible = (entries || []).filter((e) => e.eligible !== false);
  if (!eligible.length) throw new Error('Keine Teilnehmer fuer Reroll.');
  let past = [];
  try { past = (await rest('bww_giveaway_winners', '?select=user_id,draw_number&giveaway_id=eq.' + encodeURIComponent(String(g.id)) + '&limit=500')) || []; } catch {}
  const excluded = new Set(past.map((r) => String(r.user_id)));
  const pool = eligible.filter((e) => !excluded.has(String(e.user_id)));
  const source = pool.length ? pool : eligible;
  const n = Math.max(1, Math.min(Number(opts.count) || Number(g.winner_count) || 1, source.length));
  const winners = [];
  const tmp = [...source];
  while (winners.length < n && tmp.length) winners.push(tmp.splice(crypto.randomInt(tmp.length), 1)[0]);
  const newIds = winners.map((w) => String(w.user_id));
  const oldIds = [...excluded].slice(0, 100);
  const maxDraw = Math.max(0, ...past.map((r) => Number(r.draw_number) || 0));
  for (let i = 0; i < newIds.length; i++) {
    const payload = { giveaway_id: String(g.id), guild_id: String(g.guild_id), user_id: newIds[i], position: oldIds.length + i + 1, claimed: false, draw_type: 'reroll', draw_number: maxDraw + 1 };
    try { await rest('bww_giveaway_winners', '', { method: 'POST', body: JSON.stringify(payload) }); }
    catch { await rest('bww_giveaway_winners', '', { method: 'POST', body: JSON.stringify({ giveaway_id: payload.giveaway_id, user_id: newIds[i], draw_type: 'reroll', draw_number: maxDraw + 1 }) }).catch(() => {}); }
  }
  try {
    await rest('bww_giveaway_rerolls', '', { method: 'POST', body: JSON.stringify({ giveaway_id: String(g.id), guild_id: String(g.guild_id), rerolled_by: actorId ? String(actorId) : null, old_winner_id: oldIds.join(',') || null, new_winner_id: newIds.join(',') || null, reason: reason ? String(reason).slice(0, 1000) : null }) });
  } catch (e) { log.warn('Reroll-Log fehlgeschlagen:', e.message); }
  try {
    const history = [...new Set([...oldIds, ...newIds])];
    await rest('bww_giveaways', '?id=eq.' + encodeURIComponent(String(g.id)), { method: 'PATCH', body: JSON.stringify({ current_winners: newIds, winner_history: history, updated_at: new Date().toISOString() }) }).catch(() => {});
  } catch {}
  try {
    const channel = client?.channels?.cache?.get(g.channel_id) || (client?.channels?.fetch ? await client.channels.fetch(g.channel_id).catch(() => null) : null);
    if (channel?.isTextBased?.()) await channel.send({ content: ('GIVEAWAY REROLL\nPreis: ' + g.prize + '\nNeue Gewinner: ' + newIds.map((id) => '<@' + id + '>').join(', ') + (reason ? '\nGrund: ' + String(reason).slice(0, 500) : '')).slice(0, 4000), allowedMentions: { users: newIds.slice(0, 50) } }).catch(() => {});
  } catch (e) { log.warn('Reroll-Ansage fehlgeschlagen:', e.message); }
  await logAudit({ guildId: String(g.guild_id), actorId, action: 'giveaway.reroll', targetId: String(g.id), details: { old: oldIds, new: newIds, reason: reason ? String(reason).slice(0, 500) : null } }).catch(() => {});
  log.info('Reroll:', String(g.id), newIds.join(','));
  return { oldWinnerIds: oldIds, newWinnerIds: newIds };
}

async function listRerolls(giveawayId, limit = 50) {
  try {
    return (await rest('bww_giveaway_rerolls', '?select=*&giveaway_id=eq.' + encodeURIComponent(String(giveawayId)) + '&order=created_at.desc&limit=' + Math.max(1, Math.min(100, Number(limit) || 50)))) || [];
  } catch { return []; }
}

module.exports = { rerollGiveaway, listRerolls };
