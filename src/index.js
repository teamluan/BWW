require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionsBitField, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
const defaults = {
  welcome: { enabled: false, channelId: '', message: 'Willkommen {user} auf dem Server! 🎉' },
  verify: { enabled: false, channelId: '', message: 'Klicke auf den Button, um dich zu verifizieren.', roleId: '' },
  permissions: {}
};
if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaults, null, 2));
function loadConfig() { try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return structuredClone(defaults); } }
function saveConfig(c) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2)); }
let config = loadConfig();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers], partials: [Partials.GuildMember] });

const commands = [
  { name: 'nachricht', description: 'Sendet Text und optional ein Bild als Embed.', options: [
    { name: 'text', description: 'Text der Nachricht', type: 3, required: true },
    { name: 'bild', description: 'Optionale Bild-URL', type: 3, required: false }
  ]},
  { name: 'setup', description: 'Öffnet das Setup-Menü.' },
  { name: 'verify', description: 'Sendet das konfigurierte Verify-System in diesen Channel.' }
];

function allowed(interaction, command) {
  if (interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) return true;
  const roleIds = config.permissions[command] || [];
  return roleIds.some(id => interaction.member.roles.cache.has(id));
}
function replaceWelcome(text, member) { return text.replaceAll('{user}', `<@${member.id}>`).replaceAll('{username}', member.user.username).replaceAll('{server}', member.guild.name); }

client.once(Events.ClientReady, async c => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(c.user.id), { body: commands });
  console.log(`BWW Bot online als ${c.user.tag}`);
});

client.on(Events.GuildMemberAdd, async member => {
  if (!config.welcome.enabled || !config.welcome.channelId) return;
  const channel = member.guild.channels.cache.get(config.welcome.channelId);
  if (!channel?.isTextBased()) return;
  const embed = new EmbedBuilder().setColor(0x2f3136).setDescription(replaceWelcome(config.welcome.message, member)).setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
});

function verifyMessage() {
  const embed = new EmbedBuilder().setColor(0x2f3136).setTitle('Verifizierung').setDescription(config.verify.message).setTimestamp();
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bww_verify').setLabel('Verifizieren').setStyle(ButtonStyle.Success));
  return { embeds: [embed], components: [row] };
}

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton() && interaction.customId === 'bww_verify') {
    if (!config.verify.roleId) return interaction.reply({ content: '❌ Es wurde noch keine Verifizierungsrolle eingerichtet.', ephemeral: true });
    const role = interaction.guild.roles.cache.get(config.verify.roleId);
    if (!role) return interaction.reply({ content: '❌ Die konfigurierte Rolle existiert nicht mehr.', ephemeral: true });
    await interaction.member.roles.add(role).catch(() => null);
    return interaction.reply({ content: '✅ Du wurdest erfolgreich verifiziert.', ephemeral: true });
  }
  if (!interaction.isChatInputCommand()) return;
  const command = interaction.commandName;
  if (!allowed(interaction, command)) return interaction.reply({ content: '❌ Du darfst diesen Command nicht benutzen.', ephemeral: true });

  if (command === 'nachricht') {
    const text = interaction.options.getString('text', true);
    const bild = interaction.options.getString('bild');
    const embed = new EmbedBuilder().setDescription(text).setColor(0x2f3136).setTimestamp();
    if (bild) embed.setImage(bild);
    await interaction.channel.send({ embeds: [embed] });
    return interaction.reply({ content: '✅ Embed gesendet.', ephemeral: true });
  }
  if (command === 'verify') {
    config.verify.channelId = interaction.channelId; config.verify.enabled = true; saveConfig(config);
    await interaction.channel.send(verifyMessage());
    return interaction.reply({ content: '✅ Verify-System wurde in diesem Channel gesendet.', ephemeral: true });
  }
  if (command === 'setup') {
    const embed = new EmbedBuilder().setTitle('BWW Setup').setColor(0x2f3136)
      .setDescription('Nutze die folgenden Commands, um das System ohne Datenbank zu konfigurieren.\n\n' +
      '`/setup-welcome` – Welcome-Channel und Text setzen\n' +
      '`/setup-verify` – Verify-Channel, Text und Rolle setzen\n' +
      '`/setup-permission` – Rolle für einen Command erlauben/entfernen\n\n' +
      'Platzhalter im Welcome-Text: `{user}`, `{username}`, `{server}`');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

// Setup subcommands are registered separately below.
const setupCommands = [
  { name: 'setup-welcome', description: 'Welcome-System konfigurieren.', options: [
    {name:'channel',description:'Welcome-Channel',type:7,required:true,channel_types:[0]},
    {name:'text',description:'Welcome-Text; {user} wird durch Ping ersetzt.',type:3,required:true}
  ]},
  { name: 'setup-verify', description: 'Verify-System konfigurieren.', options: [
    {name:'channel',description:'Verify-Channel',type:7,required:true,channel_types:[0]},
    {name:'role',description:'Rolle nach erfolgreicher Verifizierung',type:8,required:true},
    {name:'text',description:'Text des Verify-Embeds',type:3,required:true}
  ]},
  { name: 'setup-permission', description: 'Rollenberechtigung für einen Command setzen.', options: [
    {name:'command',description:'Command ohne /',type:3,required:true,choices:[{name:'nachricht',value:'nachricht'},{name:'setup',value:'setup'},{name:'verify',value:'verify'}]},
    {name:'role',description:'Rolle',type:8,required:true},
    {name:'erlauben',description:'true = erlauben, false = entfernen',type:5,required:true}
  ]}
];

client.on(Events.ClientReady, async c => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const existing = await rest.get(Routes.applicationCommands(c.user.id));
  const merged = [...commands, ...setupCommands];
  await rest.put(Routes.applicationCommands(c.user.id), { body: merged });
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (!['setup-welcome','setup-verify','setup-permission'].includes(interaction.commandName)) return;
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({content:'❌ Nur Administratoren dürfen das Setup ändern.',ephemeral:true});
  const cmd = interaction.commandName;
  if (cmd === 'setup-welcome') {
    config.welcome = { enabled:true, channelId:interaction.options.getChannel('channel').id, message:interaction.options.getString('text',true) };
    saveConfig(config); return interaction.reply({content:'✅ Welcome-System gespeichert.',ephemeral:true});
  }
  if (cmd === 'setup-verify') {
    config.verify = { enabled:true, channelId:interaction.options.getChannel('channel').id, roleId:interaction.options.getRole('role').id, message:interaction.options.getString('text',true) };
    saveConfig(config); return interaction.reply({content:'✅ Verify-System gespeichert. Nutze `/verify` im gewünschten Channel.',ephemeral:true});
  }
  const name = interaction.options.getString('command',true), role = interaction.options.getRole('role'), allow = interaction.options.getBoolean('erlauben',true);
  config.permissions[name] = config.permissions[name] || [];
  if (allow && !config.permissions[name].includes(role.id)) config.permissions[name].push(role.id);
  if (!allow) config.permissions[name] = config.permissions[name].filter(id => id !== role.id);
  saveConfig(config); return interaction.reply({content:`✅ Rolle ${role} für \`/${name}\` ${allow ? 'erlaubt' : 'entfernt'}.`,ephemeral:true});
});

if (!process.env.DISCORD_TOKEN) { console.error('DISCORD_TOKEN fehlt in den Umgebungsvariablen.'); process.exit(1); }
client.login(process.env.DISCORD_TOKEN);
