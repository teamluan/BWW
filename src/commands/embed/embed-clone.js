// BWW Phase 5 – /embed-clone (Embed klonen, 05: Embeds sollten klonbar sein).

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'embed-clone',
  description: 'Klon ein Embed V2 unter neuem Namen (inkl. Komponenten/Buttons/Selects).',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    { name: 'quelle', description: 'Quell-Embed (ID oder Name)', type: 3, required: true },
    { name: 'name', description: 'Neuer Name', type: 3, required: true },
  ],
};

async function execute(interaction) {
  const { getEmbed, getEmbedByKey, listEmbeds, cloneEmbed } = require('../../modules/embed/embedService');
  const { isEmbedManager } = require('../../modules/embed/actionService');
  if (!(await isEmbedManager(interaction.member, interaction.guildId))) {
    await interaction.reply({ content: '❌ Nur Administratoren oder Embed-Manager.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const raw = interaction.options.getString('quelle', true);
    let src = await getEmbed(raw, interaction.guildId).catch(() => null);
    if (!src) src = await getEmbedByKey(interaction.guildId, raw).catch(() => null);
    if (!src) { const all = await listEmbeds(interaction.guildId).catch(() => []); src = all.find((e) => e.name.toLowerCase() === String(raw).toLowerCase()) || null; }
    if (!src) throw new Error('Quell-Embed nicht gefunden.');
    const created = await cloneEmbed(src.id, interaction.guildId, interaction.options.getString('name', true), interaction.user.id);
    await interaction.followUp({ content: `✅ Geklont: **${src.name}** → **${created.name}** (\`${created.id}\`).`, flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: `❌ Klonen fehlgeschlagen: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
