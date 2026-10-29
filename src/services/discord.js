// BWW Phase 1 – Discord-Helper-Service (01_ARCHITECTURE Kap. 4: discord).
// Kapselt Cache-vs-Fetch-Fallbacks, damit Module keine discord.js-Feinheiten duplizieren.

async function fetchGuild(client, guildId) {
  const id = String(guildId || '').replace(/\D/g, '');
  if (!id) return null;
  return client.guilds.cache.get(id) || (await client.guilds.fetch(id).catch(() => null));
}

async function fetchMember(guild, userId) {
  const id = String(userId || '').replace(/\D/g, '');
  if (!guild || !id) return null;
  return guild.members.cache.get(id) || (await guild.members.fetch(id).catch(() => null));
}

async function fetchTextChannel(guild, channelId) {
  const id = String(channelId || '').replace(/\D/g, '');
  if (!guild || !id) return null;
  const channel = guild.channels.cache.get(id) || (await guild.channels.fetch(id).catch(() => null));
  if (!channel?.isTextBased?.()) return null;
  return channel;
}

module.exports = { fetchGuild, fetchMember, fetchTextChannel };
