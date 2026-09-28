require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, Events, MessageFlags } = require('discord.js');
const { commands } = require('./commands');
const welcome = require('./events/welcome');
const interactions = require('./events/interactions');
const { startGiveawayLoop } = require('./utils/giveaway');
const { updateStatusMessage, ensureStatusMessage, formatUptime } = require('./utils/status');
const { isConfigured: databaseConfigured, getGuildSettings, upsertBotStatus, syncGuilds, markOffline } = require('./utils/database');

const token = process.env.DISCORD_TOKEN || '';
if (!token) {
  console.error('DISCORD_TOKEN fehlt in den Umgebungsvariablen.');
  process.exit(1);
}
console.log('[BWW] Token geladen.');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember],
});

async function syncDatabase(bot, status = 'online') {
  if (!databaseConfigured()) return;
  try {
    await Promise.all([
      upsertBotStatus(bot, status),
      syncGuilds(bot)
    ]);
  } catch (err) {
    console.error('[BWW] Datenbank-Synchronisierung fehlgeschlagen:', err.message);
  }
}

client.once(Events.ClientReady, async (bot) => {
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(bot.user.id), { body: commands });
    console.log(`BWW Bot online als ${bot.user.tag}`);
  } catch (err) {
    console.error('Slash-Command Registrierung fehlgeschlagen:', err.message);
    console.log(`BWW Bot online als ${bot.user.tag} (Commands nicht aktualisiert)`);
  }

  await syncDatabase(bot, 'online');
  setInterval(() => syncDatabase(bot, 'online'), 30 * 1000);
  startGiveawayLoop(client);

  for (const guild of client.guilds.cache.values()) {
    try {
      const cfg = await getGuildSettings(guild.id);
      if (cfg.status?.enabled && cfg.status?.channelId) {
        await ensureStatusMessage(client, guild.id);
        const refreshed = await getGuildSettings(guild.id);
        if (refreshed.status?.messageId) {
          const mode = refreshed.status.mode || 'online';
          await updateStatusMessage(client, guild.id, mode, mode === 'online' ? { uptime: formatUptime(client.uptime) } : {});
        }
      }
    } catch (err) {
      console.warn('[BWW] Status-Synchronisierung fehlgeschlagen:', err.message);
    }
  }

  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        const cfg = await getGuildSettings(guild.id);
        if (cfg.status?.enabled && cfg.status?.channelId) {
          await ensureStatusMessage(client, guild.id);
          const refreshed = await getGuildSettings(guild.id);
          const mode = refreshed.status?.mode || 'online';
          if (refreshed.status?.messageId) await updateStatusMessage(client, guild.id, mode, mode === 'online' ? { uptime: formatUptime(client.uptime) } : {});
        }
      } catch {}
    }
  }, 5 * 60 * 1000);
});

client.on(Events.GuildCreate, () => syncDatabase(client, 'online'));
client.on(Events.GuildDelete, () => syncDatabase(client, 'online'));

client.on(Events.GuildMemberAdd, (member) => {
  Promise.resolve(welcome(member)).catch((err) => console.error('Welcome Fehler:', err.message));
});

client.on(Events.InteractionCreate, (interaction) => {
  Promise.resolve(interactions(interaction, client)).catch((err) => {
    console.error('Interaction Fehler:', err.stack || err.message);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      interaction.reply({ content: '❌ Unerwarteter Fehler.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });
});

async function shutdown(signal) {
  for (const guild of client.guilds.cache.values()) { try { await updateStatusMessage(client, guild.id, 'offline'); } catch {} }
  try { await markOffline(client); } catch (err) {
    console.error('[BWW] Offline-Status konnte nicht gespeichert werden:', err.message);
  }
  process.exit(signal === 'SIGINT' ? 130 : 143);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

client.login(token).catch((err) => {
  console.error('Login-Fehler:', err && (err.stack || err.message || err));
  process.exit(1);
});
