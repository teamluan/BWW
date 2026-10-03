const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const crypto = require('crypto');

const {
  getTicket,
  getTicketByChannel,
  listTickets,
  createTicketRecord,
  updateTicketRecord,
  countOpenTickets,
  addTicketEvent
} = require('./database');

const TICKET_REASONS = [
  { value: 'frage', label: 'Allgemeine Frage', emoji: '❓' },
  { value: 'problem', label: 'Problem / Bug', emoji: '🐛' },
  { value: 'bewerbung', label: 'Bewerbung', emoji: '📝' },
  { value: 'report', label: 'Spieler melden', emoji: '⚠️' },
  { value: 'sonstiges', label: 'Sonstiges', emoji: '📌' }
];

const PRIORITIES = {
  low: { label: 'Niedrig', emoji: '🟢' },
  normal: { label: 'Normal', emoji: '🔵' },
  high: { label: 'Hoch', emoji: '🟠' },
  urgent: { label: 'Dringend', emoji: '🔴' }
};

function generateTicketId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return 'TKT-' + date + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function sanitizeUserId(value) {
  return String(value || '').replace(/\D/g, '');
}

function sanitizeChannelName(value) {
  const name = String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return name || 'anfrage';
}

function priorityMeta(priority) {
  return PRIORITIES[priority] || PRIORITIES.normal;
}

function ticketContainer(ticket, guild) {
  const container = new ContainerBuilder().setAccentColor(ticket.priority === 'urgent' ? 0xD92D20 : ticket.priority === 'high' ? 0xF79009 : 0x2F3136);
  const priority = priorityMeta(ticket.priority);
  const participants = Array.isArray(ticket.participant_ids) ? ticket.participant_ids : [];
  const statusLabel = ticket.status === 'open' ? '🟢 Offen' : ticket.status === 'locked' ? '🔒 Gesperrt' : '✅ Geschlossen';
  const claimed = ticket.claimed_by ? '<@' + ticket.claimed_by + '>' : 'Niemand';
  const desc = ticket.description ? '\n**Anliegen:** ' + String(ticket.description).slice(0, 1000) : '';

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    '## 🎫 Ticket ' + ticket.id + '\n' +
    '**Ersteller:** <@' + ticket.owner_id + '>\n' +
    '**Grund:** ' + ticket.reason + '\n' +
    '**Status:** ' + statusLabel + '\n' +
    '**Priorität:** ' + priority.emoji + ' ' + priority.label + '\n' +
    '**Bearbeiter:** ' + claimed + '\n' +
    '**Beteiligte:** ' + participants.length + desc
  ));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

  if (ticket.status === 'closed') {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      'Dieses Ticket wurde geschlossen.' +
      (ticket.close_reason ? '\n**Abschlussgrund:** ' + String(ticket.close_reason).slice(0, 1000) : '')
    ));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('bww_ticket_reopen_' + ticket.id)
        .setLabel('🔓 Wieder öffnen')
        .setStyle(ButtonStyle.Success)
    ));
    return container;
  }

  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('bww_ticket_claim_' + ticket.id)
      .setLabel(ticket.claimed_by ? '👤 Claim übernehmen' : '👤 Ticket übernehmen')
      .setStyle(ticket.claimed_by ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('bww_ticket_close_' + ticket.id)
      .setLabel('🔒 Schließen')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('bww_ticket_add_' + ticket.id)
      .setLabel('➕ Hinzufügen')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('bww_ticket_remove_' + ticket.id)
      .setLabel('➖ Entfernen')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('bww_ticket_rename_' + ticket.id)
      .setLabel('✏️ Umbenennen')
      .setStyle(ButtonStyle.Secondary)
  ));

  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('bww_ticket_priority_' + ticket.id)
      .setPlaceholder('⭐ Priorität ändern')
      .addOptions(Object.entries(PRIORITIES).map(([value, meta]) =>
        new StringSelectMenuOptionBuilder()
          .setValue(value)
          .setLabel(meta.label)
          .setEmoji(meta.emoji)
          .setDescription('Setzt die Ticket-Priorität auf ' + meta.label)
          .setDefault(ticket.priority === value)
      ))
  ));

  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId((ticket.status === 'locked' ? 'bww_ticket_unlock_' : 'bww_ticket_lock_') + ticket.id)
      .setLabel(ticket.status === 'locked' ? '🔓 Entsperren' : '🔐 Sperren')
      .setStyle(ticket.status === 'locked' ? ButtonStyle.Success : ButtonStyle.Secondary)
  ));

  return container;
}

