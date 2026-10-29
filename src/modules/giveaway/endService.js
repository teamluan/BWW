// BWW Phase 7 - End-Service (Quelle: 07_GIVEAWAYS.md Ende).
// Ablauf: ends_at erreicht -> sperren -> Entries pruefen -> Gewinner zufaellig
// -> bww_giveaway_winners (position/claimed) -> Discord-Nachricht -> Audit Log.
// Legacy-Dual-Write: position+draw_number=1, claimed+draw_type='initial'.
// Nutzt supabase, logger, audit. Keine Verification-Logik.
// Phase 14: Best-Effort Notification giveaway_ended (nie werfend).

const crypto = require('crypto');
const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');

const log = logger.child('giveaway:end');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

function drawRandom(entries, count) {
  const pool = [...(entries || [])];
  const winners = [];
  const n = Math.max(0, Math.min(count, pool.length));
  while (winners.length < n && pool.length) winners.push(pool.splice(crypto.randomInt(pool.length), 1)[0]);
  return winners;
}

async function endGiveaway(client, giveaway, opts = {}) {
  const { getGiveaway } = require('./giveawayService');
  const actorId = opts.actorId || null;
  const reason = opts.reason || null;
  const g = typeof giveaway === 'string' ? await getGiveaway(giveaway) : giveaway;
  if (!g) throw new Error('Giveaway nicht gefunden.');
  if (['ended', 'cancelled'].includes(String(g.status || '').toLowerCase())) {
    try {
      const existing = await rest('bww_giveaway_winners', '?select=user_id&giveaway_id=eq.' + encodeURIComponent(String(g.id)) + '&order=position.asc&limit=100');
      return (existing || []).map((r) => String(r.user_id));
    } catch { return []; }
  }
  const now = new Date().toISOString();
  await rest('bww_giveaways', '?id=eq.' + encodeURIComponent(String(g.id)), { method: 'PATCH', body: JSON.stringify({ status: 'ended', ended_at: now, updated_at: now }) }).catch(() => {});
  let entries = [];
  try { const { listEntries } = require('./entryService'); entries = await listEntries(g.id, 2000); }
  catch (e) { log.warn('Entries lesen fehlgeschlagen:', e.message); }
  const eligible = (entries || []).filter((e) => e.eligible !== false);
  const winnerCount = Math.max(1, Math.min(100, Number(g.winner_count) || 1));
  const picked = drawRandom(eligible, winnerCount);
  const winnerIds = picked.map((e) => String(e.user_id));
  for (let i = 0; i < picked.length; i++) {
    const uid = String(picked[i].user_id);
    const payload = { giveaway_id: String(g.id), guild_id: String(g.guild_id), user_id: uid, position: i + 1, claimed: false, draw_type: 'initial', draw_number: 1 };
    try { await rest('bww_giveaway_winners', '', { method: 'POST', body: JSON.stringify(payload) }); }
    catch { await rest('bww_giveaway_winners', '', { method: 'POST', body: JSON.stringify({ giveaway_id: payload.giveaway_id, user_id: uid, draw_type: 'initial', draw_number: 1 }) }).catch(() => {}); }
  }
  await rest('bww_giveaways', '?id=eq.' + encodeURIComponent(String(g.id)), { method: 'PATCH', body: JSON.stringify({ status: 'ended', ended_at: now, current_winners: winnerIds, winner_history: winnerIds, updated_at: now }) })
    .catch(() => rest('bww_giveaways', '?id=eq.' + encodeURIComponent(String(g.id)), { method: 'PATCH', body: JSON.stringify({ status: 'ended', ended_at: now }) }).catch(() => {}));
  try {
    const channel = client?.channels?.cache?.get(g.channel_id) || (client?.channels?.fetch ? await client.channels.fetch(g.channel_id).catch(() => null) : null);
    if (channel?.isTextBased?.()) {
      const text = winnerIds.length
        ? 'GIVEAWAY BEENDET\nPreis: ' + g.prize + '\nGewinner: ' + winnerIds.map((id) => '<@' + id + '>').join(', ') + (reason ? '\nGrund: ' + String(reason).slice(0, 500) : '')
        : 'GIVEAWAY BEENDET\nPreis: ' + g.prize + '\nKeine gueltigen Teilnehmer.';
      await channel.send({ content: text.slice(0, 4000), allowedMentions: { users: winnerIds.slice(0, 50) } }).catch(() => {});
    }
  } catch (e) { log.warn('End-Ansage fehlgeschlagen:', e.message); }
  try { const { updateGiveawayMessage } = require('./giveawayMessage'); await updateGiveawayMessage(client, { ...g, status: 'ended' }).catch(() => {}); } catch {}
  await logAudit({ guildId: String(g.guild_id), actorId, action: 'giveaway.end', targetId: String(g.id), details: { winners: winnerIds, reason: reason ? String(reason).slice(0, 500) : null } }).catch(() => {});
  // Phase 14: Best-Effort Notification giveaway_ended (nie werfend, keine Business-Logik-Aenderung).
  try { const { notifyGiveawayEnded } = require('../../services/notifications'); notifyGiveawayEnded(String(g.guild_id), g.prize, String(g.id)).catch(() => {}); } catch {}
  log.info('Giveaway beendet:', String(g.id), winnerIds.length + ' Gewinner');
  return winnerIds;
}

module.exports = { drawRandom, endGiveaway };
