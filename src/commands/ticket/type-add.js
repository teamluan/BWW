// BWW Phase 3 – /ticket-type-add (mehrere Typen, eigene category_id +
// staff_role_id pro Typ, 03_TICKETS.md). Loader-Format wie panel-create.

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'ticket-type-add',
  description: 'Fügt einen Ticket-Typ hinzu (eigene Kategorie + Staff-Rolle).',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    { name: 'name', description: 'Anzeigename (z.B. Technischer Support)', type: 3, required: true },
    { name: 'beschreibung', description: 'Kurzbeschreibung', type: 3, required: false },
    { name: 'emoji', description: 'Emoji (z.B. 🛠️)', type: 3, required: false },
    { name: 'kategorie', description: 'Eigene Kategorie für diesen Typ', type: 7, required: false, channel_types: [4] },
    { name: 'staff-rolle', description: 'Eigene Staff-Rolle für diesen Typ', type: 8, required: false },
    { name: 'farbe', description: 'Hex-Farbe (z.B. #5865F2)', type: 3, required: false },
    { name: 'panel-id', description: 'Panel-UUID (optional)', type: 3, required: false },
  ],
};

async function execute(interaction) {
  const { createType } = require('../../modules/ticket/panelService');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ Nur Administratoren.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const created = await createType(interaction.guildId, {
      name: interaction.options.getString('name', true),
      description: interaction.options.getString('beschreibung') || null,
      emoji: interaction.options.getString('emoji') || '🎫',
      category_id: interaction.options.getChannel('kategorie')?.id || null,
      staff_role_id: interaction.options.getRole('staff-rolle')?.id || null,
      color: interaction.options.getString('farbe') || '#5865F2',
      panel_id: interaction.options.getString('panel-id') || null,
    }, interaction.user.id);
    await interaction.followUp({ content: `✅ Typ angelegt: ${created.emoji} **${created.name}** (\`${created.id}\`)`, flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: `❌ Typ fehlgeschlagen: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