function ticketPanel(config) {
  return ticketContainer(config);
}

function buildPermissions(guild, config, ticket, locked = false) {
  const participants = [...new Set([
    ticket.owner_id,
    ...(Array.isArray(ticket.participant_ids) ? ticket.participant_ids : [])
  ].map(sanitizeUserId).filter(Boolean))];
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }
  ];

  if (config.ticket.roleId) {
    overwrites.push({
      id: config.ticket.roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    });
  }

  for (const userId of participants) {
    overwrites.push({
      id: userId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
      ...(locked
        ? { deny: [PermissionFlagsBits.SendMessages] }
        : { allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] })
    });
  }
  return overwrites;
}

async function getTicketConfig(guildId) {
  return require('./database').getGuildSettings(guildId);
}

function isStaff(member, config) {
  return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator)) ||
    Boolean(config.ticket.roleId && member?.roles?.cache?.has(config.ticket.roleId));
}

function canManageTicket(member, config, ticket) {
  if (!ticket || !member) return false;
  if (isStaff(member, config)) return true;
  return member.id === ticket.owner_id && config.ticket.allowUserClose === true;
}

async function createTicket(guild, config, user, reasonLabel, description = '') {
  try {
    if (!config.ticket?.enabled) return { ok: false, error: 'Das Ticket-System ist deaktiviert.' };
    if (!config.ticket.categoryId) return { ok: false, error: 'Keine Ticket-Kategorie konfiguriert.' };

    let category = guild.channels.cache.get(config.ticket.categoryId);
    if (!category) category = await guild.channels.fetch(config.ticket.categoryId).catch(() => null);
    if (!category) return { ok: false, error: 'Ticket-Kategorie nicht gefunden.' };
    if (category.type !== ChannelType.GuildCategory) return { ok: false, error: 'Ticket-Kategorie ist keine Kategorie.' };

    const maxOpen = Math.max(1, Math.min(5, Number(config.ticket.maxOpenPerUser) || 1));
    const openCount = await countOpenTickets(guild.id, user.id);
    if (openCount >= maxOpen) {
      const existing = guild.channels.cache.find(ch =>
        ch.parentId === category.id &&
        ch.name.startsWith('ticket-') &&
        ch.permissionOverwrites.cache.has(user.id)
      );
      return { ok: false, error: existing ? 'Du hast bereits das maximale Ticket-Limit erreicht: ' + existing : 'Du hast bereits das maximale Ticket-Limit erreicht.' };
    }

    const me = guild.members.me;
    if (me && !category.permissionsFor(me).has(PermissionFlagsBits.ManageChannels)) {
      return { ok: false, error: 'Bot hat keine Rechte zum Erstellen von Ticket-Kanälen (ManageChannels).' };
    }

    const id = generateTicketId();
    const reason = String(reasonLabel || 'Sonstiges').slice(0, 100);
    const normalizedDescription = String(description || '').trim().slice(0, 3000);
    const record = await createTicketRecord({
      id,
      guild_id: guild.id,
      channel_id: null,
      owner_id: user.id,
      reason,
      description: normalizedDescription || null,
      status: 'open',
      priority: 'normal',
      participant_ids: [user.id]
    });

    if (!record) throw new Error('Ticket konnte nicht in der Datenbank angelegt werden.');

    let channel;
    try {
      channel = await guild.channels.create({
        name: 'ticket-' + sanitizeChannelName(user.username) + '-' + user.id.slice(-4),
        type: ChannelType.GuildText,
        parent: category.id,
        topic: 'BWW Ticket ' + id + ' · ' + reason,
        permissionOverwrites: buildPermissions(guild, config, record, false)
      });
      await updateTicketRecord(id, { channel_id: channel.id });
      await addTicketEvent(id, guild.id, 'created', user.id, null, { reason, description: normalizedDescription });
    } catch (error) {
      await updateTicketRecord(id, {
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by: user.id,
        close_reason: 'Technischer Fehler bei der Ticket-Erstellung'
      }).catch(() => {});
      throw error;
    }

    const sent = await channel.send({
      components: [ticketContainer({ ...record, channel_id: channel.id }, guild)],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] }
    });
    await updateTicketRecord(id, { channel_id: channel.id, panel_message_id: sent.id });

    if (config.ticket.roleId) {
      const role = guild.roles.cache.get(config.ticket.roleId) || await guild.roles.fetch(config.ticket.roleId).catch(() => null);
      if (role) await channel.send({
        content: role + ' Ein neues Ticket wartet auf Bearbeitung.',
        allowedMentions: { roles: [role.id] }
      }).catch(() => {});
    }

    return { ok: true, channel, ticketId: id };
  } catch (err) {
    return { ok: false, error: 'Ticket konnte nicht erstellt werden: ' + err.message };
  }
}

