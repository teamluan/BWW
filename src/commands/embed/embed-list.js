// BWW Phase 5 – /embed-list (Embeds auflisten).

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'embed-list',
  description: 'Listet gespeicherte Embeds V2.',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [{ name: 'nur-aktiv', description: 'Nur aktivierte Embeds', type: 5, required: false }],
};

async function execute(interaction) {
  const { listEmbeds } = require('../../modules/embed/embedService');
  const { isEmbedManager } = require('../../modules/embed/actionService');
  if (!(await isEmbedManager(interaction.member, interaction.guildId))) {
    await interaction.reply({ content: '❌ Nur Administratoren oder Embed-Manager.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const rows = await listEmbeds(interaction.guildId, { onlyEnabled: interaction.options.getBoolean('nur-aktiv') === true });
    if (!rows.length) { await interaction.followUp({ content: '📭 Keine Embeds gespeichert.', flags: MessageFlags.Ephemeral }); return; }
    const lines = rows.slice(0, 20).map((e) => `${e.enabled !== false ? '🟢' : '⚪'} **${e.name}** (\`${e.id.slice(0, 8)}\`)${e.description ? ` – ${String(e.description).slice(0, 80)}` : ''}`);
    await interaction.followUp({ content: `📦 Embeds (${rows.length}):\n${lines.join('\n')}`.slice(0, 2000), flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: `❌ Liste fehlgeschlagen: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
