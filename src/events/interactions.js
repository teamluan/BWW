const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { isAllowed } = require('../commands');
const { getGuildSettings, saveGuildSettings, createDashboardCode, findEmbedInteraction, getGiveaway, listGiveaways: listGiveawayRecords } = require('../utils/database');
const { embedV2, verifyComponents } = require('../utils/embeds');
const { ticketPanel, createTicket, getTicketByChannel, canManageTicket, claimTicket, setTicketPriority, lockTicket, closeTicket, reopenTicket, addTicketMember, removeTicketMember, renameTicket, buildCloseModal, buildUserModal, buildRenameModal, TICKET_REASONS, PRIORITIES } = require('../utils/tickets');
const { createGiveaway, joinGiveaway, leaveGiveaway, finalizeGiveaway, rerollGiveaway, cancelGiveaway, updateGiveawayMessage } = require('../utils/giveaway');
const { getPanel, setPanel, deletePanel, loadPanels, panelContainer, buttonResponseContainer, addPanelMessage } = require('../utils/panels');
const { createStatusMessage, updateStatusMessage } = require('../utils/status');

const EPHEMERAL = { flags: MessageFlags.Ephemeral };
const V2 = MessageFlags.IsComponentsV2;
const EPHEMERAL_V2 = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

function hasGiveawayManagePermission(interaction, config) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roles = config.permissions['giveaway'] || [];
  return roles.some(id => interaction.member?.roles?.cache?.has(id));
}
function canCloseTicket(interaction, config) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (config.ticket.roleId && interaction.member?.roles?.cache?.has(config.ticket.roleId)) return true;
  if (interaction.channel?.name?.startsWith('ticket-') && interaction.channel?.permissionOverwrites?.cache?.has(interaction.user.id)) return true;
  return false;
}

function hasTicketManagePermission(interaction, config) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roles = config.permissions.ticket || [];
  return roles.some((id) => interaction.member?.roles?.cache?.has(id)) ||
    Boolean(config.ticket.roleId && interaction.member?.roles?.cache?.has(config.ticket.roleId));
}

async function resolveTicketId(interaction, requestedId = null) {
  const direct = String(requestedId || '').trim();
  if (direct) return direct;
  const ticket = await getTicketByChannel(interaction.channelId, interaction.guildId);
  return ticket?.id || null;
}

