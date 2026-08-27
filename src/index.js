require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, Events } = require('discord.js');
const { commands } = require('./commands');
const welcome = require('./events/welcome');
const interactions = require('./events/interactions');

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN fehlt in den Umgebungsvariablen.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember]
});

client.once(Events.ClientReady, async bot => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(bot.user.id), { body: commands });
  console.log(`BWW Bot online als ${bot.user.tag}`);
});

client.on(Events.GuildMemberAdd, welcome);
client.on(Events.InteractionCreate, interactions);

client.login(process.env.DISCORD_TOKEN);
