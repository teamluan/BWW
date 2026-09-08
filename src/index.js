require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, Events, MessageFlags } = require('discord.js');
const { commands } = require('./commands');
const welcome = require('./events/welcome');
const interactions = require('./events/interactions');
const { startGiveawayLoop } = require('./utils/giveaway');
const { updateStatusMessage, formatUptime } = require('./utils/status');

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

client.once(Events.ClientReady, async (bot) => {
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(bot.user.id), { body: commands });
    console.log(`BWW Bot online als ${bot.user.tag}`);
  } catch (err) {
    console.error('Slash-Command Registrierung fehlgeschlagen:', err.message);
    console.log(`BWW Bot online als ${bot.user.tag} (Commands nicht aktualisiert)`);
  }
  startGiveawayLoop(client);
  // Status auf online setzen
  try {
    const cfg = require('./config').load();
    const mode = cfg.status?.mode || 'online';
    if (cfg.status?.enabled && cfg.status?.channelId) {
      await updateStatusMessage(client, mode, mode === 'online' ? { uptime: formatUptime(client.uptime) } : {});
    }
  } catch {}
  // alle 5 Min Status timestamp aktualisieren wenn online
  setInterval(() => {
    try {
      const cfg = require('./config').load();
      if (cfg.status?.enabled && cfg.status?.mode === 'online') {
        updateStatusMessage(client, 'online', { uptime: formatUptime(client.uptime) }).catch(() => {});
      }
    } catch {}
  }, 5 * 60 * 1000);
});

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

// Vor dem Beenden versuchen Status auf offline zu setzen (best effort)
process.on('SIGTERM', async () => {
  try { await updateStatusMessage(client, 'offline'); } catch {}
  process.exit(0);
});
process.on('SIGINT', async () => {
  try { await updateStatusMessage(client, 'offline'); } catch {}
  process.exit(0);
});

client.login(token).catch((err) => {
  console.error('Login-Fehler:', err && (err.stack || err.message || err));
  process.exit(1);
});
