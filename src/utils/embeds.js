const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function welcomeEmbed(message, member) {
  const text = message.replaceAll('{user}', `<@${member.id}>`).replaceAll('{username}', member.user.username).replaceAll('{server}', member.guild.name);
  return new EmbedBuilder().setColor(0x2f3136).setDescription(text).setTimestamp();
}

function verifyMessage(config) {
  const embed = new EmbedBuilder().setColor(0x2f3136).setTitle('Verifizierung').setDescription(config.verify.message).setTimestamp();
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bww_verify').setLabel('Verifizieren').setStyle(ButtonStyle.Success));
  return { embeds: [embed], components: [row] };
}

module.exports = { welcomeEmbed, verifyMessage };
