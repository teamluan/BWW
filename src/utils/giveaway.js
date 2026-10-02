const crypto = require('crypto');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getGiveaway, listGiveaways, listActiveGiveaways, createGiveawayRecord, updateGiveawayRecord, addGiveawayEntry, removeGiveawayEntry, getGiveawayEntry, listGiveawayEntries, recordGiveawayWinner, listGiveawayWinnerHistory } = require('./database');

const MIN_DURATION_MS = 5000;
const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_WINNERS = 100;
const MAX_BONUS_ENTRIES = 20;

function normalizeGiveaway(row) {
  if (!row) return null;
  return {
    ...row,
    winnerCount: Number(row.winner_count) || 1,
    endTime: new Date(row.end_at).getTime(),
    entryCount: Number(row.entry_count) || 0,
    winners: Array.isArray(row.current_winners) ? row.current_winners : [],
    winnerHistory: Array.isArray(row.winner_history) ? row.winner_history : [],
    requiredRoleId: row.required_role_id || '',
    minAccountAgeDays: Number(row.min_account_age_days) || 0,
    minServerAgeDays: Number(row.min_server_age_days) || 0,
    bonusRoleId: row.bonus_role_id || '',
    bonusEntries: Number(row.bonus_entries) || 0,
    active: row.status === 'active'
  };
}

function requirementLines(g) {
  const lines = [];
  if (g.requiredRoleId) lines.push('**Pflichtrolle:** <@&' + g.requiredRoleId + '>');
  if (g.minAccountAgeDays > 0) lines.push('**Mindest-Accountalter:** ' + g.minAccountAgeDays + ' Tag(e)');
  if (g.minServerAgeDays > 0) lines.push('**Mindest-Serveralter:** ' + g.minServerAgeDays + ' Tag(e)');
  if (g.bonusRoleId && g.bonusEntries > 0) lines.push('**Bonus:** <@&' + g.bonusRoleId + '> = +' + g.bonusEntries + ' Gewinnchance(n)');
  return lines;
}

function giveawayContainer(g) {
  const active = g.status ? g.status === 'active' : Boolean(g.active);
  const title = active ? '🎉 Giveaway' : g.status === 'cancelled' ? '🚫 Giveaway abgebrochen' : '🎉 Giveaway beendet';
  const endTime = g.endTime || new Date(g.end_at).getTime();
  const count = g.winnerCount || g.winners || g.winner_count || 1;
  const entries = g.entryCount || g.entries || g.entry_count || 0;
  const container = new ContainerBuilder().setAccentColor(active ? 0x2F3136 : 0x5865F2);
  const lines = ['## ' + title, '**Preis:** ' + g.prize, '**Gewinner:** ' + count, '**Teilnehmer:** ' + entries];
  if (active) lines.push('**Endet:** <t:' + Math.floor(endTime / 1000) + ':R>');
  const req = requirementLines(g);
  if (req.length) lines.push(...req);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  if (active) {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bww_giveaway_join_' + g.id).setLabel('🎉 Teilnehmen').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('bww_giveaway_leave_' + g.id).setLabel('❌ Verlassen').setStyle(ButtonStyle.Danger)
    ));
  } else if (g.status === 'ended') {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bww_giveaway_reroll_' + g.id).setLabel('🔁 Neu ziehen').setStyle(ButtonStyle.Primary)
    ));
  }
  return container;
}

function validateCreateData(data) {
  const source = data || {};
  const prize = String(source.prize || '').trim().slice(0, 256);
  if (!prize) throw new Error('Ein Preis ist erforderlich.');
  const durationMs = Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, Number(source.durationMs) || 0));
  if (!durationMs) throw new Error('Ungültige Giveaway-Dauer.');
  const winnerCount = Math.max(1, Math.min(MAX_WINNERS, Number(source.winnerCount) || 1));
  const cleanId = (value) => String(value || '').replace(/\D/g, '');
  return {
    prize,
    durationMs,
    winnerCount,
    requiredRoleId: cleanId(source.requiredRoleId),
    minAccountAgeDays: Math.max(0, Math.min(3650, Number(source.minAccountAgeDays) || 0)),
    minServerAgeDays: Math.max(0, Math.min(3650, Number(source.minServerAgeDays) || 0)),
    bonusRoleId: cleanId(source.bonusRoleId),
    bonusEntries: Math.max(0, Math.min(MAX_BONUS_ENTRIES, Number(source.bonusEntries) || 0))
  };
}

