// BWW Phase 8 - /verification-setup (Verification konfigurieren, 08_VERIFICATION.md).
// Loader-Format: { data, execute, toJSON, name }. Permissions: Administrator.

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'verification-setup',
  description: 'Richtet das Verification-System ein (Channel/Rollen/Methode).',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    { name: 'channel', description: 'Verification-Channel', type: 7, required: false, channel_types: [0] },
    { name: 'unverified-rolle', description: 'Unverified-Rolle (Join-Rolle)', type: 8, required: false },
    { name: 'verified-rolle', description: 'Verified-Rolle (nach Verifizierung)', type: 8, required: false },
    { name: 'methode', description: 'Methode', type: 3, required: false, choices: [{ name: 'Button (1-Klick)', value: 'button' }, { name: 'Code (6-stellig)', value: 'code' }, { name: 'Captcha (Mathe)', value: 'captcha' }] },
    { name: 'code-gueltigkeit', description: 'Code-Gueltigkeit in Minuten (1-1440)', type: 4, required: false, min_value: 1, max_value: 1440 },
    { name: 'log-channel', description: 'Log-Channel (optional)', type: 7, required: false, channel_types: [0] },
    { name: 'max-versuche', description: 'Max Fehlversuche bis Sperre (1-100)', type: 4, required: false, min_value: 1, max_value: 100 },
    { name: 'aktiv', description: 'Verification aktivieren?', type: 5, required: false },
    { name: 'panel', description: 'Verification-Panel sofort senden?', type: 5, required: false },
  ],
};

async function execute(interaction, client) {
  const { upsertVerificationConfig, ensureVerificationPanel } = require('../../modules/verification');
  const { getGuildSettings } = require('../../utils/database');
  const { hasCommandPermission } = require('../../services/permissions');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Nur Administratoren.', flags: MessageFlags.Ephemeral });
    return;
  }
  try {
    const settings = await getGuildSettings(interaction.guildId).catch(() => null);
    if (!hasCommandPermission(interaction.member, 'verification-setup', settings)) {
      await interaction.reply({ content: 'Keine BWW-Berechtigung fuer verification-setup.', flags: MessageFlags.Ephemeral });
      return;
    }
  } catch {}
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const channel = interaction.options.getChannel('channel');
    const uv = interaction.options.getRole('unverified-rolle');
    const vf = interaction.options.getRole('verified-rolle');
    const logCh = interaction.options.getChannel('log-channel');
    const saved = await upsertVerificationConfig(interaction.guildId, {
      verification_channel_id: channel?.id ?? undefined,
      unverified_role_id: uv?.id ?? undefined,
      verified_role_id: vf?.id ?? undefined,
      verification_role_id: vf?.id ?? undefined,
      method: interaction.options.getString('methode') ?? undefined,
      code_validity_minutes: interaction.options.getInteger('code-gueltigkeit') ?? undefined,
      log_channel_id: logCh?.id ?? undefined,
      max_attempts: interaction.options.getInteger('max-versuche') ?? undefined,
      enabled: interaction.options.getBoolean('aktiv') ?? true,
    }, interaction.user.id);
    let panelHint = '';
    if (interaction.options.getBoolean('panel')) {
      try {
        await ensureVerificationPanel(client, interaction.guildId, channel?.id || saved.verification_channel_id);
        panelHint = ' Panel gesendet.';
      } catch (e) { panelHint = ' Panel fehlgeschlagen: ' + e.message; }
    }
    await interaction.followUp({
      content: `Verification gespeichert: ${saved.enabled ? 'aktiv' : 'pausiert'} (Methode: ${saved.method}, Channel: ${saved.verification_channel_id || '-'}, Unverified: ${saved.unverified_role_id || '-'}, Verified: ${saved.verified_role_id || '-'}, Code: ${saved.code_validity_minutes} Min).${panelHint}`.slice(0, 2000),
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    await interaction.followUp({ content: 'Speichern fehlgeschlagen: ' + err.message, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
