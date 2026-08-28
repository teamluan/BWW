const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const TICKET_REASONS = [
  { value: 'frage', label: 'Allgemeine Frage', emoji: '❓' },
  { value: 'problem', label: 'Problem / Bug', emoji: '🐛' },
  { value: 'bewerbung', label: 'Bewerbung', emoji: '📝' },
  { value: 'report', label: 'Spieler melden', emoji: '⚠️' },
  { value: 'sonstiges', label: 'Sonstiges', emoji: '📌' }
];

function ticketPanel(config) {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Ticket erstellen')
    .setColor(0x2f3136)
    .setDescription(
      'Du brauchst Hilfe?\n\n' +
      'Wähle unten einen Grund aus, um ein Ticket zu öffnen.\n' +
      'Ein Mitarbeiter wird sich um dein Anliegen kümmern.'
    )
    .setTimestamp();

  const select = new StringSelectMenuBuilder()
    .setCustomId('bww_ticket_select')
    .setPlaceholder('🎫 Grund auswählen')
    .addOptions(
      TICKET_REASONS.map(r =>
        new StringSelectMenuOptionBuilder()
          .setLabel(r.label)
          .setValue(r.value)
          .setEmoji(r.emoji)
          .setDescription(`Öffnet ein Ticket: ${r.label}`)
      )
    );

  const row = new ActionRowBuilder().addComponents(select);
  return { embeds: [embed], components: [row] };
}

async function createTicket(guild, config, user, reasonLabel) {
  if (!config.ticket.categoryId) return { ok: false, error: 'Keine Ticket-Kategorie konfiguriert.' };
  const category = guild.channels.cache.get(config.ticket.categoryId);
  if (!category) return { ok: false, error: 'Ticket-Kategorie nicht gefunden.' };

  const ticketRole = config.ticket.roleId ? guild.roles.cache.get(config.ticket.roleId) : null;
  const overlays = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }
  ];
  if (ticketRole) overlays.push({ id: ticketRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

  const channel = await guild.channels.create({
    name: `ticket-${user.username.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'user'}`,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: overlays.concat([
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
    ])
  });

  const intro = new EmbedBuilder()
    .setTitle('🎫 Neues Ticket')
    .setColor(0x2f3136)
    .setDescription(
      `**Ersteller:** ${user}\n**Grund:** ${reasonLabel}\n\n` +
      'Beschreibe dein Anliegen. Ein Mitarbeiter wird sich gleich um dich kümmern.'
    )
    .setTimestamp();

  const closeBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bww_ticket_close').setLabel('🔒 Ticket schließen').setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [intro], components: [closeBtn] });
  return { ok: true, channel };
}

module.exports = { ticketPanel, createTicket, TICKET_REASONS };
