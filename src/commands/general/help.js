// BWW Phase 9 – /help (zentrale Command-Liste, Loader-registriert).
const { MessageFlags } = require('discord.js');
const data = { name: 'help', description: 'Zeigt alle BWW-Commands (konsolidiert, Phase 9).' };
async function execute(interaction, client) {
  if (!interaction.guildId) { await interaction.reply({ content: 'Nur auf Servern.', flags: MessageFlags.Ephemeral }).catch(() => {}); return; }
  try { require('../../services/logger').logger.child('command:help').info('help', interaction.guildId, interaction.user.id); } catch {}
  const text = [
    '## BWW Hilfe (Phase 9 - konsolidiert)',
    '',
    '**Allgemein:** /setup - /config view/set - /settings view/set - /help - /ping',
    '**Ticket:** /ticket setup/panel/create/close/reopen/delete/claim/unclaim/add/remove/rename/priority/transcript/info (+template; Aliase: ticket-*, panel-create, type-add)',
    '**Honeypot:** /honeypot create/delete/list/enable/disable/logs/whitelist (Aliase: honeypot-create/list/toggle/exempt-*)',
    '**Embed V2:** /embed create/edit/delete/list/send/preview/clone/template (Aliase: embed-*)',
    '**Welcome:** /welcome setup/enable/disable/preview/test (Aliase: welcome-setup/test/toggle/variables)',
    '**Giveaway:** /giveaway start/end/cancel/reroll/edit/list/info',
    '**Verification:** /verify (self) - /verification setup/enable/disable/user/reset/logs (Aliase: verification-*)',
    '',
    'Details: docs/COMMANDS.md - Dashboard: /commands (Single Source Supabase).',
  ].join('\n');
  await interaction.reply({ content: text.slice(0, 2000), flags: MessageFlags.Ephemeral }).catch(() => {});
}
module.exports = { data, execute, toJSON: () => data, name: data.name };
