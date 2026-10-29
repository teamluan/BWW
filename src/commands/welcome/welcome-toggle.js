// BWW Phase 6 - /welcome-toggle (aktivieren/deaktivieren, 06_WELCOME.md).
// Loader-Format: { data, execute, toJSON, name }. Permissions: Administrator.

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'welcome-toggle',
  description: 'Aktiviert/deaktiviert das Welcome-System.',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    { name: 'aktiv', description: 'true=an, false=aus (leer=umschalten)', type: 5, required: false },
  ],
};

async function execute(interaction, client) {
  const { getWelcomeConfig, setEnabled } = require('../../modules/welcome/welcomeService');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Nur Administratoren.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const current = await getWelcomeConfig(interaction.guildId).catch(() => null);
    const wanted = interaction.options.getBoolean('aktiv') ?? !(current?.enabled !== false);
    const updated = await setEnabled(interaction.guildId, wanted, interaction.user.id);
    await interaction.followUp({ content: `Welcome ist jetzt ${updated.enabled ? 'aktiv.' : 'pausiert.'}`, flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: 'Toggle fehlgeschlagen: ' + err.message, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
