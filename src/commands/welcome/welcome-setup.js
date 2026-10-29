// BWW Phase 6 - /welcome-setup (Welcome konfigurieren, 06_WELCOME.md).
// Loader-Format: { data, execute, toJSON, name }. Permissions: Administrator.

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'welcome-setup',
  description: 'Richtet das Welcome-System ein (Channel/Nachricht/Embed/DM/Rolle).',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    { name: 'channel', description: 'Welcome-Channel', type: 7, required: true, channel_types: [0] },
    { name: 'nachricht', description: 'Welcome-Nachricht (Variablen: {user} {server} {member.count} ...)', type: 3, required: false },
    { name: 'embed-id', description: 'Optionale Embed-V2-ID (siehe /embed-list bzw. Dashboard)', type: 3, required: false },
    { name: 'dm-aktiv', description: 'Begruessungs-DM aktivieren?', type: 5, required: false },
    { name: 'dm-nachricht', description: 'DM-Text (Variablen wie oben)', type: 3, required: false },
    { name: 'autorolle', description: 'Optionale Auto-Rolle', type: 8, required: false },
    { name: 'autorolle-aktiv', description: 'Auto-Rolle vergeben?', type: 5, required: false },
    { name: 'delete-after', description: 'Nachricht nach X Sekunden loeschen (0=nie, max 86400)', type: 4, required: false, min_value: 0, max_value: 86400 },
    { name: 'aktiv', description: 'Welcome aktivieren?', type: 5, required: false },
  ],
};

async function execute(interaction, client) {
  const { upsertWelcomeConfig } = require('../../modules/welcome/welcomeService');
  const { getGuildSettings } = require('../../utils/database');
  const { hasCommandPermission } = require('../../services/permissions');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Nur Administratoren.', flags: MessageFlags.Ephemeral });
    return;
  }
  try {
    const settings = await getGuildSettings(interaction.guildId).catch(() => null);
    if (!hasCommandPermission(interaction.member, 'welcome-setup', settings)) {
      await interaction.reply({ content: 'Keine BWW-Berechtigung fuer welcome-setup.', flags: MessageFlags.Ephemeral });
      return;
    }
  } catch {}
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const channel = interaction.options.getChannel('channel', true);
    const saved = await upsertWelcomeConfig(interaction.guildId, {
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
    await interaction.followUp({
      content: `Welcome gespeichert: ${channel} - ${saved.enabled ? 'aktiv' : 'pausiert'} (DM: ${saved.dm_enabled ? 'an' : 'aus'}, Rolle: ${saved.auto_role_enabled ? (saved.auto_role_id || 'an') : 'aus'}, Loeschen: ${saved.delete_after || 0}s).`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    await interaction.followUp({ content: 'Speichern fehlgeschlagen: ' + err.message, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