async function refreshTicketPanel(client, ticketId) {
  const ticket = await getTicket(ticketId);
  if (!ticket?.channel_id || !ticket.panel_message_id) return null;
  const channel = await client.channels.fetch(ticket.channel_id).catch(() => null);
  if (!channel?.isTextBased()) return null;
  const message = await channel.messages.fetch(ticket.panel_message_id).catch(() => null);
  if (!message) return null;
  await message.edit({
    components: [ticketContainer(ticket, channel.guild)],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] }
  }).catch(() => {});
  return message;
}

async function claimTicket(client, ticketId, member) {
  const cfg = await getTicketConfig(member.guild.id);
  if (!isStaff(member, cfg)) return { ok: false, error: 'Nur das Support-Team darf Tickets übernehmen.' };
  const ticket = await getTicket(ticketId, member.guild.id);
  if (!ticket) return { ok: false, error: 'Ticket nicht gefunden.' };
  if (ticket.status === 'closed') return { ok: false, error: 'Das Ticket ist geschlossen.' };
  const next = ticket.claimed_by === member.id ? null : member.id;
  const updated = await updateTicketRecord(ticket.id, { claimed_by: next });
  await addTicketEvent(ticket.id, ticket.guild_id, next ? 'claimed' : 'unclaimed', member.id);
  await refreshTicketPanel(client, ticket.id);
  return { ok: true, ticket: updated || { ...ticket, claimed_by: next }, claimed: Boolean(next) };
}

async function setTicketPriority(client, ticketId, member, priority) {
  const cfg = await getTicketConfig(member.guild.id);
  if (!isStaff(member, cfg)) return { ok: false, error: 'Nur das Support-Team darf die Priorität ändern.' };
  const ticket = await getTicket(ticketId, member.guild.id);
  if (!ticket) return { ok: false, error: 'Ticket nicht gefunden.' };
  if (ticket.status === 'closed') return { ok: false, error: 'Das Ticket ist geschlossen.' };
  if (!PRIORITIES[priority]) return { ok: false, error: 'Ungültige Priorität.' };
  const updated = await updateTicketRecord(ticket.id, { priority });
  await addTicketEvent(ticket.id, ticket.guild_id, 'priority_changed', member.id, null, { priority });
  await refreshTicketPanel(client, ticket.id);
  return { ok: true, ticket: updated };
}

async function lockTicket(client, ticketId, member, locked = true) {
  const cfg = await getTicketConfig(member.guild.id);
  if (!isStaff(member, cfg)) return { ok: false, error: 'Nur das Support-Team darf Tickets sperren.' };
  const ticket = await getTicket(ticketId, member.guild.id);
  if (!ticket) return { ok: false, error: 'Ticket nicht gefunden.' };
  if (ticket.status === 'closed') return { ok: false, error: 'Das Ticket ist geschlossen.' };
  const channel = await client.channels.fetch(ticket.channel_id).catch(() => null);
  if (!channel?.isTextBased()) return { ok: false, error: 'Ticket-Channel nicht gefunden.' };
  const nextStatus = locked ? 'locked' : 'open';
  await channel.permissionOverwrites.set(buildPermissions(member.guild, cfg, ticket, locked));
  const updated = await updateTicketRecord(ticket.id, { status: nextStatus });
  await addTicketEvent(ticket.id, ticket.guild_id, locked ? 'locked' : 'unlocked', member.id);
  await refreshTicketPanel(client, ticket.id);
  return { ok: true, ticket: updated };
}

