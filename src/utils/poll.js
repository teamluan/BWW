const fs = require('fs');
const path = require('path');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const file = path.join(__dirname, '..', '..', 'config', 'polls.json');

function loadPolls() { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } }
function savePolls(polls) { const dir = path.dirname(file); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(polls, null, 2)); return polls; }
function getPoll(id) { const polls = loadPolls(); return polls[id] || null; }
function setPoll(id, data) { const polls = loadPolls(); polls[id] = data; savePolls(polls); }
function deletePoll(id) { const polls = loadPolls(); if (!(id in polls)) return false; delete polls[id]; savePolls(polls); return true; }

function pollContainer(poll) {
  const total = Object.values(poll.votes).flat().length;
  const container = new ContainerBuilder().setAccentColor(0x5865F2);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## \uD83D\uDCCA ${poll.question}`));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`*Erstellt von <@${poll.createdBy}> • ${total} Stimmen*`));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  // Optionen mit Live-Zähler
  for (const opt of poll.options) {
    const count = (poll.votes[opt] || []).length;
    const pct = total ? Math.round((count / total) * 100) : 0;
    const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${opt}** – ${count} (${pct}%) \n${bar}`));
  }
  // Buttons
  const rows = [];
  for (let i = 0; i < poll.options.length; i += 5) {
    const chunk = poll.options.slice(i, i + 5);
    const row = new ActionRowBuilder().addComponents(chunk.map((opt, idx) => {
      const globalIdx = i + idx;
      return new ButtonBuilder().setCustomId(`bww_poll_${poll.id}_${globalIdx}`).setLabel(opt.slice(0, 80)).setStyle(ButtonStyle.Secondary);
    }));
    rows.push(row);
  }
  // Close row
  rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`bww_poll_close_${poll.id}`).setLabel('Umfrage beenden').setStyle(ButtonStyle.Danger)));
  for (const row of rows) container.addActionRowComponents(row);
  return container;
}

function closedPollContainer(poll) {
  const total = Object.values(poll.votes).flat().length;
  const container = new ContainerBuilder().setAccentColor(0xED4245);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## \uD83D\uDCCA ${poll.question} — Beendet`));
  for (const opt of poll.options) {
    const count = (poll.votes[opt] || []).length;
    const pct = total ? Math.round((count / total) * 100) : 0;
    const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${opt}** – ${count} (${pct}%) \n${bar}`));
  }
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Gewinner: **${poll.options.reduce((a, b) => (poll.votes[a]?.length || 0) >= (poll.votes[b]?.length || 0) ? a : b, poll.options[0])}** • ${total} Stimmen`));
  return container;
}

module.exports = { loadPolls, savePolls, getPoll, setPoll, deletePoll, pollContainer, closedPollContainer, file };
