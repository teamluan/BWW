// BWW Phase 5 – /embed-create (Embed anlegen, 05_EMBED_V2.md).
// Loader-Format: { data, execute, toJSON, name }. Permissions: Administrator oder Embed-Manager.

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'embed-create',
  description: 'Erstellt ein Embed V2 (Name/Description).',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    { name: 'name', description: 'Embed-Name (z.B. regeln)', type: 3, required: true },
    { name: 'beschreibung', description: 'Kurzbeschreibung', type: 3, required: false },
    { name: 'aktiv', description: 'Sofort aktivieren', type: 5, required: false },
  ],
};

async function execute(interaction) {
  const { createEmbed } = require('../../modules/embed/embedService');
  const { isEmbedManager } = require('../../modules/embed/actionService');
  if (!(await isEmbedManager(interaction.member, interaction.guildId))) {
    await interaction.reply({ content: '❌ Nur Administratoren oder Embed-Manager.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const created = await createEmbed(interaction.guildId, {
      name: interaction.options.getString('name', true),
      description: interaction.options.getString('beschreibung') || null,
      enabled: interaction.options.getBoolean('aktiv') !== false,
    }, interaction.user.id);
    await interaction.followUp({ content: `✅ Embed erstellt: **${created.name}** (\`${created.id}\`). Komponenten jetzt mit /embed-component-add hinzufuegen.`, flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: `❌ Erstellen fehlgeschlagen: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