async function resolveTranscript(channel, ticket) {
  const lines = [
    'BWW TICKET TRANSCRIPT',
    'Ticket: ' + ticket.id,
    'Server: ' + channel.guild.name + ' (' + channel.guild.id + ')',
    'Ersteller: ' + ticket.owner_id,
    'Grund: ' + ticket.reason,
    'Priorität: ' + priorityMeta(ticket.priority).label,
    'Erstellt: ' + ticket.created_at,
    'Geschlossen: ' + new Date().toISOString(),
    '',
    '--- Nachrichten ---'
  ];
  let before;
  let pages = 0;
  while (pages < 10) {
    const batch = await channel.messages.fetch(before ? { limit: 100, before } : { limit: 100 }).catch(() => null);
    if (!batch?.size) break;
    const messages = [...batch.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    for (const message of messages) {
      const body = String(message.content || '').replaceAll('\r', '').trim();
      const attachments = [...message.attachments.values()].map(a => a.url).join(' ');
      const merged = [body, attachments ? '[Anhänge] ' + attachments : ''].filter(Boolean).join(' ');
      lines.push('[' + message.createdAt.toISOString() + '] ' + message.author.tag + ' (' + message.author.id + '): ' + (merged || '[keine Textnachricht]'));
    }
    before = batch.last()?.id;
    pages++;
    if (batch.size < 100 || !before) break;
  }
  return Buffer.from(lines.join('\n'), 'utf8');
}

async function sendTicketLog(client, cfg, ticket, type, extra = {}) {
  if (!cfg.ticket?.logChannelId) return null;
  const logChannel = await client.channels.fetch(cfg.ticket.logChannelId).catch(() => null);
  if (!logChannel?.isTextBased()) return null;
  const priority = priorityMeta(ticket.priority);
  const container = new ContainerBuilder().setAccentColor(ticket.priority === 'urgent' ? 0xD92D20 : 0x2F3136);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    '## 🎫 Ticket ' + type + '\n' +
    '**ID:** ' + ticket.id + '\n' +
    '**Ersteller:** <@' + ticket.owner_id + '>\n' +
    '**Grund:** ' + ticket.reason + '\n' +
    '**Priorität:** ' + priority.emoji + ' ' + priority.label +
    (extra.actorId ? '\n**Aktion von:** <@' + extra.actorId + '>' : '') +
    (extra.reason ? '\n**Grund:** ' + String(extra.reason).slice(0, 1000) : '')
  ));
  return logChannel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] }
  }).catch(() => null);
}

async function closeTicket(client, ticketId, member, reason = 'Kein Grund angegeben') {
  const cfg = await getTicketConfig(member.guild.id);
  const ticket = await getTicket(ticketId, member.guild.id);
  if (!ticket) return { ok: false, error: 'Ticket nicht gefunden.' };
  if (!canManageTicket(member, cfg, ticket)) return { ok: false, error: 'Du darfst dieses Ticket nicht schließen.' };
  if (ticket.status === 'closed') return { ok: false, error: 'Das Ticket ist bereits geschlossen.' };

  const channel = ticket.channel_id ? await client.channels.fetch(ticket.channel_id).catch(() => null) : null;
  let transcriptMessageId = null;
  if (channel?.isTextBased() && cfg.ticket.transcriptEnabled && cfg.ticket.logChannelId) {
    const buffer = await resolveTranscript(channel, ticket).catch(() => null);
    if (buffer) {
      const logChannel = await client.channels.fetch(cfg.ticket.logChannelId).catch(() => null);
      if (logChannel?.isTextBased()) {
        const sent = await logChannel.send({
          content: '📄 Transcript für Ticket ' + ticket.id + '.',
          files: [{ attachment: buffer, name: 'ticket-' + ticket.id.toLowerCase() + '.txt' }],
          allowedMentions: { parse: [] }
        }).catch(() => null);
        transcriptMessageId = sent?.id || null;
      }
    }
  }

  const updated = await updateTicketRecord(ticket.id, {
    status: 'closed',
    closed_at: new Date().toISOString(),
    closed_by: member.id,
    close_reason: String(reason || 'Kein Grund angegeben').slice(0, 1000),
    transcript_message_id: transcriptMessageId
  });

  await addTicketEvent(ticket.id, ticket.guild_id, 'closed', member.id, null, {
    reason: String(reason || '').slice(0, 1000),
    transcriptMessageId
  });
  await sendTicketLog(client, cfg, ticket, 'geschlossen', { actorId: member.id, reason }).catch(() => {});

  if (channel?.isTextBased()) {
    if (cfg.ticket.closeDelete !== false) {
      await channel.send({ content: '🔒 Ticket geschlossen. Der Channel wird entfernt.', allowedMentions: { parse: [] } }).catch(() => {});
      setTimeout(() => channel.delete('BWW Ticket geschlossen').catch(() => {}), 1500);
    } else {
      await channel.permissionOverwrites.set(buildPermissions(member.guild, cfg, ticket, true)).catch(() => {});
      const closedTicket = updated || { ...ticket, status: 'closed' };
      await refreshTicketPanel(client, closedTicket.id);
    }
  }

  return { ok: true, ticket: updated || { ...ticket, status: 'closed' }, deleted: cfg.ticket.closeDelete !== false };
}

