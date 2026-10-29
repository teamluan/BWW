// BWW Phase 7 - Giveaway-Nachricht (GIVEAWAY per 07_GIVEAWAYS.md).
// Layout: Preis/Dauer/Gewinner (+Beschreibung/Requirements/Ende) + Teilnehmen-Button.
// message_id wird nach Senden via giveawayService.setMessageId gespeichert.
// Components V2 wie Ticket/Giveaway-Bestand (ContainerBuilder).

const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { BUTTON_PREFIX_JOIN } = require('./constants');
const { formatDurationMs } = require('./giveawayService');

function formatEndsAt(endsAt) {
  if (!endsAt) return '-';
  const t = new Date(endsAt).getTime();
  if (!Number.isFinite(t)) return '-';
  const s = Math.floor(t / 1000);
  return '<t:' + s + ':R> (<t:' + s + ':f>)';
}

function buildGiveawayMessage(giveaway, opts = {}) {
  const g = giveaway || {};
  const entryCount = Number(opts.entryCount) || 0;
  const status = String(g.status || 'running').toLowerCase();
  const active = ['running', 'scheduled', 'active'].includes(status);
  const title = status === 'cancelled' ? 'GIVEAWAY ABGEBROCHEN' : active ? 'GIVEAWAY' : 'GIVEAWAY BEENDET';
  const endsAt = g.ends_at || g.end_at;
  const duration = g.duration || (endsAt ? formatDurationMs(Math.max(5000, new Date(endsAt).getTime() - new Date(g.created_at || Date.now()).getTime())) : '-');
  const lines = ['## ' + title, '', '**Preis:** ' + (g.prize || '-'), '**Dauer:** ' + duration, '**Gewinner:** ' + (Number(g.winner_count) || 1), '**Teilnehmer:** ' + entryCount];
  if (g.description) lines.push('**Beschreibung:** ' + String(g.description).slice(0, 1000));
  if (active && endsAt) lines.push('**Endet:** ' + formatEndsAt(endsAt));
  if (g.host_id || g.created_by) lines.push('**Host:** <@' + (g.host_id || g.created_by) + '>');
  const container = new ContainerBuilder().setAccentColor(active ? 0x5865f2 : 0x2f3136);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n').slice(0, 3900)));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  if (active) container.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(BUTTON_PREFIX_JOIN + g.id).setLabel('Teilnehmen').setStyle(ButtonStyle.Success).setEmoji('127881')));
  return container;
}

async function sendGiveawayMessage(client, channel, giveaway, opts = {}) {
  const { setMessageId } = require('./giveawayService');
  const container = buildGiveawayMessage(giveaway, opts);
  const sent = await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
  try { await setMessageId(giveaway.id, sent.id, giveaway.guild_id); } catch {}
  return sent;
}

async function updateGiveawayMessage(client, giveaway) {
  try {
    const { listEntries } = require('./entryService');
    const entries = await listEntries(giveaway.id, 2000).catch(() => []);
    const container = buildGiveawayMessage(giveaway, { entryCount: entries.length });
    const channel = client?.channels?.cache?.get(giveaway.channel_id) || (client?.channels?.fetch ? await client.channels.fetch(giveaway.channel_id).catch(() => null) : null);
    if (!channel?.isTextBased?.()) return false;
    const mid = giveaway.message_id;
    if (!mid) return false;
    const msg = await channel.messages.fetch(mid).catch(() => null);
    if (!msg) return false;
    await msg.edit({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    return true;
  } catch { return false; }
}

module.exports = { formatEndsAt, buildGiveawayMessage, sendGiveawayMessage, updateGiveawayMessage };
