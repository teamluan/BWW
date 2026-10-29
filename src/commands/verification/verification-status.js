// BWW Phase 8 - /verification-status (Status abfragen, 08_VERIFICATION.md + Giveaway-Hook).
// Loader-Format: { data, execute, toJSON, name }. Permissions: Administrator oder Self.

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'verification-status',
  description: 'Zeigt den Verification-Status (eigener oder fremder User).',
  options: [{ name: 'user', description: 'Benutzer (optional, Standard: du)', type: 6, required: false }],
};

async function execute(interaction, client) {
  const mod = require('../../modules/verification');
  const target = interaction.options.getUser('user') || interaction.user;
  const isSelf = target.id === interaction.user.id;
  if (!isSelf && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    try {
      const { getGuildSettings } = require('../../utils/database');
      const { hasCommandPermission } = require('../../services/permissions');
      const settings = await getGuildSettings(interaction.guildId).catch(() => null);
      if (!hasCommandPermission(interaction.member, 'verification-status', settings)) {
        await interaction.reply({ content: 'Nur Administratoren duerfen fremde Status sehen.', flags: MessageFlags.Ephemeral });
        return;
      }
    } catch {}
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const st = await mod.getVerificationStatus(interaction.guildId, target.id);
    const cfg = st.config;
    const line = !cfg || cfg.enabled === false
      ? 'Verification ist deaktiviert (alle gelten als verifiziert fuer Giveaways).'
      : `Status: **${st.status}** ${st.verified ? '(verifiziert)' : '(nicht verifiziert)'} - Methode: ${cfg.method}, Channel: ${cfg.verification_channel_id || '-'}, Verified: ${cfg.verified_role_id || '-'}`;
    await interaction.followUp({ content: `<@${target.id}>: ${line}`.slice(0, 2000), flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: 'Status fehlgeschlagen: ' + err.message, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
