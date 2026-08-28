const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAllowed } = require('../commands');
const { save } = require('../config');
const { verifyMessage } = require('../utils/embeds');

module.exports = async interaction => {
  const config = require('../config').load();

  if (interaction.isButton() && interaction.customId === 'bww_verify') {
    if (!config.verify.roleId) return interaction.reply({ content: '❌ Keine Verifizierungsrolle eingerichtet.', ephemeral: true });
    const role = interaction.guild.roles.cache.get(config.verify.roleId);
    if (!role) return interaction.reply({ content: '❌ Die Verifizierungsrolle existiert nicht mehr.', ephemeral: true });
    try { await interaction.member.roles.add(role); } catch { return interaction.reply({ content: '❌ Ich konnte die Rolle nicht vergeben. Prüfe meine Rollenposition.', ephemeral: true }); }
    return interaction.reply({ content: '✅ Du wurdest erfolgreich verifiziert.', ephemeral: true });
  }

  if (!interaction.isChatInputCommand()) return;
  const command = interaction.commandName;

  if (command.startsWith('setup-')) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ Nur Administratoren dürfen das Setup ändern.', ephemeral: true });
    if (command === 'setup-welcome') {
      config.welcome = { enabled: true, channelId: interaction.options.getChannel('channel').id, title: interaction.options.getString('title') || '', message: interaction.options.getString('text', true) };
      save(config); return interaction.reply({ content: '✅ Welcome-System gespeichert.', ephemeral: true });
    }
    if (command === 'setup-verify') {
      config.verify = { enabled: true, channelId: interaction.options.getChannel('channel').id, roleId: interaction.options.getRole('role').id, message: interaction.options.getString('text', true) };
      save(config); return interaction.reply({ content: '✅ Verify-System gespeichert.', ephemeral: true });
    }
    const name = interaction.options.getString('command', true);
    const role = interaction.options.getRole('role');
    const allow = interaction.options.getBoolean('erlauben', true);
    config.permissions[name] ||= [];
    if (allow && !config.permissions[name].includes(role.id)) config.permissions[name].push(role.id);
    if (!allow) config.permissions[name] = config.permissions[name].filter(id => id !== role.id);
    save(config);
    return interaction.reply({ content: `✅ Rolle ${role} für /${name} ${allow ? 'erlaubt' : 'entfernt'}.`, ephemeral: true });
  }

  if (!isAllowed(interaction, config)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ephemeral: true });

  if (command === 'nachricht') {
    const embed = new EmbedBuilder().setColor(0x2f3136).setDescription(interaction.options.getString('text', true)).setTimestamp();
    const image = interaction.options.getString('bild');
    if (image) embed.setImage(image);
    await interaction.channel.send({ embeds: [embed] });
    return interaction.reply({ content: '✅ Embed gesendet.', ephemeral: true });
  }
  if (command === 'verify') {
    config.verify.channelId = interaction.channelId; config.verify.enabled = true; save(config);
    await interaction.channel.send(verifyMessage(config));
    return interaction.reply({ content: '✅ Verify-Panel gesendet.', ephemeral: true });
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
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
