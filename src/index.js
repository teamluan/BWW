require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, Events } = require('discord.js');
const { commands } = require('./commands');
const welcome = require('./events/welcome');
const interactions = require('./events/interactions');
const { startGiveawayLoop } = require('./utils/giveaway');

const token = process.env.DISCORD_TOKEN || '';
console.log(`[BWW] Token geladen: ${token.length} Zeichen.`);
if (!token) {
  console.error('DISCORD_TOKEN fehlt in den Umgebungsvariablen.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember],
});

client.once(Events.ClientReady, async (bot) => {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationCommands(bot.user.id), { body: commands });
  console.log(`BWW Bot online als ${bot.user.tag}`);
  startGiveawayLoop(client);
});

client.on(Events.GuildMemberAdd, welcome);
client.on(Events.InteractionCreate, (i) => interactions(i, client));

client.login(token).catch((err) => {
  console.error('Login-Fehler:', err && (err.stack || err.message || err));
  process.exit(1);
});
