const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { isAllowed } = require('../commands');
const { getGuildSettings, saveGuildSettings, createDashboardCode, findEmbedInteraction } = require('../utils/database');
const { embedV2, verifyComponents } = require('../utils/embeds');
const { ticketContainer, createTicket, TICKET_REASONS } = require('../utils/tickets');
const { loadGiveaways, saveGiveaways, giveawayContainer, startGiveaway, finalizeGiveaway, rerollGiveaway, updateGiveawayMessage } = require('../utils/giveaway');
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
  if (interaction.isButton() && interaction.customId === 'bww_ticket_close') {
    if (!canCloseTicket(interaction, config)) return interaction.reply({ content: '❌ Du darfst dieses Ticket nicht schließen.', ...EPHEMERAL });
    await interaction.reply({ content: '🔒 Ticket wird geschlossen und gelöscht…', ...EPHEMERAL });
    setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith('bww_panel_')) {
    const parts = interaction.customId.split('_');
    const idx = parseInt(parts.pop(), 10);
    const name = parts.slice(2).join('_');
    const panel = getPanel(name);
    if (!panel || !panel.buttons[idx]) return interaction.reply({ content: '❌ Panel oder Button nicht gefunden.', ...EPHEMERAL });
    const button = panel.buttons[idx];
    const container = buttonResponseContainer(name, button);
    return interaction.reply({ components: [container], flags: EPHEMERAL_V2, allowedMentions: { parse: [] } });
  }
  if (interaction.isButton() && interaction.customId.startsWith('bww_giveaway_')) {
    const parts = interaction.customId.split('_'); const action = parts[2]; const id = parts.slice(3).join('_');
    if (!['join', 'leave', 'end', 'reroll'].includes(action)) return;
    const list = loadGiveaways(); const g = list.find(x => x.id === id);
    if (action === 'join') {
      if (!g || !g.active) return interaction.reply({ content: '❌ Dieses Giveaway ist bereits beendet.', ...EPHEMERAL });
      if (g.entries.includes(interaction.user.id)) return interaction.reply({ content: '❌ Du nimmst bereits teil.', ...EPHEMERAL });
      g.entries.push(interaction.user.id); saveGiveaways(list); await updateGiveawayMessage(client, g);
      return interaction.reply({ content: '🎉 Du nimmst jetzt am Giveaway teil!', ...EPHEMERAL });
    }
    if (action === 'leave') {
      if (!g || !g.active) return interaction.reply({ content: '❌ Dieses Giveaway ist bereits beendet.', ...EPHEMERAL });
      const idx = g.entries.indexOf(interaction.user.id); if (idx === -1) return interaction.reply({ content: '❌ Du nimmst nicht an diesem Giveaway teil.', ...EPHEMERAL });
      g.entries.splice(idx, 1); saveGiveaways(list); await updateGiveawayMessage(client, g);
      return interaction.reply({ content: '👋 Du hast das Giveaway verlassen.', ...EPHEMERAL });
    }
    if (action === 'end' || action === 'reroll') {
      if (!hasGiveawayManagePermission(interaction, config)) return interaction.reply({ content: '❌ Du darfst das Giveaway nicht verwalten.', ...EPHEMERAL });
      if (action === 'end') {
        if (!g || !g.active) return interaction.reply({ content: '❌ Dieses Giveaway ist bereits beendet.', ...EPHEMERAL });
        const winners = await finalizeGiveaway(client, g);
        return interaction.reply({ content: winners.length ? `✅ Giveaway beendet. Gewinner: ${winners.map(w => `<@${w}>`).join(', ')}` : '✅ Giveaway beendet. Keine Teilnehmer.', ...EPHEMERAL });
      } else {
        const res = await rerollGiveaway(client, id);
        if (!res.ok) return interaction.reply({ content: `❌ ${res.error}`, ...EPHEMERAL });
        const winText = res.winners.length ? res.winners.map(w => `<@${w}>`).join(', ') : 'Keine Teilnehmer übrig 😔';
        return interaction.reply({ content: `🔁 Neu gezogen: ${winText}`, ...EPHEMERAL });
      }
    }
  }
  if (interaction.isStringSelectMenu() && interaction.customId === 'bww_ticket_select') {
    const reason = TICKET_REASONS.find(r => r.value === interaction.values[0]);
    const res = await createTicket(interaction.guild, config, interaction.user, reason ? reason.label : interaction.values[0]);
    if (!res.ok) return interaction.reply({ content: `❌ ${res.error}`, ...EPHEMERAL });
    return interaction.reply({ content: `✅ Ticket erstellt: ${res.channel}`, ...EPHEMERAL });
  }
  if (!interaction.isChatInputCommand()) return;
  const command = interaction.commandName;
  if (command.startsWith('setup-')) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ Nur Administratoren dürfen das Setup ändern.', ...EPHEMERAL });
    if (command === 'setup-welcome') { config.welcome = { enabled: true, channelId: interaction.options.getChannel('channel').id, title: interaction.options.getString('title') || '', message: interaction.options.getString('text', true) }; await saveGuildSettings(interaction.guildId, config, interaction.user.id); return interaction.reply({ content: '✅ Welcome-System gespeichert.', ...EPHEMERAL }); }
    if (command === 'setup-verify') { config.verify = { enabled: true, channelId: interaction.options.getChannel('channel').id, roleId: interaction.options.getRole('role').id, message: interaction.options.getString('text', true) }; await saveGuildSettings(interaction.guildId, config, interaction.user.id); return interaction.reply({ content: '✅ Verify-System gespeichert.', ...EPHEMERAL }); }
    if (command === 'setup-ticket') { config.ticket = { enabled: true, categoryId: interaction.options.getChannel('kategorie').id, roleId: interaction.options.getRole('rolle').id }; await saveGuildSettings(interaction.guildId, config, interaction.user.id); return interaction.reply({ content: '✅ Ticket-System gespeichert.', ...EPHEMERAL }); }
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
  if (command === 'ticket') {
    try { await interaction.channel.send({ components: [ticketContainer(config)], flags: V2 }); return interaction.reply({ content: '✅ Ticket-Panel gesendet.', ...EPHEMERAL }); } catch (err) { return interaction.reply({ content: `❌ Ticket-Panel fehlgeschlagen: ${err.message}`, ...EPHEMERAL }); }
  }
  if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
  if (command === 'giveaway') {
    const prize = interaction.options.getString('preis', true); const winners = Math.max(1, interaction.options.getInteger('gewinner') || 1); const durationMs = interaction.options.getInteger('dauer') * 1000 || 60000;
    try { await startGiveaway(interaction.channel, prize, durationMs, winners); return interaction.reply({ content: '✅ Giveaway gestartet!', ...EPHEMERAL }); } catch (err) { return interaction.reply({ content: `❌ Giveaway fehlgeschlagen: ${err.message}`, ...EPHEMERAL }); }
  }
  if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });
  if (command === 'verify') {
    try { config.verify.channelId = interaction.channelId; config.verify.enabled = true; await saveGuildSettings(interaction.guildId, config, interaction.user.id); await interaction.channel.send({ components: [verifyComponents(config)], flags: V2, allowedMentions: { parse: [] } }); return interaction.reply({ content: '✅ Verify-Panel gesendet.', ...EPHEMERAL }); } catch (err) { return interaction.reply({ content: `❌ Verify-Panel fehlgeschlagen: ${err.message}`, ...EPHEMERAL }); }
  }
  if (command === 'setup') {
    const container = new ContainerBuilder().setAccentColor(0x2F3136);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## BWW Setup\n`/setup-welcome` [channel] [text] [title?] → Welcome\n`/setup-verify` → Verify\n`/setup-ticket` [kategorie] [rolle] → Ticket\n`/setup-status` [channel] → Status-Embed\n`/setup-permission` → Command-Berechtigungen\n`/restart` → Bot neu starten\n`/dashboard-code` → Web-Dashboard-Zugang erzeugen\n`/wartung` → Wartung an/aus\n`/panel-create` → Custom Panel (10 Buttons) speichern+senden\n`/panel-add-button` → Button hinzufügen\n`/panel-send`/`/panel-delete`/`/panel-list` → Panels verwalten\n`/kick`, `/ban`, `/unban`, `/timeout` → Moderation\n`/giverole`, `/removerole` → Rollen'));
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
