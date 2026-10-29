// BWW Phase 4 – /honeypot-create (Honeypot anlegen, 04_HONEYPOT.md).
// Loader-Format: { data, execute, toJSON, name } (siehe src/loaders/commandLoader).
// Felder exakt aus 04: channel_id/name/description/action/delete_message/
// timeout_enabled/timeout_duration/ban_enabled/log_channel_id/enabled.
// Permissions: Administrator (Sicherheitsmodul) + BWW-Rollen via permissions-Service.

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'honeypot-create',
  description: 'Erstellt einen Honeypot (Trap-Channel mit Auto-Aktion).',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    { name: 'channel', description: 'Trap-Channel', type: 7, required: true, channel_types: [0] },
    { name: 'name', description: 'Name (z. B. trap-1)', type: 3, required: true },
    { name: 'beschreibung', description: 'Beschreibung (intern)', type: 3, required: false },
    {
      name: 'aktion', description: 'Aktion bei Treffer', type: 3, required: false,
      choices: [
        { name: 'Nur loggen', value: 'log_only' },
        { name: 'Löschen', value: 'delete' },
        { name: 'Verwarnen', value: 'warn' },
        { name: 'Timeout', value: 'timeout' },
        { name: 'Kick', value: 'kick' },
        { name: 'Ban', value: 'ban' },
        { name: 'Staff benachrichtigen', value: 'notify_staff' },
      ],
    },
    { name: 'nachricht-loeschen', description: 'Trigger-Nachricht löschen? (Standard: ja)', type: 5, required: false },
    { name: 'timeout-aktiv', description: 'Zusatz-Timeout aktivieren?', type: 5, required: false },
    { name: 'timeout-dauer', description: 'Timeout-Dauer in Minuten (1-40320)', type: 4, required: false, min_value: 1, max_value: 40320 },
    { name: 'ban-aktiv', description: 'Zusatz-Ban aktivieren?', type: 5, required: false },
    { name: 'log-channel', description: 'Log-Channel für Treffer', type: 7, required: false, channel_types: [0] },
  ],
};

async function execute(interaction, client) {
  const { createHoneypot } = require('../../modules/honeypot/honeypotService');
  const { getGuildSettings } = require('../../utils/database');
  const { hasCommandPermission } = require('../../services/permissions');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Nur Administratoren.', flags: MessageFlags.Ephemeral });
    return;
  }
  try {
    const settings = await getGuildSettings(interaction.guildId).catch(() => null);
    if (!hasCommandPermission(interaction.member, 'honeypot-create', settings)) {
      await interaction.reply({ content: 'Keine BWW-Berechtigung für honeypot-create.', flags: MessageFlags.Ephemeral });
      return;
    }
  } catch {}
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const channel = interaction.options.getChannel('channel', true);
    const timeoutMin = interaction.options.getInteger('timeout-dauer');
    const created = await createHoneypot(interaction.guildId, {
      channel_id: channel.id,
      name: interaction.options.getString('name', true),
      description: interaction.options.getString('beschreibung') || null,
      action: interaction.options.getString('aktion') || 'log_only',
      delete_message: interaction.options.getBoolean('nachricht-loeschen') ?? true,
      timeout_enabled: interaction.options.getBoolean('timeout-aktiv') ?? false,
      timeout_duration: timeoutMin != null ? timeoutMin * 60 : 600,
      ban_enabled: interaction.options.getBoolean('ban-aktiv') ?? false,
      log_channel_id: interaction.options.getChannel('log-channel')?.id || null,
      enabled: true,
    }, interaction.user.id);
    await interaction.followUp({ content: 'Honeypot erstellt: ' + (created.name || created.id) + ' in ' + channel + ' (Aktion: ' + created.action + ', ID: ' + created.id + ').', flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: 'Erstellen fehlgeschlagen: ' + err.message, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
