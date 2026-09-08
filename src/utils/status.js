const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');

const COLORS = { online: 0x57F287, offline: 0xED4245, maintenance: 0xFEE75C };
const EMOJIS = { online: '\uD83D\uDFE2', offline: '\uD83D\uDD34', maintenance: '\uD83D\uDFE1' };
const LABELS = { online: 'Online', offline: 'Offline', maintenance: 'Wartungsarbeiten' };

function statusContainer(status = 'online', options = {}) {
  const color = COLORS[status] ?? COLORS.online;
  const emoji = EMOJIS[status] ?? EMOJIS.online;
  const label = LABELS[status] ?? LABELS.online;
  const container = new ContainerBuilder().setAccentColor(color);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${emoji} Bot Status: ${label}`));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  const lines = [`**Status:** ${emoji} ${label}`, `**Letztes Update:** <t:${Math.floor(Date.now() / 1000)}:R>`];
  if (options.reason) lines.push(`**Grund:** ${options.reason}`);
  if (status === 'online' && options.uptime) lines.push(`**Uptime:** ${options.uptime}`);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
  if (status === 'maintenance') {
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('-# Der Bot befindet sich im Wartungsmodus. Einige Funktionen sind m\u00F6glicherweise eingeschr\u00E4nkt.'));
  } else if (status === 'offline') {
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('-# Der Bot ist offline. Bitte kontaktiere einen Administrator.'));
  }
  return container;
}

async function createStatusMessage(channel, status = 'online', options = {}) {
  const container = statusContainer(status, options);
  const sent = await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
  return sent;
}

async function updateStatusMessage(client, status = 'online', options = {}) {
  try {
    const config = require('../config').load();
    if (!config.status?.channelId || !config.status?.messageId) return false;
    const channel = await client.channels.fetch(config.status.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return false;
    const msg = await channel.messages.fetch(config.status.messageId).catch(() => null);
    if (!msg) return false;
    const container = statusContainer(status, options);
    await msg.edit({ components: [container], flags: MessageFlags.IsComponentsV2 });
    return true;
  } catch { return false; }
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}

module.exports = { statusContainer, createStatusMessage, updateStatusMessage, formatUptime };
