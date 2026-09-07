const fs = require('fs');
const path = require('path');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const file = path.join(__dirname, '..', '..', 'config', 'giveaways.json');

function loadGiveaways() { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } }
function saveGiveaways(list) { const dir = path.dirname(file); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(list, null, 2)); return list; }

function giveawayContainer(g) {
  const container = new ContainerBuilder().setAccentColor(g.active ? 0x2F3136 : 0x5865F2);
  const lines = [`## ${g.active ? '🎉 Giveaway' : '🎉 Giveaway beendet'}`, `**Preis:** ${g.prize}`, `**Gewinner:** ${g.winners}`, `**Teilnehmer:** ${g.entries.length}`];
  if (g.active) lines.push(`**Endet:** <t:${Math.round(g.endTime / 1000)}:R>`);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
  if (g.active) {
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`bww_giveaway_join_${g.id}`).setLabel('🎉 Teilnehmen').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`bww_giveaway_leave_${g.id}`).setLabel('❌ Verlassen').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(`bww_giveaway_end_${g.id}`).setLabel('⏹️ Beenden').setStyle(ButtonStyle.Secondary));
    container.addActionRowComponents(row);
  } else {
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`bww_giveaway_reroll_${g.id}`).setLabel('🔁 Neu ziehen').setStyle(ButtonStyle.Primary));
    container.addActionRowComponents(row);
  }
  return container;
}
function giveawayMessage(g) { return giveawayContainer(g); }

async function startGiveaway(channel, prize, durationMs, winners) {
  const safeDuration = Math.max(5000, Number(durationMs) || 60000);
  const safeWinners = Math.max(1, Number(winners) || 1);
  const safePrize = String(prize).slice(0, 256).trim() || 'Preis';
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const g = { id, prize: safePrize, winners: safeWinners, endTime: Date.now() + safeDuration, entries: [], channelId: channel.id, active: true };
  let sent;
  try { sent = await channel.send({ components: [giveawayContainer(g)], flags: MessageFlags.IsComponentsV2 }); } catch (err) { throw new Error(`Giveaway-Nachricht konnte nicht gesendet werden: ${err.message}`); }
  g.messageId = sent.id;
  const list = loadGiveaways(); list.push(g); saveGiveaways(list); return g;
}

function drawWinners(g) { const pool = [...new Set(g.entries)]; const drawn = []; const copy = [...pool]; while (copy.length && drawn.length < g.winners) { const idx = Math.floor(Math.random() * copy.length); drawn.push(copy.splice(idx, 1)[0]); } return drawn; }

async function updateGiveawayMessage(client, g) {
  try {
    const channel = client.channels.cache.get(g.channelId) || await client.channels.fetch(g.channelId).catch(() => null);
    if (!channel) return;
    const msg = await channel.messages.fetch(g.messageId).catch(() => null);
    if (msg) await msg.edit({ components: [giveawayContainer(g)], flags: MessageFlags.IsComponentsV2 });
  } catch {}
}

async function finalizeGiveaway(client, g) {
  const list = loadGiveaways();
  const stored = list.find(x => x.id === g.id);
  const target = stored || g;
  if (!target.active) return target.winnersDrawn || [];
  target.active = false;
  const winners = drawWinners(target);
  target.winnersDrawn = winners;
  saveGiveaways(list.map(x => (x.id === target.id ? target : x)));
  const container = new ContainerBuilder().setAccentColor(0x5865F2);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎉 Giveaway beendet\n**Preis:** ${target.prize}\n**Gewinner:** ${winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'Keine Teilnehmer 😔'}`));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Beendet <t:${Math.floor(Date.now() / 1000)}:F>`));
  container.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`bww_giveaway_reroll_${target.id}`).setLabel('🔁 Neu ziehen').setStyle(ButtonStyle.Primary)));
  try {
    const channel = client.channels.cache.get(target.channelId) || await client.channels.fetch(target.channelId).catch(() => null);
    if (channel) { const msg = await channel.messages.fetch(target.messageId).catch(() => null); if (msg) await msg.edit({ components: [container], flags: MessageFlags.IsComponentsV2 }); }
  } catch {}
  return winners;
}

async function rerollGiveaway(client, id) {
  const list = loadGiveaways();
  const g = list.find(x => x.id === id && !x.active);
  if (!g) return { ok: false, error: 'Giveaway nicht gefunden oder noch aktiv.' };
  const winners = drawWinners(g);
  g.winnersDrawn = winners;
  const container = new ContainerBuilder().setAccentColor(0x5865F2);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🔁 Giveaway Reroll\n**Preis:** ${g.prize}\n**Neue Gewinner:** ${winners.length ? winners.map(uid => `<@${uid}>`).join(', ') : 'Keine Teilnehmer übrig 😔'}`));
  container.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`bww_giveaway_reroll_${g.id}`).setLabel('🔁 Neu ziehen').setStyle(ButtonStyle.Primary)));
  try {
    const channel = client.channels.cache.get(g.channelId) || await client.channels.fetch(g.channelId).catch(() => null);
    if (channel) { const msg = await channel.messages.fetch(g.messageId).catch(() => null); if (msg) await msg.edit({ components: [container], flags: MessageFlags.IsComponentsV2 }); }
  } catch {}
  saveGiveaways(list);
  return { ok: true, winners };
}

function startGiveawayLoop(client) {
  setTimeout(async () => {
    try { const list = loadGiveaways().filter(g => g.active); for (const g of list) { if (g.endTime <= Date.now()) await finalizeGiveaway(client, g); } } catch (e) {} finally { startGiveawayLoop(client); }
  }, 10000);
}

module.exports = { loadGiveaways, saveGiveaways, giveawayContainer, giveawayMessage, drawWinners, finalizeGiveaway, rerollGiveaway, updateGiveawayMessage, startGiveawayLoop, file };
