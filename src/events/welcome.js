const { welcomeEmbed } = require('../utils/embeds');

module.exports = member => {
  const config = require('../config').load();
  if (!config.welcome.enabled || !config.welcome.channelId) return;
  const channel = member.guild.channels.cache.get(config.welcome.channelId);
  if (!channel?.isTextBased()) return;
  return channel.send({ embeds: [welcomeEmbed(config.welcome.message, member, { title: config.welcome.title })] }).catch(() => {});
};