module.exports = async (interaction, client) => {
  try {
  const config = await getGuildSettings(interaction.guildId);
  if ((interaction.isButton() && (interaction.customId.startsWith('bww_embed_btn_') || interaction.customId.startsWith('bww_embed_'))) || (interaction.isAnySelectMenu?.() && interaction.customId.startsWith('bww_embed_select_'))) {
    const resolved = await findEmbedInteraction(interaction.guildId, interaction.customId);
    if (resolved?.component) {
      const component = resolved.component;
      const valuesArray = interaction.isAnySelectMenu?.() ? (interaction.values || []).map(String) : [];
      const values = valuesArray.join(', ');
      const optionResponses = interaction.isAnySelectMenu?.() && component.kind === 'string' && Array.isArray(component.options)
        ? valuesArray
            .map((value) => {
              const option = component.options.find((item) => String(item?.value || '') === value);
              const response = String(option?.response || '').trim();
              if (!response) return '';
              return response
                .replaceAll('{value}', value)
                .replaceAll('{label}', String(option?.label || value));
            })
            .filter(Boolean)
        : [];
      const responseText = optionResponses.join('\n') || String(component.response || '').trim();
      const action = component.action && typeof component.action === 'object' ? component.action : {};
      const actionType = String(action.type || 'none');

      let defaultText = interaction.isButton() ? '✅ Aktion ausgeführt.' : '✅ Auswahl gespeichert.';
      let actionSucceeded = true;

      if (actionType !== 'none') {
        if (!interaction.guild || !interaction.member?.roles?.add || !interaction.member?.roles?.remove) {
          return interaction.reply({ content: '❌ Diese Aktion ist nur auf einem Server verfügbar.', ...EPHEMERAL });
        }

        const roleId = String(action.roleId || '').split('').filter((char) => char >= '0' && char <= '9').join('');
        if (!roleId) {
          return interaction.reply({ content: '❌ Für diese V2-Aktion ist keine gültige Rollen-ID hinterlegt.', ...EPHEMERAL });
        }

        const role = interaction.guild.roles.cache.get(roleId) || await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
          return interaction.reply({ content: '❌ Die konfigurierte Rolle wurde nicht gefunden.', ...EPHEMERAL });
        }
        if (role.managed || !role.editable) {
          return interaction.reply({ content: '❌ Ich kann diese Rolle nicht verwalten. Die Bot-Rolle muss über der Zielrolle stehen.', ...EPHEMERAL });
        }

        await interaction.deferReply({ flags: EPHEMERAL_V2 });

        try {
          if (actionType === 'role_add') {
            if (interaction.member.roles.cache.has(role.id)) {
              defaultText = 'ℹ️ Du hast ' + role + ' bereits.';
            } else {
              await interaction.member.roles.add(role, 'BWW Embed V2 Aktion');
              defaultText = '✅ ' + role + ' wurde dir hinzugefügt.';
            }
          } else if (actionType === 'role_remove') {
            if (!interaction.member.roles.cache.has(role.id)) {
              defaultText = 'ℹ️ Du hast ' + role + ' nicht.';
            } else {
              await interaction.member.roles.remove(role, 'BWW Embed V2 Aktion');
              defaultText = '✅ ' + role + ' wurde dir entfernt.';
            }
          } else if (actionType === 'role_toggle') {
            if (interaction.member.roles.cache.has(role.id)) {
              await interaction.member.roles.remove(role, 'BWW Embed V2 Aktion');
              defaultText = '✅ ' + role + ' wurde entfernt.';
            } else {
              await interaction.member.roles.add(role, 'BWW Embed V2 Aktion');
              defaultText = '✅ ' + role + ' wurde hinzugefügt.';
            }
          } else {
            defaultText = '⚠️ Unbekannte V2-Aktion. Prüfe die Vorlage im Dashboard.';
          }
        } catch (error) {
          console.error('[BWW] Embed-V2-Aktion fehlgeschlagen:', error.message);
          actionSucceeded = false;
          defaultText = '❌ Die konfigurierte V2-Aktion konnte nicht ausgeführt werden.';
        }
      }

      const text = ((actionSucceeded && responseText) ? responseText : defaultText)
        .replaceAll('{values}', values)
        .replaceAll('{user}', `<@${interaction.user.id}>`)
        .replaceAll('{username}', interaction.user.username)
        .replaceAll('{server}', interaction.guild?.name || '');
      const container = new ContainerBuilder().setAccentColor(0x2F3136);
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text.slice(0, 4000)));

      if (actionType !== 'none' && interaction.deferred) {
        return interaction.editReply({ components: [container], flags: EPHEMERAL_V2, allowedMentions: { parse: [] } });
      }
      return interaction.reply({ components: [container], flags: EPHEMERAL_V2, allowedMentions: { parse: [] } });
    }
  }
  if (interaction.isButton() && interaction.customId === 'bww_verify') {
    if (!config.verify.roleId) return interaction.reply({ content: '❌ Keine Verifizierungsrolle eingerichtet.', ...EPHEMERAL });
    const role = interaction.guild.roles.cache.get(config.verify.roleId) || await interaction.guild.roles.fetch(config.verify.roleId).catch(() => null);
    if (!role) return interaction.reply({ content: '❌ Die Verifizierungsrolle existiert nicht mehr.', ...EPHEMERAL });
    if (interaction.member.roles.cache.has(role.id)) return interaction.reply({ content: '✅ Du bist bereits verifiziert.', ...EPHEMERAL });
    try { await interaction.member.roles.add(role); } catch { return interaction.reply({ content: '❌ Ich konnte die Rolle nicht vergeben. Prüfe meine Rollenposition.', ...EPHEMERAL }); }
    return interaction.reply({ content: '✅ Du wurdest erfolgreich verifiziert.', ...EPHEMERAL });
  }
  if (interaction.isButton() && (
    interaction.customId.startsWith('bww_ticket_') ||
    interaction.customId === 'bww_ticket_close'
  )) {
    const customId = interaction.customId;

    if (customId === 'bww_ticket_close') {
      const ticket = await require('../utils/database').getTicketByChannel(interaction.channelId, interaction.guildId);
      if (!ticket) return interaction.reply({ content: '❌ Dieses Ticket ist nicht registriert.', ...EPHEMERAL });
      if (!canManageTicket(interaction.member, config, ticket)) return interaction.reply({ content: '❌ Du darfst dieses Ticket nicht schließen.', ...EPHEMERAL });
      return interaction.showModal(buildCloseModal(ticket.id));
    }

    const match = customId.match(/^bww_ticket_(claim|close|add|remove|rename|lock|unlock|reopen)_([A-Za-z0-9-]+)$/);
    if (!match) return;
    const action = match[1];
    const ticketId = match[2];
    const ticket = await require('../utils/database').getTicket(ticketId, interaction.guildId);
    if (!ticket) return interaction.reply({ content: '❌ Ticket nicht gefunden.', ...EPHEMERAL });

    if (action === 'close') {
      if (!canManageTicket(interaction.member, config, ticket)) return interaction.reply({ content: '❌ Du darfst dieses Ticket nicht schließen.', ...EPHEMERAL });
      return interaction.showModal(buildCloseModal(ticket.id));
    }
    if (!hasTicketManagePermission(interaction, config) && action !== 'reopen') {
      return interaction.reply({ content: '❌ Nur das Support-Team darf diese Ticket-Aktion ausführen.', ...EPHEMERAL });
    }

    if (action === 'claim') {
      const result = await claimTicket(client, ticket.id, interaction.member);
      return interaction.reply({ content: result.ok ? (result.claimed ? '✅ Ticket wurde dir zugewiesen.' : '↩️ Ticket-Zuweisung entfernt.') : '❌ ' + result.error, ...EPHEMERAL });
    }
    if (action === 'add') return interaction.showModal(buildUserModal(ticket.id, 'add'));
    if (action === 'remove') return interaction.showModal(buildUserModal(ticket.id, 'remove'));
    if (action === 'rename') return interaction.showModal(buildRenameModal(ticket.id));
    if (action === 'lock' || action === 'unlock') {
      const result = await lockTicket(client, ticket.id, interaction.member, action === 'lock');
      return interaction.reply({ content: result.ok ? (action === 'lock' ? '🔐 Ticket gesperrt.' : '🔓 Ticket entsperrt.') : '❌ ' + result.error, ...EPHEMERAL });
    }
    if (action === 'reopen') {
      const result = await reopenTicket(client, ticket.id, interaction.member);
      return interaction.reply({ content: result.ok ? '✅ Ticket wieder geöffnet: ' + result.channel : '❌ ' + result.error, ...EPHEMERAL });
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('bww_ticket_priority_')) {
    const ticketId = interaction.customId.slice('bww_ticket_priority_'.length);
    const priority = interaction.values?.[0];
    const result = await setTicketPriority(client, ticketId, interaction.member, priority);
    return interaction.reply({ content: result.ok ? '⭐ Priorität auf ' + (PRIORITIES[priority]?.label || priority) + ' gesetzt.' : '❌ ' + result.error, ...EPHEMERAL });
  }

  if (!interaction.isChatInputCommand()) return;
  const command = interaction.commandName;
  if (command.startsWith('setup-')) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ Nur Administratoren dürfen das Setup ändern.', ...EPHEMERAL });
    if (command === 'setup-welcome') { config.welcome = { enabled: true, channelId: interaction.options.getChannel('channel').id, title: interaction.options.getString('title') || '', message: interaction.options.getString('text', true) }; await saveGuildSettings(interaction.guildId, config, interaction.user.id); return interaction.reply({ content: '✅ Welcome-System gespeichert.', ...EPHEMERAL }); }
    if (command === 'setup-verify') { config.verify = { enabled: true, channelId: interaction.options.getChannel('channel').id, roleId: interaction.options.getRole('role').id, message: interaction.options.getString('text', true) }; await saveGuildSettings(interaction.guildId, config, interaction.user.id); return interaction.reply({ content: '✅ Verify-System gespeichert.', ...EPHEMERAL }); }
    if (command === 'setup-ticket') {
      const category = interaction.options.getChannel('kategorie');
      const role = interaction.options.getRole('rolle');
      const logChannel = interaction.options.getChannel('log-channel');
      config.ticket = {
        ...(config.ticket || {}),
        enabled: true,
        categoryId: category.id,
        roleId: role.id,
        logChannelId: logChannel?.id || config.ticket?.logChannelId || '',
        transcriptEnabled: interaction.options.getBoolean('transcript') ?? config.ticket?.transcriptEnabled ?? true,
        closeDelete: interaction.options.getBoolean('close-delete') ?? config.ticket?.closeDelete ?? true,
        allowUserClose: interaction.options.getBoolean('user-close') ?? config.ticket?.allowUserClose ?? true,
        maxOpenPerUser: Math.max(1, Math.min(5, interaction.options.getInteger('max') || config.ticket?.maxOpenPerUser || 1))
      };
      await saveGuildSettings(interaction.guildId, config, interaction.user.id);
      return interaction.reply({ content: '✅ Ticket-System gespeichert. Kategorie: ' + category + ' · Support: ' + role + (logChannel ? ' · Logs: ' + logChannel : ''), ...EPHEMERAL });
    }
    if (command === 'setup-honeypot') {
      const active = interaction.options.getBoolean('aktiv', true);
      const channel = interaction.options.getChannel('channel');
      const logChannel = interaction.options.getChannel('log-channel');
      if (!active) {
        config.honeypot = { ...(config.honeypot || {}), enabled: false };
        await saveGuildSettings(interaction.guildId, config, interaction.user.id);
        return interaction.reply({ content: '✅ Honeypot deaktiviert.', ...EPHEMERAL });
      }
      if (!channel) return interaction.reply({ content: '❌ Für einen aktiven Honeypot musst du einen Text-Channel angeben.', ...EPHEMERAL });
      const punishment = interaction.options.getString('bestrafung') || config.honeypot?.punishment || 'none';
      const timeoutMinutes = Math.max(1, Math.min(40320, interaction.options.getInteger('timeout') || config.honeypot?.timeoutMinutes || 10));
      const deleteMessage = interaction.options.getBoolean('nachricht-loeschen') ?? config.honeypot?.deleteMessage ?? true;
      const ignoreAdmins = interaction.options.getBoolean('admins-ignorieren') ?? config.honeypot?.ignoreAdmins ?? true;
      const exemptRole = interaction.options.getRole('ausnahme-rolle');
      config.honeypot = {
        enabled: true,
        channelId: channel.id,
        logChannelId: logChannel?.id || config.honeypot?.logChannelId || '',
        punishment: ['none', 'kick', 'ban', 'timeout'].includes(punishment) ? punishment : 'none',
        timeoutMinutes,
        deleteMessage,
        ignoreAdmins,
        exemptRoleIds: exemptRole ? [exemptRole.id] : (config.honeypot?.exemptRoleIds || [])
      };
      await saveGuildSettings(interaction.guildId, config, interaction.user.id);
      return interaction.reply({ content: '✅ Honeypot gespeichert und aktiviert in ' + channel + '.', ...EPHEMERAL });
    }
    if (command === 'setup-status') {
      const channel = interaction.options.getChannel('channel');
      try {
        const sent = await createStatusMessage(channel, 'online', { reason: 'Initial' });
        config.status = { enabled: true, channelId: channel.id, messageId: sent.id, mode: 'online' };
        await saveGuildSettings(interaction.guildId, config, interaction.user.id);
        return interaction.reply({ content: `✅ Status-Embed in ${channel} erstellt (🟢 Online).`, ...EPHEMERAL });
      } catch (err) { return interaction.reply({ content: `❌ Status-Embed fehlgeschlagen: ${err.message}`, ...EPHEMERAL }); }
    }
    const name = interaction.options.getString('command', true); const role = interaction.options.getRole('role'); const allow = interaction.options.getBoolean('erlauben', true); config.permissions[name] ||= []; if (allow && !config.permissions[name].includes(role.id)) config.permissions[name].push(role.id); if (!allow) config.permissions[name] = config.permissions[name].filter(id => id !== role.id); await saveGuildSettings(interaction.guildId, config, interaction.user.id); return interaction.reply({ content: `✅ Rolle ${role} für /${name} ${allow ? 'erlaubt' : 'entfernt'}.`, ...EPHEMERAL });
  }
  if (command === 'dashboard-code') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ Nur Administratoren dürfen einen Dashboard-Zugangscode erzeugen.', ...EPHEMERAL });
    try {
      const result = await createDashboardCode(interaction.guildId, interaction.user.id, 60);
      const expires = Math.floor(new Date(result.expiresAt).getTime() / 1000);
      return interaction.reply({ content: '🔐 Dashboard-Code: `' + result.code + '`\nGültig bis <t:' + expires + ':F>.\nÖffne danach die BWW-Website und gib den Code ein.', ...EPHEMERAL });
    } catch (err) {
      return interaction.reply({ content: '❌ Dashboard-Code konnte nicht erstellt werden: ' + err.message, ...EPHEMERAL });
    }
  }
  if (command === 'restart') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ Nur Administratoren dürfen den Bot neu starten.', ...EPHEMERAL });
    await interaction.reply({ content: '🔄 Bot wird neu gestartet…', ...EPHEMERAL }); setTimeout(() => process.exit(0), 1000); return;
  }
  if (command === 'wartung') {
    if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
      try {
        await interaction.channel.send({ components: [ticketPanel(config)], flags: V2 });
        return interaction.reply({ content: '✅ Ticket-Panel gesendet.', ...EPHEMERAL });
      } catch (err) {
        return interaction.reply({ content: '❌ Ticket-Panel fehlgeschlagen: ' + err.message, ...EPHEMERAL });
      }
    }

    if (!hasTicketManagePermission(interaction, config)) return interaction.reply({ content: '❌ Nur das Support-Team darf Tickets verwalten.', ...EPHEMERAL });

    if (command === 'ticket-list') {
      const status = interaction.options.getString('status') || null;
      const rows = await require('../utils/database').listTickets(interaction.guildId, 25, status);
      if (!rows.length) return interaction.reply({ content: '📭 Keine Tickets gefunden.', ...EPHEMERAL });
      const lines = rows.map((row) => {
        const icon = row.status === 'open' ? '🟢' : row.status === 'locked' ? '🔒' : '✅';
        return icon + ' ' + row.id + ' — ' + row.reason + ' — <@' + row.owner_id + '>' +
          (row.claimed_by ? ' — 👤 <@' + row.claimed_by + '>' : '');
      });
      const container = new ContainerBuilder().setAccentColor(0x2F3136);
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(('## 🎫 Tickets (' + rows.length + ')\\n' + lines.join('\\n')).slice(0, 3900)));
      return interaction.reply({ components: [container], flags: EPHEMERAL_V2 });
    }

    const id = await resolveTicketId(interaction, interaction.options.getString('id'));

    if (command === 'ticket-reopen') {
      if (!id) return interaction.reply({ content: '❌ Eine Ticket-ID ist erforderlich.', ...EPHEMERAL });
      const result = await reopenTicket(client, id, interaction.member);
      return interaction.reply({ content: result.ok ? '✅ Ticket wieder geöffnet: ' + result.channel : '❌ ' + result.error, ...EPHEMERAL });
    }

    if (!id) return interaction.reply({ content: '❌ Keine Ticket-ID angegeben und der aktuelle Channel ist kein Ticket.', ...EPHEMERAL });

    if (command === 'ticket-close') {
      return interaction.showModal(buildCloseModal(id));
    }
    if (command === 'ticket-claim') {
      const result = await claimTicket(client, id, interaction.member);
      return interaction.reply({ content: result.ok ? (result.claimed ? '✅ Ticket übernommen.' : '↩️ Ticket-Zuweisung entfernt.') : '❌ ' + result.error, ...EPHEMERAL });
    }
    if (command === 'ticket-add') {
      const user = interaction.options.getUser('user', true);
      const result = await addTicketMember(client, id, interaction.member, user.id);
      return interaction.reply({ content: result.ok ? '✅ Benutzer hinzugefügt.' : '❌ ' + result.error, ...EPHEMERAL });
    }
    if (command === 'ticket-remove') {
      const user = interaction.options.getUser('user', true);
      const result = await removeTicketMember(client, id, interaction.member, user.id);
      return interaction.reply({ content: result.ok ? '✅ Benutzer entfernt.' : '❌ ' + result.error, ...EPHEMERAL });
    }
    if (command === 'ticket-rename') {
      const result = await renameTicket(client, id, interaction.member, interaction.options.getString('name', true));
      return interaction.reply({ content: result.ok ? '✅ Ticket umbenannt: ' + result.name : '❌ ' + result.error, ...EPHEMERAL });
    }
    if (command === 'ticket-priority') {
      const result = await setTicketPriority(client, id, interaction.member, interaction.options.getString('priority', true));
      return interaction.reply({ content: result.ok ? '⭐ Priorität gesetzt.' : '❌ ' + result.error, ...EPHEMERAL });
    }
    if (command === 'ticket-lock' || command === 'ticket-unlock') {
      const result = await lockTicket(client, id, interaction.member, command === 'ticket-lock');
      return interaction.reply({ content: result.ok ? (command === 'ticket-lock' ? '🔐 Ticket gesperrt.' : '🔓 Ticket entsperrt.') : '❌ ' + result.error, ...EPHEMERAL });
    }
  }

  if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
    const aktiv = interaction.options.getBoolean('aktiv', true);
    const grund = interaction.options.getString('grund') || '';
    const mode = aktiv ? 'maintenance' : 'online';
    config.status = config.status || {};
    config.status.mode = mode;
    await saveGuildSettings(interaction.guildId, config, interaction.user.id);
    const ok = await updateStatusMessage(client, interaction.guildId, mode, { reason: grund });
    return interaction.reply({ content: ok ? `${aktiv ? '🟡 Wartung aktiviert' : '🟢 Wartung deaktiviert'}${grund ? ': ' + grund : ''}` : `✅ Modus auf ${mode} gesetzt (kein Status-Channel konfiguriert).`, ...EPHEMERAL });
  }
  if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
  if (command === 'panel-create') {
    if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
    const rawName = interaction.options.getString('name', true);
    const name = rawName.toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 32);
    if (!name) return interaction.reply({ content: '❌ Ungültiger Panel-Name (nur a-z0-9-_).', ...EPHEMERAL });
    const intro = interaction.options.getString('intro') || '';
    const buttons = [];
    for (let i = 1; i <= 10; i++) {
      const label = interaction.options.getString(`button${i}_label`);
      const text = interaction.options.getString(`button${i}_text`);
      if (label && text) buttons.push({ label: label.slice(0, 80), text });
      else if (label || text) return interaction.reply({ content: `❌ Button ${i} braucht Label UND Text.`, ...EPHEMERAL });
    }
    if (!buttons.length) return interaction.reply({ content: '❌ Mindestens ein Button (Label+Text) nötig.', ...EPHEMERAL });
    const panel = { intro: intro || `Panel ${name}`, buttons, messages: [], createdAt: Date.now(), createdBy: interaction.user.id };
    setPanel(name, panel);
    try { const sent = await interaction.channel.send({ components: [panelContainer(panel, name)], flags: V2, allowedMentions: { parse: [] } }); addPanelMessage(name, sent.channelId || interaction.channelId, sent.id); return interaction.reply({ content: `✅ Panel \`${name}\` gespeichert und gesendet (${buttons.length} Buttons).`, ...EPHEMERAL }); } catch (err) { return interaction.reply({ content: `❌ Panel gespeichert, Senden fehlgeschlagen: ${err.message}`, ...EPHEMERAL }); }
  }
  if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
  if (command === 'panel-add-button') {
    if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
    const name = interaction.options.getString('name', true).toLowerCase();
    const panel = getPanel(name);
    if (!panel) return interaction.reply({ content: `❌ Panel \`${name}\` nicht gefunden.`, ...EPHEMERAL });
    if (panel.buttons.length >= 50) return interaction.reply({ content: '❌ Max 50 Buttons erreicht.', ...EPHEMERAL });
    const label = interaction.options.getString('label', true).slice(0, 80);
    const text = interaction.options.getString('text', true);
    panel.buttons.push({ label, text });
    setPanel(name, panel);
    return interaction.reply({ content: `✅ Button \`${label}\` zu Panel \`${name}\` hinzugefügt (${panel.buttons.length} total). Nutze \`/panel-send name:${name}\` zum Aktualisieren.`, ...EPHEMERAL });
  }
  if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
  if (command === 'panel-send') {
    if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
    const name = interaction.options.getString('name', true).toLowerCase();
    const panel = getPanel(name);
    if (!panel) return interaction.reply({ content: `❌ Panel \`${name}\` nicht gefunden.`, ...EPHEMERAL });
    try { const sent = await interaction.channel.send({ components: [panelContainer(panel, name)], flags: V2 }); addPanelMessage(name, sent.channelId || interaction.channelId, sent.id); return interaction.reply({ content: `✅ Panel \`${name}\` gesendet.`, ...EPHEMERAL }); } catch (err) { return interaction.reply({ content: `❌ Senden fehlgeschlagen: ${err.message}`, ...EPHEMERAL }); }
  }
  if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
  if (command === 'panel-delete') {
    if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
    const name = interaction.options.getString('name', true).toLowerCase();
    const panel = getPanel(name);
    if (!panel) return interaction.reply({ content: `❌ Panel \`${name}\` nicht gefunden.`, ...EPHEMERAL });
    let deletedCount = 0;
    const msgs = panel.messages || [];
    for (const m of msgs) {
      try {
        const ch = await client.channels.fetch(m.channelId).catch(() => null);
        if (!ch || !ch.isTextBased()) continue;
        const msg = await ch.messages.fetch(m.messageId).catch(() => null);
        if (msg) { await msg.delete().catch(() => {}); deletedCount++; }
      } catch {}
    }
    deletePanel(name);
    return interaction.reply({ content: `✅ Panel \`${name}\` gelöscht (${deletedCount} Nachricht(en) entfernt).`, ...EPHEMERAL });
  }
  if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
  if (command === 'panel-list') {
    if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
    const panels = loadPanels();
    const names = Object.keys(panels);
    if (!names.length) return interaction.reply({ content: '📭 Keine Panels gespeichert.', ...EPHEMERAL });
    const container = new ContainerBuilder().setAccentColor(0x2F3136);
    const lines = names.map(n => `• \`${n}\` – ${panels[n].buttons.length} Buttons – ${(panels[n].intro || '').slice(0, 80)}`).join('\n');
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Gespeicherte Panels (${names.length})\n${lines}`));
    return interaction.reply({ components: [container], flags: EPHEMERAL_V2 });
  }
  if (command.startsWith('ticket')) {
    if (command === 'ticket') {
      if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
      try {
        await interaction.channel.send({ components: [ticketPanel(config)], flags: V2 });
        return interaction.reply({ content: '✅ Ticket-Panel gesendet.', ...EPHEMERAL });
      } catch (err) {
        return interaction.reply({ content: '❌ Ticket-Panel fehlgeschlagen: ' + err.message, ...EPHEMERAL });
      }
    }

    if (!hasTicketManagePermission(interaction, config)) return interaction.reply({ content: '❌ Nur das Support-Team darf Tickets verwalten.', ...EPHEMERAL });

    if (command === 'ticket-list') {
      const status = interaction.options.getString('status') || null;
      const rows = await require('../utils/database').listTickets(interaction.guildId, 25, status);
      if (!rows.length) return interaction.reply({ content: '📭 Keine Tickets gefunden.', ...EPHEMERAL });
      const lines = rows.map((row) => {
        const icon = row.status === 'open' ? '🟢' : row.status === 'locked' ? '🔒' : '✅';
        return icon + ' ' + row.id + ' — ' + row.reason + ' — <@' + row.owner_id + '>' +
          (row.claimed_by ? ' — 👤 <@' + row.claimed_by + '>' : '');
      });
      const container = new ContainerBuilder().setAccentColor(0x2F3136);
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(('## 🎫 Tickets (' + rows.length + ')\\n' + lines.join('\\n')).slice(0, 3900)));
      return interaction.reply({ components: [container], flags: EPHEMERAL_V2 });
    }

    const id = await resolveTicketId(interaction, interaction.options.getString('id'));

    if (command === 'ticket-reopen') {
      if (!id) return interaction.reply({ content: '❌ Eine Ticket-ID ist erforderlich.', ...EPHEMERAL });
      const result = await reopenTicket(client, id, interaction.member);
      return interaction.reply({ content: result.ok ? '✅ Ticket wieder geöffnet: ' + result.channel : '❌ ' + result.error, ...EPHEMERAL });
    }

    if (!id) return interaction.reply({ content: '❌ Keine Ticket-ID angegeben und der aktuelle Channel ist kein Ticket.', ...EPHEMERAL });

    if (command === 'ticket-close') {
      return interaction.showModal(buildCloseModal(id));
    }
    if (command === 'ticket-claim') {
      const result = await claimTicket(client, id, interaction.member);
      return interaction.reply({ content: result.ok ? (result.claimed ? '✅ Ticket übernommen.' : '↩️ Ticket-Zuweisung entfernt.') : '❌ ' + result.error, ...EPHEMERAL });
    }
    if (command === 'ticket-add') {
      const user = interaction.options.getUser('user', true);
      const result = await addTicketMember(client, id, interaction.member, user.id);
      return interaction.reply({ content: result.ok ? '✅ Benutzer hinzugefügt.' : '❌ ' + result.error, ...EPHEMERAL });
    }
    if (command === 'ticket-remove') {
      const user = interaction.options.getUser('user', true);
      const result = await removeTicketMember(client, id, interaction.member, user.id);
      return interaction.reply({ content: result.ok ? '✅ Benutzer entfernt.' : '❌ ' + result.error, ...EPHEMERAL });
    }
    if (command === 'ticket-rename') {
      const result = await renameTicket(client, id, interaction.member, interaction.options.getString('name', true));
      return interaction.reply({ content: result.ok ? '✅ Ticket umbenannt: ' + result.name : '❌ ' + result.error, ...EPHEMERAL });
    }
    if (command === 'ticket-priority') {
      const result = await setTicketPriority(client, id, interaction.member, interaction.options.getString('priority', true));
      return interaction.reply({ content: result.ok ? '⭐ Priorität gesetzt.' : '❌ ' + result.error, ...EPHEMERAL });
    }
    if (command === 'ticket-lock' || command === 'ticket-unlock') {
      const result = await lockTicket(client, id, interaction.member, command === 'ticket-lock');
      return interaction.reply({ content: result.ok ? (command === 'ticket-lock' ? '🔐 Ticket gesperrt.' : '🔓 Ticket entsperrt.') : '❌ ' + result.error, ...EPHEMERAL });
    }
  }

  if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
  if (command === 'kick') {
    const member = interaction.options.getMember('user'); const reason = interaction.options.getString('grund') || 'Kein Grund angegeben';
    if (!member) return interaction.reply({ content: '❌ Mitglied nicht gefunden.', ...EPHEMERAL });
    if (!member.kickable) return interaction.reply({ content: '❌ Ich kann dieses Mitglied nicht kicken.', ...EPHEMERAL });
    try { await member.kick(reason); } catch { return interaction.reply({ content: '❌ Kick fehlgeschlagen.', ...EPHEMERAL }); }
    return interaction.reply({ content: `👢 ${member.user.tag} wurde gekickt.\n**Grund:** ${reason}`, ...EPHEMERAL });
  }
  if (command === 'ban') {
    const user = interaction.options.getUser('user'); const reason = interaction.options.getString('grund') || 'Kein Grund angegeben';
    if (!user) return interaction.reply({ content: '❌ Benutzer nicht gefunden.', ...EPHEMERAL });
    try { await interaction.guild.bans.create(user.id, { reason }); } catch { return interaction.reply({ content: '❌ Ban fehlgeschlagen. Prüfe Rechte/Rollenposition.', ...EPHEMERAL }); }
    return interaction.reply({ content: `🔨 ${user.tag} wurde gebannt.\n**Grund:** ${reason}`, ...EPHEMERAL });
  }
  if (command === 'unban') {
    const user = interaction.options.getUser('user'); if (!user) return interaction.reply({ content: '❌ Benutzer nicht gefunden.', ...EPHEMERAL });
    try { await interaction.guild.bans.remove(user.id); } catch { return interaction.reply({ content: '❌ Unban fehlgeschlagen (war der User gebannt?).', ...EPHEMERAL }); }
    return interaction.reply({ content: `✅ ${user.tag} wurde entbannt.`, ...EPHEMERAL });
  }
  if (command === 'timeout') {
    const member = interaction.options.getMember('user'); const minutes = interaction.options.getInteger('dauer'); const reason = interaction.options.getString('grund') || 'Kein Grund angegeben';
    if (!member) return interaction.reply({ content: '❌ Mitglied nicht gefunden.', ...EPHEMERAL });
    if (!member.moderatable) return interaction.reply({ content: '❌ Ich kann dieses Mitglied nicht pausieren.', ...EPHEMERAL });
    const ms = minutes * 60 * 1000; try { await member.timeout(ms, reason); } catch { return interaction.reply({ content: '❌ Timeout fehlgeschlagen.', ...EPHEMERAL }); }
    return interaction.reply({ content: `⏰ ${member.user.tag} wurde für ${minutes} Minute(n) pausiert.\n**Grund:** ${reason}`, ...EPHEMERAL });
  }
  if (command === 'giverole') {
    const member = interaction.options.getMember('user'); const role = interaction.options.getRole('rolle');
    if (!member) return interaction.reply({ content: '❌ Mitglied nicht gefunden.', ...EPHEMERAL });
    if (!role) return interaction.reply({ content: '❌ Rolle nicht gefunden.', ...EPHEMERAL });
    if (member.roles.cache.has(role.id)) return interaction.reply({ content: '❌ Der User hat die Rolle bereits.', ...EPHEMERAL });
    try { await member.roles.add(role); } catch { return interaction.reply({ content: '❌ Rolle konnte nicht vergeben werden. Prüfe Hierarchie.', ...EPHEMERAL }); }
    return interaction.reply({ content: `✅ ${member.user.tag} hat die Rolle ${role} erhalten.`, ...EPHEMERAL });
  }
  if (command === 'removerole') {
    const member = interaction.options.getMember('user'); const role = interaction.options.getRole('rolle');
    if (!member) return interaction.reply({ content: '❌ Mitglied nicht gefunden.', ...EPHEMERAL });
    if (!role) return interaction.reply({ content: '❌ Rolle nicht gefunden.', ...EPHEMERAL });
    if (!member.roles.cache.has(role.id)) return interaction.reply({ content: '❌ Der User hat diese Rolle nicht.', ...EPHEMERAL });
    try { await member.roles.remove(role); } catch { return interaction.reply({ content: '❌ Rolle konnte nicht entfernt werden.', ...EPHEMERAL }); }
    return interaction.reply({ content: `✅ ${member.user.tag} wurde die Rolle ${role} entfernt.`, ...EPHEMERAL });
  }
  if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
  if (command === 'embed') {
    const text = interaction.options.getString('text', true);
    const title = interaction.options.getString('titel') || '';
    const image = interaction.options.getString('bild') || '';
    const thumbnail = interaction.options.getString('thumbnail') || '';
    const color = interaction.options.getString('farbe') || '';
    const footer = interaction.options.getString('footer') || '';
    const container = embedV2({ title, description: text, image, thumbnail, color, footer });
    try {
      await interaction.channel.send({ components: [container], flags: V2, allowedMentions: { parse: [] } });
      return interaction.reply({ content: '✅ Components-V2-Embed gesendet.', ...EPHEMERAL });
    } catch (err) {
      return interaction.reply({ content: `❌ Components-V2-Embed konnte nicht gesendet werden: ${err.message}`, ...EPHEMERAL });
    }
  }
  if (command === 'nachricht') {
    const text = interaction.options.getString('text', true);
    const image = interaction.options.getString('bild') || '';
    const container = embedV2({ description: text, image });
    try {
      await interaction.channel.send({ components: [container], flags: V2, allowedMentions: { parse: [] } });
      return interaction.reply({ content: '✅ Components-V2-Embed gesendet.', ...EPHEMERAL });
    } catch (err) {
      return interaction.reply({ content: `❌ Components-V2-Embed konnte nicht gesendet werden: ${err.message}`, ...EPHEMERAL });
    }
  }
  if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
  if (['giveaway', 'giveaway-end', 'giveaway-reroll', 'giveaway-cancel', 'giveaway-list'].includes(command)) {
    if (!hasGiveawayManagePermission(interaction, config)) return interaction.reply({ content: '❌ Du darfst Giveaways nicht verwalten.', ...EPHEMERAL });

    if (command === 'giveaway') {
      const prize = interaction.options.getString('preis', true);
      const durationSeconds = interaction.options.getInteger('dauer', true);
      const winners = interaction.options.getInteger('gewinner') || 1;
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      if (!channel?.isTextBased()) return interaction.reply({ content: '❌ Der Ziel-Channel ist nicht textbasiert.', ...EPHEMERAL });
      const requiredRole = interaction.options.getRole('pflichtrolle');
      const bonusRole = interaction.options.getRole('bonusrolle');
      try {
        const result = await createGiveaway(client, channel, {
          prize, durationMs: durationSeconds * 1000, winnerCount: winners,
          requiredRoleId: requiredRole?.id || '',
          minAccountAgeDays: interaction.options.getInteger('accountalter') || 0,
          minServerAgeDays: interaction.options.getInteger('serveralter') || 0,
          bonusRoleId: bonusRole?.id || '',
          bonusEntries: interaction.options.getInteger('bonus') || 0
        }, interaction.user.id);
        return interaction.reply({ content: '✅ Giveaway erstellt und in ' + channel + ' gesendet.\nID: `' + result.id + '`', ...EPHEMERAL });
      } catch (error) {
        return interaction.reply({ content: '❌ Giveaway konnte nicht erstellt werden: ' + error.message, ...EPHEMERAL });
      }
    }

    const id = interaction.options.getString('id');
    if (command === 'giveaway-list') {
      const rows = await listGiveawayRecords(interaction.guildId, 25);
      if (!rows.length) return interaction.reply({ content: '📭 Noch keine Giveaways vorhanden.', ...EPHEMERAL });
      const lines = rows.map((row) => {
        const status = row.status === 'active' ? '🟢' : row.status === 'ended' ? '✅' : '🚫';
        return status + ' `' + row.id + '` — **' + row.prize + '** — ' + (row.entry_count || 0) + ' Teilnehmer';
      });
      const container = new ContainerBuilder().setAccentColor(0x2F3136);
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(('## 🎉 Giveaways\n' + lines.join('\n')).slice(0, 3900)));
      return interaction.reply({ components: [container], flags: EPHEMERAL_V2 });
    }

    if (!id) return interaction.reply({ content: '❌ Giveaway-ID fehlt.', ...EPHEMERAL });
    if (command === 'giveaway-end') {
      const winners = await finalizeGiveaway(client, { id, guild_id: interaction.guildId });
      return interaction.reply({ content: winners.length ? '✅ Giveaway beendet. Gewinner: ' + winners.map((uid) => '<@' + uid + '>').join(', ') : '✅ Giveaway beendet. Keine geeigneten Teilnehmer.', ...EPHEMERAL });
    }
    if (command === 'giveaway-cancel') {
      const result = await cancelGiveaway(client, id);
      return interaction.reply({ content: result.ok ? '✅ Giveaway abgebrochen.' : '❌ ' + result.error, ...EPHEMERAL });
    }
    const result = await rerollGiveaway(client, id);
    if (!result.ok) return interaction.reply({ content: '❌ ' + result.error, ...EPHEMERAL });
    return interaction.reply({ content: result.winners.length ? '🔁 Neue Gewinner: ' + result.winners.map((uid) => '<@' + uid + '>').join(', ') : '🔁 Keine weiteren geeigneten Teilnehmer.', ...EPHEMERAL });
  }
  if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
  if (command === 'verify') {
    try { config.verify.channelId = interaction.channelId; config.verify.enabled = true; await saveGuildSettings(interaction.guildId, config, interaction.user.id); await interaction.channel.send({ components: [verifyComponents(config)], flags: V2, allowedMentions: { parse: [] } }); return interaction.reply({ content: '✅ Verify-Panel gesendet.', ...EPHEMERAL }); } catch (err) { return interaction.reply({ content: `❌ Verify-Panel fehlgeschlagen: ${err.message}`, ...EPHEMERAL }); }
  }
  if (command === 'setup') {
    const container = new ContainerBuilder().setAccentColor(0x2F3136);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## BWW Setup\n`/setup-welcome` [channel] [text] [title?] → Welcome\n`/setup-verify` → Verify\n`/setup-ticket` [kategorie] [rolle] → Ticket\n`/setup-honeypot` → Honeypot\n`/setup-status` [channel] → Status-Embed\n`/setup-permission` → Command-Berechtigungen\n`/restart` → Bot neu starten\n`/dashboard-code` → Web-Dashboard-Zugang erzeugen\n`/wartung` → Wartung an/aus\n`/panel-create` → Custom Panel (10 Buttons) speichern+senden\n`/panel-add-button` → Button hinzufügen\n`/panel-send`/`/panel-delete`/`/panel-list` → Panels verwalten\n`/kick`, `/ban`, `/unban`, `/timeout` → Moderation\n`/giverole`, `/removerole` → Rollen'));
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('**Welcome-Platzhalter:**\n`{user}` → Ping\n`{username}` → Name\n`{displayname}` → Server-Nickname\n`{server}` → Servername\n`{id}` → User-ID\n`{count}` → Mitgliederzahl\n\nDer Avatar des Users erscheint automatisch oben rechts.'));
    return interaction.reply({ components: [container], flags: EPHEMERAL_V2 });
  }
  } catch (err) {
    console.error('Interaction Handler Fehler:', err.stack || err.message);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Unerwarteter Fehler.', ...EPHEMERAL }).catch(() => {});
    }
  }
};
