// BWW Phase 4 – /honeypot-toggle (aktivieren/deaktivieren, 04_HONEYPOT.md).
// Loader-Format: { data, execute, toJSON, name }. Permissions: Administrator.

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'honeypot-toggle',
  description: 'Aktiviert/deaktiviert einen Honeypot.',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    { name: 'id', description: 'Honeypot-ID (siehe /honeypot-list)', type: 3, required: true },
    { name: 'aktiv', description: ' true = aktiv, false = pausiert (leer = umschalten)', type: 5, required: false },
  ],
};

async function execute(interaction, client) {
  const { getHoneypot, setEnabled } = require('../../modules/honeypot/honeypotService');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Nur Administratoren.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const id = interaction.options.getString('id', true);
    const current = await getHoneypot(id, interaction.guildId);
    if (!current) throw new Error('Honeypot nicht gefunden.');
    const wanted = interaction.options.getBoolean('aktiv') ?? !current.enabled;
    const updated = await setEnabled(id, interaction.guildId, wanted, interaction.user.id);
    await interaction.followUp({ content: 'Honeypot ' + (updated.name || updated.id) + ' ist jetzt ' + (updated.enabled ? 'aktiv.' : 'pausiert.'), flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: 'Toggle fehlgeschlagen: ' + err.message, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
