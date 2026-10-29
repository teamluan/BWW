// BWW Phase 9 – /welcome (konsolidiert: setup/enable/disable/preview/test).
// Duenne Wrapper um welcomeService/welcomeFlow (keine Duplikat-Logik).
// Schreibt dieselben bww_welcome-Tabellen wie Dashboard. Legacy-Aliase bleiben.
// Phase 11: BWW-Matrix je Subcommand (preview=view, test=test, Rest=manage) statt
// Admin-Hardcheck. default_member_permissions bewusst entfernt (BWW-Rollen haben
// teils kein Discord-Aequivalent). Legacy-Command-Mapping bleibt als Fallback.
const { MessageFlags } = require('discord.js');
const data = {
  name: 'welcome',
  description: 'Welcome-System verwalten (Setup, Preview, Test).',
  options: [
    { name: 'setup', description: 'Welcome einrichten (Dashboard-paritaet).', type: 1, options: [
      { name: 'channel', description: 'Welcome-Channel', type: 7, required: true, channel_types: [0] },
      { name: 'nachricht', description: 'Welcome-Nachricht (Variablen)', type: 3, required: false },
      { name: 'embed-id', description: 'Optionale Embed-V2-ID', type: 3, required: false },
      { name: 'dm-aktiv', description: 'Begruessungs-DM aktivieren?', type: 5, required: false },
      { name: 'dm-nachricht', description: 'DM-Text', type: 3, required: false },
      { name: 'autorolle', description: 'Optionale Auto-Rolle', type: 8, required: false },
      { name: 'autorolle-aktiv', description: 'Auto-Rolle vergeben?', type: 5, required: false },
      { name: 'delete-after', description: 'Nachricht nach X Sekunden loeschen (0=nie, max 86400)', type: 4, required: false, min_value: 0, max_value: 86400 },
      { name: 'aktiv', description: 'Welcome aktivieren?', type: 5, required: false },
    ]},
    { name: 'enable', description: 'Welcome aktivieren.', type: 1 },
    { name: 'disable', description: 'Welcome deaktivieren.', type: 1 },
    { name: 'preview', description: 'Vorschau (ephemeral, ohne Senden).', type: 1, options: [{ name: 'user', description: 'Vorschau fuer Benutzer (Standard: du)', type: 6, required: false }] },
    { name: 'test', description: 'Testnachricht senden.', type: 1, options: [{ name: 'channel', description: 'Ziel-Channel (Standard: Welcome-Channel)', type: 7, required: false, channel_types: [0] }] },
  ],
};
// Phase 11: Matrix-Permission je Subcommand (11_PERMISSIONS: view/manage/test).
function requiredPermission(sub) {
  const map = { setup: 'welcome.manage', enable: 'welcome.manage', disable: 'welcome.manage', preview: 'welcome.view', test: 'welcome.test' };
  return map[sub] || 'welcome.manage';
}
async function execute(interaction, client) {
  if (!interaction.guildId || !interaction.guild) { await interaction.reply({ content: 'Nur auf Servern.', flags: MessageFlags.Ephemeral }).catch(() => {}); return; }
  const { requireGuildId } = require('../../services/validation');
  let guildId; try { guildId = requireGuildId(interaction.guildId); } catch { await interaction.reply({ content: 'Ungueltige Guild-ID.', flags: MessageFlags.Ephemeral }).catch(() => {}); return; }
  const sub = interaction.options.getSubcommand(true);
  // Phase 11: BWW-Matrix (Guild -> Mapping/Discord-Fallback -> Permission -> Action), Legacy-Fallback inklusive.
  try {
    const { requirePermission, loadGuildRoleMappings } = require('../../services/permissions');
    const { getGuildSettings } = require('../../utils/database');
    const settings = await getGuildSettings(guildId).catch(() => null);
    const guildRoles = await loadGuildRoleMappings(guildId).catch(() => []);
    await requirePermission(interaction.member, requiredPermission(sub), { guildId, guildRoles, settings });
  } catch {
    await interaction.reply({ content: 'Keine Berechtigung (' + requiredPermission(sub) + ').', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
  const { logger } = require('../../services/logger');
  try {
    const svc = require('../../modules/welcome/welcomeService');
    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel', true);
      const saved = await svc.upsertWelcomeConfig(guildId, {
        channel_id: channel.id,
        message: interaction.options.getString('nachricht') ?? undefined,
        embed_id: interaction.options.getString('embed-id') ?? undefined,
        dm_enabled: interaction.options.getBoolean('dm-aktiv') ?? undefined,
        dm_message: interaction.options.getString('dm-nachricht') ?? undefined,
        auto_role_id: interaction.options.getRole('autorolle')?.id ?? undefined,
        auto_role_enabled: interaction.options.getBoolean('autorolle-aktiv') ?? undefined,
        delete_after: interaction.options.getInteger('delete-after') ?? undefined,
        enabled: interaction.options.getBoolean('aktiv') ?? true,
      }, interaction.user.id);
      await interaction.followUp({ content: 'Welcome gespeichert: ' + channel + ' - ' + (saved.enabled ? 'aktiv' : 'pausiert') + ' (DM: ' + (saved.dm_enabled ? 'an' : 'aus') + ', Rolle: ' + (saved.auto_role_enabled ? (saved.auto_role_id || 'an') : 'aus') + ').', flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'enable' || sub === 'disable') {
      const updated = await svc.setEnabled(guildId, sub === 'enable', interaction.user.id);
      await interaction.followUp({ content: 'Welcome ist jetzt ' + (updated.enabled ? 'aktiv.' : 'pausiert.'), flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'preview') {
      const target = interaction.options.getUser('user') || interaction.user;
      const member = target.id === interaction.user.id ? interaction.member : (await interaction.guild.members.fetch(target.id).catch(() => interaction.member));
      const cfg = await svc.getWelcomeConfig(guildId).catch(() => null);
      if (!cfg) throw new Error('Kein Welcome konfiguriert (/welcome setup).');
      const { replaceVariables, listCustomVariables, STANDARD_VARIABLES } = require('../../modules/welcome/variableService');
      const customs = await listCustomVariables(guildId, { onlyEnabled: true }).catch(() => []);
      const ctx = { member, user: target, guild: interaction.guild, channel: interaction.channel, customVars: customs };
      const resolved = replaceVariables(cfg.message || 'Willkommen {user}!', ctx, customs);
      const head = 'Preview fuer ' + target.tag + ' (' + (cfg.enabled ? 'aktiv' : 'pausiert') + ', Channel: ' + (cfg.channel_id ? '<#' + cfg.channel_id + '>' : '-') + ', Embed: ' + (cfg.embed_id || '-') + '):';
      await interaction.followUp({ content: (head + '\n' + resolved).slice(0, 2000) + '\n\nStandard: ' + (STANDARD_VARIABLES || []).slice(0, 8).join(' '), flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'test') {
      const { sendTestMessage } = require('../../modules/welcome/welcomeFlow');
      const override = interaction.options.getChannel('channel')?.id || null;
      const sent = await sendTestMessage(interaction.guild, interaction.member, override);
      await interaction.followUp({ content: 'Testnachricht gesendet: ' + (sent.url || ('#' + sent.channelId)), flags: MessageFlags.Ephemeral });
      return;
    }
    throw new Error('Unbekannter Subcommand.');
  } catch (err) {
    logger.child('command:welcome').warn('failed', guildId, err.message);
    await interaction.followUp({ content: 'Fehlgeschlagen: ' + String(err.message).slice(0, 500), flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}
module.exports = { data, execute, toJSON: () => data, name: data.name };
