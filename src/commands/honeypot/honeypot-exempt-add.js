// BWW Phase 4 – /honeypot-exempt-add (Staff-Ausnahme anlegen, 04_HONEYPOT.md).
// Loader-Format: { data, execute, toJSON, name }. Permissions: Administrator.
// Genau eine Angabe: benutzer ODER rolle (bww_honeypot_exemptions user_id/role_id).

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'honeypot-exempt-add',
  description: 'Nimmt User/Rolle vom Honeypot aus (Staff-Ausnahme).',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    { name: 'benutzer', description: 'Ausgenommener Benutzer', type: 6, required: false },
    { name: 'rolle', description: 'Ausgenommene Rolle', type: 8, required: false },
    { name: 'grund', description: 'Grund (z. B. Staff)', type: 3, required: false },
  ],
};

async function execute(interaction, client) {
  const { addExemption } = require('../../modules/honeypot/exemptionService');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Nur Administratoren.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const user = interaction.options.getUser('benutzer');
    const role = interaction.options.getRole('rolle');
    if ((user && role) || (!user && !role)) throw new Error('Genau eine Angabe: benutzer ODER rolle.');
    const created = await addExemption(interaction.guildId, {
      user_id: user?.id || null,
      role_id: role?.id || null,
      reason: interaction.options.getString('grund') || 'Staff-Ausnahme',
    }, interaction.user.id);
    await interaction.followUp({ content: 'Ausnahme angelegt: ' + (user ? ('User ' + user.tag) : ('Rolle ' + role.name)) + ' (ID: ' + created.id + ').', flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: 'Anlegen fehlgeschlagen: ' + err.message, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
