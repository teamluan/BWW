// BWW Phase 9 – /ping (Allgemein). Duenner Status-Wrapper.
const { MessageFlags } = require('discord.js');
const data = { name: 'ping', description: 'Zeigt Bot-Latenz und Systemstatus.' };
async function execute(interaction, client) {
  if (!interaction.guildId) { await interaction.reply({ content: 'Nur auf Servern.', flags: MessageFlags.Ephemeral }).catch(() => {}); return; }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
  try {
    const ws = Math.round(client?.ws?.ping ?? -1);
    let supabase = 'nicht konfiguriert';
    try { const { isConfigured } = require('../../services/supabase'); supabase = isConfigured() ? 'verbunden' : 'nicht konfiguriert'; } catch {}
    const uptime = client?.uptime ? Math.floor(client.uptime / 1000) + 's' : 'n/a';
    try { require('../../services/logger').logger.child('command:ping').info('ping', interaction.guildId, ws); } catch {}
    await interaction.followUp({ content: 'Pong! WS: ' + (ws >= 0 ? ws + 'ms' : 'n/a') + ' - Uptime: ' + uptime + ' - Supabase: ' + supabase, flags: MessageFlags.Ephemeral });
  } catch (err) { await interaction.followUp({ content: 'Ping fehlgeschlagen.', flags: MessageFlags.Ephemeral }).catch(() => {}); }
}
module.exports = { data, execute, toJSON: () => data, name: data.name };
