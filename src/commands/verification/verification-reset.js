// BWW Phase 8 - /verification-reset (Verification zuruecksetzen, 08_VERIFICATION.md).
// Loader-Format: { data, execute, toJSON, name }. Permissions: Administrator.

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'verification-reset',
  description: 'Setzt die Verification eines Users zurueck (Status pending).',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [{ name: 'user', description: 'Benutzer', type: 6, required: true }],
};

async function execute(interaction, client) {
  const mod = require('../../modules/verification');
  const { getGuildSettings } = require('../../utils/database');
  const { hasCommandPermission } = require('../../services/permissions');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Nur Administratoren.', flags: MessageFlags.Ephemeral });
    return;
  }
  try {
    const settings = await getGuildSettings(interaction.guildId).catch(() => null);
    if (!hasCommandPermission(interaction.member, 'verification-reset', settings)) {
      await interaction.reply({ content: 'Keine BWW-Berechtigung fuer verification-reset.', flags: MessageFlags.Ephemeral });
      return;
    }
  } catch {}
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const user = interaction.options.getUser('user', true);
    const config = await mod.getVerificationConfig(interaction.guildId).catch(() => null);
    await mod.resetVerification(interaction.guildId, user.id);
    await mod.logVerification({ guildId: interaction.guildId, userId: user.id, action: 'reset', result: 'pending', reason: 'slash-reset', actorId: interaction.user.id }).catch(() => {});
    try {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (member && config) {
        const { cleanId } = require('../../services/validation');
        const vf = cleanId(config.verified_role_id || config.verification_role_id || '');
        const uv = cleanId(config.unverified_role_id || '');
        if (vf && member.roles.cache.has(vf)) await member.roles.remove(vf, 'BWW Verification Reset').catch(() => {});
        if (uv && !member.roles.cache.has(uv)) {
          const me = interaction.guild.members.me;
          if (me?.permissions.has(PermissionFlagsBits.ManageRoles)) await member.roles.add(uv, 'BWW Verification Reset').catch(() => {});
        }
      }
    } catch {}
    await interaction.followUp({ content: `Verification von <@${user.id}> zurueckgesetzt (pending).`, flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: 'Reset fehlgeschlagen: ' + err.message, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
