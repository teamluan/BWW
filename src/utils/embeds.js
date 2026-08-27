const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function resolveWelcomeText(text, member) {
  return String(text || '')
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{displayname}', member.displayName || member.user.username)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{id}', member.id)
    .replaceAll('{count}', String(member.guild.memberCount));
}

function welcomeEmbed(message, member, options = {}) {
  const text = resolveWelcomeText(message, member);
  const avatar = member.user.displayAvatarURL({ size: 256 });
  const embed = new EmbedBuilder().setColor(0x2f3136).setDescription(text).setThumbnail(avatar).setTimestamp();
  if (options.title) embed.setTitle(resolveWelcomeText(options.title, member));
  return embed;
}

function verifyMessage(config) {
  const embed = new EmbedBuilder().setColor(0x2f3136).setTitle('Verifizierung').setDescription(config.verify.message).setTimestamp();
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bww_verify').setLabel('Verifizieren').setStyle(ButtonStyle.Success));
  return { embeds: [embed], components: [row] };
}

module.exports = { welcomeEmbed, verifyMessage };
