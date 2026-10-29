// BWW Phase 6 - /welcome-test (Testnachricht, 06_WELCOME.md).
// Sendet aufgeloeste Welcome-Nachricht (+Embed V2) in Welcome-Channel.
// Permissions: Administrator.

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'welcome-test',
  description: 'Sendet eine Welcome-Testnachricht (mit deinen Variablen aufgeloest).',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    { name: 'channel', description: 'Ziel-Channel (Standard: Welcome-Channel)', type: 7, required: false, channel_types: [0] },
  ],
};

async function execute(interaction, client) {
  const { sendTestMessage } = require('../../modules/welcome/welcomeFlow');
  const { getGuildSettings } = require('../../utils/database');
  const { hasCommandPermission } = require('../../services/permissions');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Nur Administratoren.', flags: MessageFlags.Ephemeral });
    return;
  }
  try {
    const settings = await getGuildSettings(interaction.guildId).catch(() => null);
    if (!hasCommandPermission(interaction.member, 'welcome-test', settings)) {
      await interaction.reply({ content: 'Keine BWW-Berechtigung fuer welcome-test.', flags: MessageFlags.Ephemeral });
      return;
    }
  } catch {}
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const override = interaction.options.getChannel('channel')?.id || null;
    const sent = await sendTestMessage(interaction.guild, interaction.member, override);
    await interaction.followUp({ content: `Testnachricht gesendet: ${sent.url || ('#'+sent.channelId)}`, flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: 'Test fehlgeschlagen: ' + err.message, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
