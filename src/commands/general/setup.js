// BWW Phase 9 – /setup (Guild-Init, 09_COMMANDS.md Allgemein).
// Duenner Wrapper: Guild-Kontext + BWW-Perm + Discord-Perm + Validation + DB via Service + ephemeral + Audit.
// Single Source: bww_guild_settings (Dashboard liest dieselbe Config).
// Phase 11: BWW-Matrix settings.manage (Manager+ via Mapping/Discord-Fallback ManageGuild,
// Legacy als Fallback) statt Admin-Hardcheck.
const { MessageFlags } = require('discord.js');
const data = {
  name: 'setup',
  description: 'Initialisiert BWW fuer diesen Server (Guild-Init, Dashboard-paritaet).',
};
async function execute(interaction, client) {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({ content: 'Nur auf Servern verfuegbar.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  const { requireGuildId } = require('../../services/validation');
  let guildId;
  try { guildId = requireGuildId(interaction.guildId); } catch {
    await interaction.reply({ content: 'Ungueltige Guild-ID.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  const { getGuildSettings, saveGuildSettings } = require('../../utils/database');
  const settings = await getGuildSettings(guildId).catch(() => null);
  // Phase 11: BWW-Matrix (Guild -> Mapping/Discord-Fallback -> Permission -> Action), Legacy-Fallback inklusive.
  try {
    const { requirePermission, loadGuildRoleMappings } = require('../../services/permissions');
    const guildRoles = await loadGuildRoleMappings(guildId).catch(() => []);
    await requirePermission(interaction.member, 'settings.manage', { guildId, guildRoles, settings });
  } catch {
    await interaction.reply({ content: 'Keine Berechtigung (settings.manage).', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
  try {
    const cfg = settings || await getGuildSettings(guildId);
    const modules = {
      ticket: cfg?.ticket?.enabled ? 'aktiv' : 'pausiert',
      honeypot: cfg?.honeypot?.enabled ? 'aktiv' : 'pausiert',
      welcome: cfg?.welcome?.enabled ? 'aktiv' : 'pausiert',
      verify: cfg?.verify?.enabled ? 'aktiv' : 'pausiert',
    };
    try { await saveGuildSettings(guildId, cfg || {}, interaction.user.id); } catch {}
    try {
      const { logAudit } = require('../../services/audit');
      await logAudit({ guildId, actorId: interaction.user.id, action: 'system.setup', details: { modules } }).catch(() => {});
    } catch {}
    try { require('../../services/logger').logger.child('command:setup').info('setup', guildId, interaction.user.id); } catch {}
    const lines = [
      '## BWW Setup',
      'Server: ' + (interaction.guild?.name || guildId) + ' (' + guildId + ')',
      '',
      'Ticket: ' + modules.ticket + ' - /ticket setup',
      'Honeypot: ' + modules.honeypot + ' - /honeypot create',
      'Welcome: ' + modules.welcome + ' - /welcome setup',
      'Verification: ' + modules.verify + ' - /verification setup (/verify self)',
      'Embed V2: /embed create - Giveaway: /giveaway start',
      '',
      'Dashboard und Commands lesen dieselbe Config (Supabase bww_guild_settings).',
      'Weiter: /config view - /help - /ping',
    ];
    await interaction.followUp({ content: lines.join('\n').slice(0, 2000), flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: 'Setup fehlgeschlagen: ' + String(err.message).slice(0, 500), flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}
module.exports = { data, execute, toJSON: () => data, name: data.name };
