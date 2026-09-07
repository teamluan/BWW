const { EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { isAllowed } = require('../commands');
const { save } = require('../config');
const { verifyMessage } = require('../utils/embeds');
const { documentMenu, documentForValue } = require('../utils/documents');
const { ticketPanel, createTicket, TICKET_REASONS } = require('../utils/tickets');
const { loadGiveaways, saveGiveaways, giveawayMessage, startGiveaway, finalizeGiveaway, rerollGiveaway, updateGiveawayMessage } = require('../utils/giveaway');

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

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
  const config = require('../config').load();

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

  if (interaction.isButton() && interaction.customId.startsWith('bww_giveaway_')) {
    const parts = interaction.customId.split('_');
    const action = parts[2];
    const id = parts.slice(3).join('_');
    if (!['join', 'leave', 'end', 'reroll'].includes(action)) return;
    const list = loadGiveaways();
    const g = list.find(x => x.id === id);

    if (action === 'join') {
      if (!g || !g.active) return interaction.reply({ content: '❌ Dieses Giveaway ist bereits beendet.', ...EPHEMERAL });
      if (g.entries.includes(interaction.user.id)) return interaction.reply({ content: '❌ Du nimmst bereits teil.', ...EPHEMERAL });
      g.entries.push(interaction.user.id);
      saveGiveaways(list);
      await updateGiveawayMessage(client, g);
      return interaction.reply({ content: '🎉 Du nimmst jetzt am Giveaway teil!', ...EPHEMERAL });
    }

    if (action === 'leave') {
      if (!g || !g.active) return interaction.reply({ content: '❌ Dieses Giveaway ist bereits beendet.', ...EPHEMERAL });
      const idx = g.entries.indexOf(interaction.user.id);
      if (idx === -1) return interaction.reply({ content: '❌ Du nimmst nicht an diesem Giveaway teil.', ...EPHEMERAL });
      g.entries.splice(idx, 1);
      saveGiveaways(list);
      await updateGiveawayMessage(client, g);
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

  if (interaction.isButton() && interaction.customId.startsWith('bww_doc_')) {
    const value = interaction.customId.replace('bww_doc_', '');
    const doc = documentForValue(value);
    if (!doc) return interaction.reply({ content: '❌ Dokument nicht gefunden.', ...EPHEMERAL });
    const embed = new EmbedBuilder().setColor(0x2f3136).setDescription(doc.text).setTimestamp();
    return interaction.reply({ embeds: [embed], ...EPHEMERAL });
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
    if (command === 'setup-welcome') {
      config.welcome = { enabled: true, channelId: interaction.options.getChannel('channel').id, title: interaction.options.getString('title') || '', message: interaction.options.getString('text', true) };
      save(config); return interaction.reply({ content: '✅ Welcome-System gespeichert.', ...EPHEMERAL });
    }
    if (command === 'setup-verify') {
      config.verify = { enabled: true, channelId: interaction.options.getChannel('channel').id, roleId: interaction.options.getRole('role').id, message: interaction.options.getString('text', true) };
      save(config); return interaction.reply({ content: '✅ Verify-System gespeichert.', ...EPHEMERAL });
    }
    if (command === 'setup-ticket') {
      config.ticket = { enabled: true, categoryId: interaction.options.getChannel('kategorie').id, roleId: interaction.options.getRole('rolle').id };
      save(config); return interaction.reply({ content: '✅ Ticket-System gespeichert.', ...EPHEMERAL });
    }
    const name = interaction.options.getString('command', true);
    const role = interaction.options.getRole('role');
    const allow = interaction.options.getBoolean('erlauben', true);
    config.permissions[name] ||= [];
    if (allow && !config.permissions[name].includes(role.id)) config.permissions[name].push(role.id);
    if (!allow) config.permissions[name] = config.permissions[name].filter(id => id !== role.id);
    save(config);
    return interaction.reply({ content: `✅ Rolle ${role} für /${name} ${allow ? 'erlaubt' : 'entfernt'}.`, ...EPHEMERAL });
  }

  if (command === 'restart') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ Nur Administratoren dürfen den Bot neu starten.', ...EPHEMERAL });
    await interaction.reply({ content: '🔄 Bot wird neu gestartet…', ...EPHEMERAL });
    setTimeout(() => process.exit(0), 1000);
    return;
  }

  if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });

  if (command === 'kick') {
    const member = interaction.options.getMember('user');
    const reason = interaction.options.getString('grund') || 'Kein Grund angegeben';
    if (!member) return interaction.reply({ content: '❌ Mitglied nicht gefunden.', ...EPHEMERAL });
    if (!member.kickable) return interaction.reply({ content: '❌ Ich kann dieses Mitglied nicht kicken.', ...EPHEMERAL });
    try { await member.kick(reason); } catch { return interaction.reply({ content: '❌ Kick fehlgeschlagen.', ...EPHEMERAL }); }
    return interaction.reply({ content: `👢 ${member.user.tag} wurde gekickt.\n**Grund:** ${reason}`, ...EPHEMERAL });
  }
  if (command === 'ban') {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('grund') || 'Kein Grund angegeben';
    if (!user) return interaction.reply({ content: '❌ Benutzer nicht gefunden.', ...EPHEMERAL });
    try { await interaction.guild.bans.create(user.id, { reason }); } catch { return interaction.reply({ content: '❌ Ban fehlgeschlagen. Prüfe Rechte/Rollenposition.', ...EPHEMERAL }); }
    return interaction.reply({ content: `🔨 ${user.tag} wurde gebannt.\n**Grund:** ${reason}`, ...EPHEMERAL });
  }
  if (command === 'unban') {
    const user = interaction.options.getUser('user');
    if (!user) return interaction.reply({ content: '❌ Benutzer nicht gefunden.', ...EPHEMERAL });
    try { await interaction.guild.bans.remove(user.id); } catch { return interaction.reply({ content: '❌ Unban fehlgeschlagen (war der User gebannt?).', ...EPHEMERAL }); }
    return interaction.reply({ content: `✅ ${user.tag} wurde entbannt.`, ...EPHEMERAL });
  }
  if (command === 'timeout') {
    const member = interaction.options.getMember('user');
    const minutes = interaction.options.getInteger('dauer');
    const reason = interaction.options.getString('grund') || 'Kein Grund angegeben';
    if (!member) return interaction.reply({ content: '❌ Mitglied nicht gefunden.', ...EPHEMERAL });
    if (!member.moderatable) return interaction.reply({ content: '❌ Ich kann dieses Mitglied nicht pausieren.', ...EPHEMERAL });
    const ms = minutes * 60 * 1000;
    try { await member.timeout(ms, reason); } catch { return interaction.reply({ content: '❌ Timeout fehlgeschlagen.', ...EPHEMERAL }); }
    return interaction.reply({ content: `⏰ ${member.user.tag} wurde für ${minutes} Minute(n) pausiert.\n**Grund:** ${reason}`, ...EPHEMERAL });
  }
  if (command === 'giverole') {
    const member = interaction.options.getMember('user');
    const role = interaction.options.getRole('rolle');
    if (!member) return interaction.reply({ content: '❌ Mitglied nicht gefunden.', ...EPHEMERAL });
    if (!role) return interaction.reply({ content: '❌ Rolle nicht gefunden.', ...EPHEMERAL });
    if (member.roles.cache.has(role.id)) return interaction.reply({ content: '❌ Der User hat die Rolle bereits.', ...EPHEMERAL });
    try { await member.roles.add(role); } catch { return interaction.reply({ content: '❌ Rolle konnte nicht vergeben werden. Prüfe Hierarchie.', ...EPHEMERAL }); }
    return interaction.reply({ content: `✅ ${member.user.tag} hat die Rolle ${role} erhalten.`, ...EPHEMERAL });
  }
  if (command === 'removerole') {
    const member = interaction.options.getMember('user');
    const role = interaction.options.getRole('rolle');
    if (!member) return interaction.reply({ content: '❌ Mitglied nicht gefunden.', ...EPHEMERAL });
    if (!role) return interaction.reply({ content: '❌ Rolle nicht gefunden.', ...EPHEMERAL });
    if (!member.roles.cache.has(role.id)) return interaction.reply({ content: '❌ Der User hat diese Rolle nicht.', ...EPHEMERAL });
    try { await member.roles.remove(role); } catch { return interaction.reply({ content: '❌ Rolle konnte nicht entfernt werden.', ...EPHEMERAL }); }
    return interaction.reply({ content: `✅ ${member.user.tag} wurde die Rolle ${role} entfernt.`, ...EPHEMERAL });
  }

  if (command === 'nachricht') {
    const embed = new EmbedBuilder().setColor(0x2f3136).setDescription(interaction.options.getString('text', true)).setTimestamp();
    const image = interaction.options.getString('bild');
    if (image) embed.setImage(image);
    try {
      await interaction.channel.send({ embeds: [embed] });
      return interaction.reply({ content: '✅ Embed gesendet.', ...EPHEMERAL });
    } catch (err) {
      return interaction.reply({ content: `❌ Embed konnte nicht gesendet werden: ${err.message}`, ...EPHEMERAL });
    }
  }
  if (command === 'nachrichtauswahl') {
    const intro = interaction.options.getString('text') || undefined;
    try {
      await interaction.channel.send(documentMenu(intro));
      return interaction.reply({ content: '✅ Dokumenten-Auswahl gesendet.', ...EPHEMERAL });
    } catch (err) {
      return interaction.reply({ content: `❌ Konnte nicht gesendet werden: ${err.message}`, ...EPHEMERAL });
    }
  }
  if (command === 'ticket') {
    try {
      await interaction.channel.send(ticketPanel(config));
      return interaction.reply({ content: '✅ Ticket-Panel gesendet.', ...EPHEMERAL });
    } catch (err) {
      return interaction.reply({ content: `❌ Ticket-Panel fehlgeschlagen: ${err.message}`, ...EPHEMERAL });
    }
  }
  if (command === 'giveaway') {
    const prize = interaction.options.getString('preis', true);
    const winners = Math.max(1, interaction.options.getInteger('gewinner') || 1);
    const durationMs = interaction.options.getInteger('dauer') * 1000 || 60000;
    try {
      await startGiveaway(interaction.channel, prize, durationMs, winners);
      return interaction.reply({ content: '✅ Giveaway gestartet!', ...EPHEMERAL });
    } catch (err) {
      return interaction.reply({ content: `❌ Giveaway fehlgeschlagen: ${err.message}`, ...EPHEMERAL });
    }
  }
  if (command === 'verify') {
    try {
      config.verify.channelId = interaction.channelId; config.verify.enabled = true; save(config);
      await interaction.channel.send(verifyMessage(config));
      return interaction.reply({ content: '✅ Verify-Panel gesendet.', ...EPHEMERAL });
    } catch (err) {
      return interaction.reply({ content: `❌ Verify-Panel fehlgeschlagen: ${err.message}`, ...EPHEMERAL });
    }
  }
  if (command === 'setup') {
    const embed = new EmbedBuilder().setTitle('BWW Setup').setColor(0x2f3136).setDescription(
      '`/setup-welcome` [channel] [text] [title?] → Welcome\n' +
      '`/setup-verify` → Verify\n' +
      '`/setup-ticket` [kategorie] [rolle] → Ticket\n' +
      '`/setup-permission` → Command-Berechtigungen\n' +
      '`/restart` → Bot neu starten\n' +
      '`/kick`, `/ban`, `/unban`, `/timeout` → Moderation\n' +
      '`/giverole`, `/removerole` → Rollen\n\n' +
      '**Welcome-Platzhalter:**\n' +
      '`{user}` → Ping\n`{username}` → Name\n`{displayname}` → Server-Nickname\n' +
      '`{server}` → Servername\n`{id}` → User-ID\n`{count}` → Mitgliederzahl\n\n' +
      'Der Avatar des Users erscheint automatisch oben rechts.'
    );
    return interaction.reply({ embeds: [embed], ...EPHEMERAL });
  }
  } catch (err) {
    console.error('Interaction Handler Fehler:', err.stack || err.message);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Unerwarteter Fehler.', ...EPHEMERAL }).catch(() => {});
    }
  }
};