async function createGiveaway(client, channel, data, createdBy) {
  const safe = validateCreateData(data);
  const id = Date.now() + '_' + crypto.randomUUID();
  const record = await createGiveawayRecord({
    id,
    guild_id: channel.guildId,
    channel_id: channel.id,
    prize: safe.prize,
    winner_count: safe.winnerCount,
    end_at: new Date(Date.now() + safe.durationMs).toISOString(),
    status: 'active',
    created_by: createdBy ? String(createdBy).slice(0, 100) : null,
    required_role_id: safe.requiredRoleId || null,
    min_account_age_days: safe.minAccountAgeDays,
    min_server_age_days: safe.minServerAgeDays,
    bonus_role_id: safe.bonusRoleId || null,
    bonus_entries: safe.bonusEntries
  });
  if (!record) throw new Error('Giveaway konnte nicht gespeichert werden.');
  try {
    const sent = await channel.send({ components: [giveawayContainer(normalizeGiveaway(record))], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
    return normalizeGiveaway(await updateGiveawayRecord(id, { message_id: sent.id }) || record);
  } catch (error) {
    await updateGiveawayRecord(id, { status: 'cancelled', ended_at: new Date().toISOString() }).catch(() => {});
    throw new Error('Giveaway-Nachricht konnte nicht gesendet werden: ' + error.message);
  }
}

async function checkEligibility(giveaway, member) {
  const g = normalizeGiveaway(giveaway);
  if (!g || !g.active) return { ok: false, error: 'Dieses Giveaway ist bereits beendet.' };
  if (!member?.user || member.user.bot) return { ok: false, error: 'Bots können nicht teilnehmen.' };
  if (g.requiredRoleId && !member.roles.cache.has(g.requiredRoleId)) return { ok: false, error: 'Du benötigst die Rolle <@&' + g.requiredRoleId + '>.' };
  if (g.minAccountAgeDays > 0) {
    const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
    if (ageDays < g.minAccountAgeDays) return { ok: false, error: 'Dein Discord-Account muss mindestens ' + g.minAccountAgeDays + ' Tag(e) alt sein.' };
  }
  if (g.minServerAgeDays > 0) {
    if (!member.joinedTimestamp) return { ok: false, error: 'Dein Server-Beitrittsdatum konnte nicht geprüft werden.' };
    const ageDays = Math.floor((Date.now() - member.joinedTimestamp) / 86400000);
    if (ageDays < g.minServerAgeDays) return { ok: false, error: 'Du musst seit mindestens ' + g.minServerAgeDays + ' Tag(en) auf dem Server sein.' };
  }
  const entryCount = g.bonusRoleId && member.roles.cache.has(g.bonusRoleId) ? Math.min(1 + g.bonusEntries, 21) : 1;
  return { ok: true, entryCount };
}

async function refreshEntryCount(id) {
  const entries = await listGiveawayEntries(id);
  const count = entries.reduce((sum, row) => sum + (Number(row.entry_count) || 1), 0);
  await updateGiveawayRecord(id, { entry_count: count });
  return count;
}

async function joinGiveaway(id, member) {
  const record = await getGiveaway(id);
  const eligibility = await checkEligibility(record, member);
  if (!eligibility.ok) return eligibility;
  if (await getGiveawayEntry(id, member.id)) return { ok: false, error: 'Du nimmst bereits an diesem Giveaway teil.' };
  const inserted = await addGiveawayEntry(id, member.id, eligibility.entryCount);
  if (!inserted) return { ok: false, error: 'Du nimmst bereits an diesem Giveaway teil.' };
  return { ok: true, entryCount: await refreshEntryCount(id), effectiveEntries: eligibility.entryCount };
}

async function leaveGiveaway(id, member) {
  const record = normalizeGiveaway(await getGiveaway(id));
  if (!record?.active) return { ok: false, error: 'Dieses Giveaway ist bereits beendet.' };
  if (!(await getGiveawayEntry(id, member.id))) return { ok: false, error: 'Du nimmst nicht an diesem Giveaway teil.' };
  await removeGiveawayEntry(id, member.id);
  return { ok: true, entryCount: await refreshEntryCount(id) };
}

async function updateGiveawayMessage(client, giveaway) {
  const g = normalizeGiveaway(giveaway);
  if (!g?.message_id && !g?.messageId) return false;
  try {
    const channel = client.channels.cache.get(g.channel_id || g.channelId) || await client.channels.fetch(g.channel_id || g.channelId).catch(() => null);
    if (!channel?.isTextBased()) return false;
    const message = await channel.messages.fetch(g.message_id || g.messageId).catch(() => null);
    if (!message) return false;
    await message.edit({ components: [giveawayContainer(g)], flags: MessageFlags.IsComponentsV2 });
    return true;
  } catch {
    return false;
  }
}

function weightedPool(entries, excluded) {
  const blocked = new Set((excluded || []).map(String));
  const pool = [];
  for (const entry of entries) {
    const userId = String(entry.user_id);
    if (blocked.has(userId)) continue;
    const count = Math.max(1, Math.min(21, Number(entry.entry_count) || 1));
    for (let i = 0; i < count; i++) pool.push(userId);
  }
  return pool;
}

function drawWinners(entries, winnerCount, excluded) {
  const pool = weightedPool(entries, excluded);
  const used = new Set((excluded || []).map(String));
  const winners = [];
  while (pool.length && winners.length < winnerCount) {
    const userId = pool.splice(crypto.randomInt(pool.length), 1)[0];
    if (used.has(userId)) continue;
    used.add(userId);
    winners.push(userId);
    for (let i = pool.length - 1; i >= 0; i--) if (pool[i] === userId) pool.splice(i, 1);
  }
  return winners;
}

async function announce(client, g, title, winners) {
  if (!winners.length) return;
  const channel = client.channels.cache.get(g.channel_id || g.channelId) || await client.channels.fetch(g.channel_id || g.channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  await channel.send({
    content: '🎉 ' + title + '\n' + winners.map((id) => '<@' + id + '>').join(', ') + '\n**Preis:** ' + g.prize,
    allowedMentions: { users: winners.map(String) }
  }).catch(() => {});
}

async function finalizeGiveaway(client, giveaway) {
  const id = giveaway.id || giveaway;
  const record = normalizeGiveaway(await getGiveaway(id, giveaway.guild_id || giveaway.guildId || null));
  if (!record || !record.active) return record?.winners || [];
  const entries = await listGiveawayEntries(record.id);
  const winners = drawWinners(entries, record.winnerCount, []);
  const now = new Date().toISOString();
  const updated = await updateGiveawayRecord(record.id, { status: 'ended', ended_at: now, current_winners: winners, winner_history: [...new Set((record.winnerHistory || []).concat(winners))] });
  const finalRecord = normalizeGiveaway(updated || record);
  for (const userId of winners) await recordGiveawayWinner(record.id, userId, 'initial', 1).catch(() => {});
  await updateGiveawayMessage(client, finalRecord);
  await announce(client, finalRecord, 'Giveaway beendet!', winners);
  return winners;
}

async function rerollGiveaway(client, id) {
  const record = normalizeGiveaway(await getGiveaway(id));
  if (!record) return { ok: false, error: 'Giveaway nicht gefunden.' };
  if (record.status !== 'ended') return { ok: false, error: 'Das Giveaway muss beendet sein.' };
  const history = await listGiveawayWinnerHistory(id);
  const excluded = [...new Set(history.map((row) => String(row.user_id)))];
  const winners = drawWinners(await listGiveawayEntries(id), record.winnerCount, excluded);
  const drawNumber = Math.max(1, ...history.map((row) => Number(row.draw_number) || 1)) + 1;
  const updated = await updateGiveawayRecord(id, { current_winners: winners, winner_history: [...new Set((record.winnerHistory || []).concat(winners))] });
  for (const userId of winners) await recordGiveawayWinner(id, userId, 'reroll', drawNumber).catch(() => {});
  const finalRecord = normalizeGiveaway(updated || record);
  await updateGiveawayMessage(client, finalRecord);
  await announce(client, finalRecord, 'Giveaway-Reroll!', winners);
  return { ok: true, winners };
}

async function cancelGiveaway(client, id) {
  const record = normalizeGiveaway(await getGiveaway(id));
  if (!record) return { ok: false, error: 'Giveaway nicht gefunden.' };
  if (!record.active) return { ok: false, error: 'Das Giveaway ist nicht aktiv.' };
  const updated = normalizeGiveaway(await updateGiveawayRecord(id, { status: 'cancelled', ended_at: new Date().toISOString() }));
  await updateGiveawayMessage(client, updated);
  return { ok: true };
}

async function finishDueGiveaways(client) {
  const active = await listActiveGiveaways(100);
  for (const row of active) {
    if (new Date(row.end_at).getTime() <= Date.now()) await finalizeGiveaway(client, row).catch((error) => console.error('[BWW] Giveaway-Finalisierung fehlgeschlagen:', error.message));
  }
}

function startGiveawayLoop(client) {
  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try { await finishDueGiveaways(client); } finally { running = false; }
  }, 5000);
  finishDueGiveaways(client).catch(() => {});
}

module.exports = { normalizeGiveaway, giveawayContainer, createGiveaway, joinGiveaway, leaveGiveaway, finalizeGiveaway, rerollGiveaway, cancelGiveaway, updateGiveawayMessage, finishDueGiveaways, startGiveawayLoop, listGiveaways };