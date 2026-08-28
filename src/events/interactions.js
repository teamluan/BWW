const { EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { isAllowed } = require('../commands');
const { save } = require('../config');
const { verifyMessage } = require('../utils/embeds');
const { documentMenu, documentForValue } = require('../utils/documents');

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

module.exports = async interaction => {
  const config = require('../config').load();

  if (interaction.isButton() && interaction.customId === 'bww_verify') {
    if (!config.verify.roleId) return interaction.reply({ content: '❌ Keine Verifizierungsrolle eingerichtet.', ...EPHEMERAL });
    const role = interaction.guild.roles.cache.get(config.verify.roleId);
    if (!role) return interaction.reply({ content: '❌ Die Verifizierungsrolle existiert nicht mehr.', ...EPHEMERAL });
    try { await interaction.member.roles.add(role); } catch { return interaction.reply({ content: '❌ Ich konnte die Rolle nicht vergeben. Prüfe meine Rollenposition.', ...EPHEMERAL }); }
    return interaction.reply({ content: '✅ Du wurdest erfolgreich verifiziert.', ...EPHEMERAL });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'bww_doc_select') {
    const doc = documentForValue(interaction.values[0]);
    if (!doc) return interaction.reply({ content: '❌ Dokument nicht gefunden.', ...EPHEMERAL });
    const embed = new EmbedBuilder().setColor(0x2f3136).setDescription(doc.text).setTimestamp();
    return interaction.reply({ embeds: [embed], ...EPHEMERAL });
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
    const name = interaction.options.getString('command', true);
    const role = interaction.options.getRole('role');
    const allow = interaction.options.getBoolean('erlauben', true);
    config.permissions[name] ||= [];
    if (allow && !config.permissions[name].includes(role.id)) config.permissions[name].push(role.id);
    if (!allow) config.permissions[name] = config.permissions[name].filter(id => id !== role.id);
    save(config);
    return interaction.reply({ content: `✅ Rolle ${role} für /${name} ${allow ? 'erlaubt' : 'entfernt'}.`, ...EPHEMERAL });
  }

  if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ...EPHEMERAL });

  if (command === 'nachricht') {
    const embed = new EmbedBuilder().setColor(0x2f3136).setDescription(interaction.options.getString('text', true)).setTimestamp();
    const image = interaction.options.getString('bild');
    if (image) embed.setImage(image);
    await interaction.channel.send({ embeds: [embed] });
    return interaction.reply({ content: '✅ Embed gesendet.', ...EPHEMERAL });
  }
  if (command === 'nachrichtauswahl') {
    await interaction.channel.send(documentMenu());
    return interaction.reply({ content: '✅ Dokumenten-Auswahl gesendet.', ...EPHEMERAL });
  }
  if (command === 'verify') {
    config.verify.channelId = interaction.channelId; config.verify.enabled = true; save(config);
    await interaction.channel.send(verifyMessage(config));
    return interaction.reply({ content: '✅ Verify-Panel gesendet.', ...EPHEMERAL });
  }
  if (command === 'setup') {
    const embed = new EmbedBuilder().setTitle('BWW Setup').setColor(0x2f3136).setDescription(
      '`/setup-welcome` [channel] [text] [title?] → Welcome\n' +
      '`/setup-verify` → Verify\n' +
      '`/setup-permission` → Command-Berechtigungen\n\n' +
      '**Welcome-Platzhalter:**\n' +
      '`{user}` → Ping\n`{username}` → Name\n`{displayname}` → Server-Nickname\n' +
      '`{server}` → Servername\n`{id}` → User-ID\n`{count}` → Mitgliederzahl\n\n' +
      'Der Avatar des Users erscheint automatisch oben rechts.'
    );
    return interaction.reply({ embeds: [embed], ...EPHEMERAL });
  }
};