async function reopenTicket(client, ticketId, member) {
  const cfg = await getTicketConfig(member.guild.id);
  if (!isStaff(member, cfg)) return { ok: false, error: 'Nur das Support-Team darf Tickets wieder öffnen.' };
  const ticket = await getTicket(ticketId, member.guild.id);
  if (!ticket) return { ok: false, error: 'Ticket nicht gefunden.' };
  if (ticket.status !== 'closed') return { ok: false, error: 'Nur geschlossene Tickets können wieder geöffnet werden.' };

  const category = await member.guild.channels.fetch(cfg.ticket.categoryId).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) return { ok: false, error: 'Ticket-Kategorie nicht gefunden.' };

  let channel = ticket.channel_id ? await client.channels.fetch(ticket.channel_id).catch(() => null) : null;
  const reopened = {
    ...ticket,
    status: 'open',
    closed_at: null,
    closed_by: null,
    close_reason: null,
    participant_ids: Array.isArray(ticket.participant_ids) ? ticket.participant_ids : [ticket.owner_id]
  };

  if (!channel || channel.type !== ChannelType.GuildText) {
    channel = await member.guild.channels.create({
      name: 'ticket-reopen-' + sanitizeChannelName(ticket.reason) + '-' + ticket.owner_id.slice(-4),
      type: ChannelType.GuildText,
      parent: category.id,
      topic: 'BWW Ticket ' + ticket.id + ' · wieder geöffnet',
      permissionOverwrites: buildPermissions(member.guild, cfg, reopened, false)
    });
  } else {
    await channel.setParent(category.id, { lockPermissions: false }).catch(() => {});
    await channel.permissionOverwrites.set(buildPermissions(member.guild, cfg, reopened, false)).catch(() => {});
  }

  const updated = await updateTicketRecord(ticket.id, {
    channel_id: channel.id,
    status: 'open',
    closed_at: null,
    closed_by: null,
    close_reason: null,
    reopened_at: new Date().toISOString()
  });
  await addTicketEvent(ticket.id, ticket.guild_id, 'reopened', member.id);

  const sent = await channel.send({
    components: [ticketContainer({ ...reopened, ...updated, channel_id: channel.id }, member.guild)],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] }
  }).catch(() => null);
  if (sent) await updateTicketRecord(ticket.id, { panel_message_id: sent.id });
  return { ok: true, ticket: updated, channel };
}

async function addTicketMember(client, ticketId, member, targetId) {
  const cfg = await getTicketConfig(member.guild.id);
  if (!isStaff(member, cfg)) return { ok: false, error: 'Nur das Support-Team darf Benutzer hinzufügen.' };
  const ticket = await getTicket(ticketId, member.guild.id);
  if (!ticket) return { ok: false, error: 'Ticket nicht gefunden.' };
  if (ticket.status === 'closed') return { ok: false, error: 'Das Ticket ist geschlossen.' };
  const userId = sanitizeUserId(targetId);
  if (!userId) return { ok: false, error: 'Keine gültige Benutzer-ID.' };
  if (userId === ticket.owner_id) return { ok: false, error: 'Der Ersteller ist bereits im Ticket.' };
  const list = [...new Set([...(Array.isArray(ticket.participant_ids) ? ticket.participant_ids : []), userId])];
  if (list.length > 21) return { ok: false, error: 'Maximal 20 zusätzliche Teilnehmer.' };
  const channel = await client.channels.fetch(ticket.channel_id).catch(() => null);
  if (!channel?.isTextBased()) return { ok: false, error: 'Ticket-Channel nicht gefunden.' };
  await channel.permissionOverwrites.edit(userId, {
    ViewChannel: true,
    SendMessages: ticket.status !== 'locked',
    ReadMessageHistory: true,
    AttachFiles: ticket.status !== 'locked'
  });
  const updated = await updateTicketRecord(ticket.id, { participant_ids: list });
  await addTicketEvent(ticket.id, ticket.guild_id, 'member_added', member.id, userId);
  await channel.send({ content: '➕ <@' + userId + '> wurde zum Ticket hinzugefügt.', allowedMentions: { users: [userId] } }).catch(() => {});
  await refreshTicketPanel(client, ticket.id);
  return { ok: true, ticket: updated };
}

