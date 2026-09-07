const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

function resolveWelcomeText(text, member) {
  return String(text || '')
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{displayname}', member.displayName || member.user.username)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{id}', member.id)
    .replaceAll('{count}', String(member.guild.memberCount));
}

// Components V2: Welcome
function welcomeComponents(message, member, options = {}) {
  const text = resolveWelcomeText(message, member);
  const title = options.title ? resolveWelcomeText(options.title, member) : null;
  const avatar = member.user.displayAvatarURL({ size: 256 });
  const container = new ContainerBuilder().setAccentColor(0x2F3136);
  if (title) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`));
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  }
  const section = new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar).setDescription(`Avatar von ${member.user.username}`));
  container.addSectionComponents(section);
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <t:${Math.floor(Date.now() / 1000)}:F>`));
  return container;
}

// Legacy embed (deprecated, kept for compat)
function welcomeEmbed(message, member, options = {}) {
  const { EmbedBuilder } = require('discord.js');
  const text = resolveWelcomeText(message, member);
  const avatar = member.user.displayAvatarURL({ size: 256 });
  const embed = new EmbedBuilder().setColor(0x2f3136).setDescription(text).setThumbnail(avatar).setTimestamp();
  if (options.title) embed.setTitle(resolveWelcomeText(options.title, member));
  return embed;
}

function verifyComponents(config) {
  const container = new ContainerBuilder().setAccentColor(0x2F3136);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Verifizierung\n${config.verify.message}`));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bww_verify').setLabel('Verifizieren').setStyle(ButtonStyle.Success));
  container.addActionRowComponents(row);
  return container;
}

function verifyMessage(config) {
  const { EmbedBuilder } = require('discord.js');
  const embed = new EmbedBuilder().setColor(0x2f3136).setTitle('Verifizierung').setDescription(config.verify.message).setTimestamp();
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bww_verify').setLabel('Verifizieren').setStyle(ButtonStyle.Success));
  return { embeds: [embed], components: [row] };
}

module.exports = { welcomeComponents, welcomeEmbed, verifyComponents, verifyMessage, resolveWelcomeText };
