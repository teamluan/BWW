const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const file = path.join(__dirname, '..', '..', 'config', 'giveaways.json');

function loadGiveaways() {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}
function saveGiveaways(list) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(list, null, 2));
  return list;
}

function giveawayMessage(g) {
  const embed = new EmbedBuilder()
    .setTitle('🎉 Giveaway')
    .setColor(0x2f3136)
    .setDescription(
      `**Preis:** ${g.prize}\n` +
      `**Gewinner:** ${g.winners}\n` +
      `**Teilnehmer:** ${g.entries.length}\n` +
      `**Endet:** <t:${Math.round(g.endTime / 1000)}:R>`
    )
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bww_giveaway_join_${g.id}`).setLabel('🎉 Teilnehmen').setStyle(ButtonStyle.Success)
  );
  return { embeds: [embed], components: [row] };
}

async function startGiveaway(channel, prize, durationMs, winners) {
  const list = loadGiveaways();
  const g = { id: `${Date.now()}`, prize, winners, endTime: Date.now() + durationMs, entries: [], channelId: channel.id, active: true };
  list.push(g);
  saveGiveaways(list);
  const sent = await channel.send(giveawayMessage(g));
  g.messageId = sent.id;
  saveGiveaways(loadGiveaways().map(x => (x.id === g.id ? g : x)));
  return g;
}

function drawWinners(g) {
  const pool = [...new Set(g.entries)];
  const drawn = [];
  const copy = [...pool];
  while (copy.length && drawn.length < g.winners) {
    const idx = Math.floor(Math.random() * copy.length);
    drawn.push(copy.splice(idx, 1)[0]);
  }
  return drawn;
}

async function finalizeGiveaway(client, g) {
  g.active = false;
  const winners = drawWinners(g);
  const list = loadGiveaways();
  const upd = list.map(x => (x.id === g.id ? g : x));
  saveGiveaways(upd);

  try {
    const channel = client.channels.cache.get(g.channelId);
    if (channel) {
      const msg = await channel.messages.fetch(g.messageId).catch(() => null);
      if (msg) {
        const embed = new EmbedBuilder()
          .setTitle('🎉 Giveaway beendet')
          .setColor(0x2f3136)
          .setDescription(
            `**Preis:** ${g.prize}\n` +
            `**Gewinner:** ${winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'Keine Teilnehmer 😔'}`
          )
          .setTimestamp();
        await msg.edit({ embeds: [embed], components: [] });
      }
    }
  } catch {}
  return winners;
}

function startGiveawayLoop(client) {
  setTimeout(async () => {
    const list = loadGiveaways().filter(g => g.active);
    for (const g of list) {
      if (g.endTime <= Date.now()) {
        await finalizeGiveaway(client, g);
      }
    }
    startGiveawayLoop(client);
  }, 10000);
}

module.exports = { loadGiveaways, saveGiveaways, giveawayMessage, startGiveaway, drawWinners, finalizeGiveaway, startGiveawayLoop, file };
