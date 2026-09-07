const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, MessageFlags } = require('discord.js');

const TICKET_REASONS = [
  { value: 'frage', label: 'Allgemeine Frage', emoji: '❓' },
  { value: 'problem', label: 'Problem / Bug', emoji: '🐛' },
  { value: 'bewerbung', label: 'Bewerbung', emoji: '📝' },
  { value: 'report', label: 'Spieler melden', emoji: '⚠️' },
  { value: 'sonstiges', label: 'Sonstiges', emoji: '📌' }
];

function ticketContainer(config) {
  const container = new ContainerBuilder().setAccentColor(0x2F3136);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎫 Ticket erstellen\nDu brauchst Hilfe?\n\nWähle unten einen Grund aus, um ein Ticket zu öffnen.\nEin Mitarbeiter wird sich um dein Anliegen kümmern.`));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  const select = new StringSelectMenuBuilder().setCustomId('bww_ticket_select').setPlaceholder('🎫 Grund auswählen').addOptions(TICKET_REASONS.map(r => new StringSelectMenuOptionBuilder().setLabel(r.label).setValue(r.value).setEmoji(r.emoji).setDescription(`Öffnet ein Ticket: ${r.label}`)));
  const row = new ActionRowBuilder().addComponents(select);
  container.addActionRowComponents(row);
  return container;
}

function ticketPanel(config) { return ticketContainer(config); }

async function createTicket(guild, config, user, reasonLabel) {
  try {
    if (!config.ticket.categoryId) return { ok: false, error: 'Keine Ticket-Kategorie konfiguriert.' };
    let category = guild.channels.cache.get(config.ticket.categoryId);
    if (!category) { try { category = await guild.channels.fetch(config.ticket.categoryId); } catch { category = null; } }
    if (!category) return { ok: false, error: 'Ticket-Kategorie nicht gefunden.' };
    if (category.type !== ChannelType.GuildCategory) return { ok: false, error: 'Ticket-Kategorie ist keine Kategorie.' };
    const existing = guild.channels.cache.find(ch => ch.parentId === category.id && ch.name.startsWith('ticket-') && ch.permissionOverwrites.cache.has(user.id));
    if (existing) return { ok: false, error: `Du hast bereits ein Ticket: ${existing}` };
    const me = guild.members.me;
    if (me && !category.permissionsFor(me).has(PermissionFlagsBits.ManageChannels)) return { ok: false, error: 'Bot hat keine Rechte zum Erstellen von Ticket-Kanälen (ManageChannels).' };
    let ticketRole = null;
    if (config.ticket.roleId) ticketRole = guild.roles.cache.get(config.ticket.roleId) || await guild.roles.fetch(config.ticket.roleId).catch(() => null);
    const overlays = [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }];
    if (ticketRole) overlays.push({ id: ticketRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
    const safeBase = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20) || 'user';
    const safeName = `ticket-${safeBase}-${user.id.slice(-4)}`;
    const channel = await guild.channels.create({ name: safeName, type: ChannelType.GuildText, parent: category.id, permissionOverwrites: overlays.concat([{ id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }]) });
    const intro = new ContainerBuilder().setAccentColor(0x2F3136);
    intro.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎫 Neues Ticket\n**Ersteller:** ${user}\n**Grund:** ${reasonLabel}\n\nBeschreibe dein Anliegen. Ein Mitarbeiter wird sich gleich um dich kümmern.`));
    intro.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bww_ticket_close').setLabel('🔒 Ticket schließen').setStyle(ButtonStyle.Danger)));
    await channel.send({ components: [intro], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    return { ok: true, channel };
  } catch (err) { return { ok: false, error: `Ticket konnte nicht erstellt werden: ${err.message}` }; }
}

module.exports = { ticketPanel, ticketContainer, createTicket, TICKET_REASONS };
