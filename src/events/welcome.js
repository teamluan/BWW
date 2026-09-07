const { welcomeComponents } = require('../utils/embeds');
const { PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = async (member) => {
  try {
    if (member.user.bot) return;
    const config = require('../config').load();
    if (!config.welcome.enabled || !config.welcome.channelId) return;
    const guild = member.guild;
    let channel = guild.channels.cache.get(config.welcome.channelId);
    if (!channel) { try { channel = await guild.channels.fetch(config.welcome.channelId); } catch { return; } }
    if (!channel?.isTextBased()) return;
    const me = guild.members.me;
    if (me && !channel.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) { console.warn(`Welcome: keine Send-Rechte in #${channel.name}`); return; }
    await channel.send({ components: [welcomeComponents(config.welcome.message, member, { title: config.welcome.title })], flags: MessageFlags.IsComponentsV2 });
  } catch (err) { console.warn('Welcome Fehler:', err.message); }
};
