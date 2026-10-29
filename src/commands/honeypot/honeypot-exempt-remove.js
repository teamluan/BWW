// BWW Phase 4 – /honeypot-exempt-remove (Staff-Ausnahme entfernen).
// Loader-Format: { data, execute, toJSON, name }. Permissions: Administrator.

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'honeypot-exempt-remove',
  description: 'Entfernt eine Honeypot-Ausnahme (siehe /honeypot-list + Dashboard).',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    { name: 'id', description: 'Exemption-ID', type: 3, required: true },
  ],
};

async function execute(interaction, client) {
  const { removeExemption } = require('../../modules/honeypot/exemptionService');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Nur Administratoren.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const id = interaction.options.getString('id', true);
    const ok = await removeExemption(id, interaction.guildId, interaction.user.id);
    await interaction.followUp({ content: ok ? ('Ausnahme ' + id + ' entfernt.') : 'Ausnahme nicht gefunden.', flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: 'Entfernen fehlgeschlagen: ' + err.message, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