async function removeTicketMember(client, ticketId, member, targetId) {
  const cfg = await getTicketConfig(member.guild.id);
  if (!isStaff(member, cfg)) return { ok: false, error: 'Nur das Support-Team darf Benutzer entfernen.' };
  const ticket = await getTicket(ticketId, member.guild.id);
  if (!ticket) return { ok: false, error: 'Ticket nicht gefunden.' };
  if (ticket.status === 'closed') return { ok: false, error: 'Das Ticket ist geschlossen.' };
  const userId = sanitizeUserId(targetId);
  if (!userId) return { ok: false, error: 'Keine gültige Benutzer-ID.' };
  if (userId === ticket.owner_id) return { ok: false, error: 'Der Ersteller kann nicht entfernt werden.' };
  const list = (Array.isArray(ticket.participant_ids) ? ticket.participant_ids : []).filter(id => id !== userId);
  const channel = await client.channels.fetch(ticket.channel_id).catch(() => null);
  if (!channel?.isTextBased()) return { ok: false, error: 'Ticket-Channel nicht gefunden.' };
  await channel.permissionOverwrites.delete(userId).catch(() => {});
  const updated = await updateTicketRecord(ticket.id, { participant_ids: list });
  await addTicketEvent(ticket.id, ticket.guild_id, 'member_removed', member.id, userId);
  await refreshTicketPanel(client, ticket.id);
  return { ok: true, ticket: updated };
}

async function renameTicket(client, ticketId, member, rawName) {
  const cfg = await getTicketConfig(member.guild.id);
  if (!isStaff(member, cfg)) return { ok: false, error: 'Nur das Support-Team darf Tickets umbenennen.' };
  const ticket = await getTicket(ticketId, member.guild.id);
  if (!ticket) return { ok: false, error: 'Ticket nicht gefunden.' };
  const channel = await client.channels.fetch(ticket.channel_id).catch(() => null);
  if (!channel?.isTextBased()) return { ok: false, error: 'Ticket-Channel nicht gefunden.' };
  const safe = sanitizeChannelName(rawName);
  if (!safe || safe.length < 2) return { ok: false, error: 'Der Name ist ungültig.' };
  await channel.setName('ticket-' + safe);
  await addTicketEvent(ticket.id, ticket.guild_id, 'renamed', member.id, null, { name: safe });
  return { ok: true, name: 'ticket-' + safe };
}

function buildCloseModal(ticketId) {
  return new ModalBuilder()
    .setCustomId('bww_ticket_close_modal_' + ticketId)
    .setTitle('Ticket schließen')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Abschlussgrund')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(1000)
          .setPlaceholder('Warum wird das Ticket geschlossen?')
      )
    );
}

function buildUserModal(ticketId, action) {
  return new ModalBuilder()
    .setCustomId('bww_ticket_' + action + '_modal_' + ticketId)
    .setTitle(action === 'add' ? 'Benutzer hinzufügen' : 'Benutzer entfernen')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('user_id')
          .setLabel('Discord Benutzer-ID oder Mention')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(2)
          .setMaxLength(30)
      )
    );
}

function buildRenameModal(ticketId) {
  return new ModalBuilder()
    .setCustomId('bww_ticket_rename_modal_' + ticketId)
    .setTitle('Ticket umbenennen')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Neuer Ticketname')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(2)
          .setMaxLength(60)
          .setPlaceholder('z. B. technisches-problem')
      )
    );
}

module.exports = {
  ticketPanel,
  ticketContainer,
  createTicket,
  getTicket,
  getTicketByChannel,
  listTickets,
  isStaff,
  canManageTicket,
  claimTicket,
  setTicketPriority,
  lockTicket,
  closeTicket,
  reopenTicket,
  addTicketMember,
  removeTicketMember,
  renameTicket,
  buildCloseModal,
  buildUserModal,
  buildRenameModal,
  TICKET_REASONS,
  PRIORITIES
};
