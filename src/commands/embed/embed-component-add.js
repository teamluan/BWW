// BWW Phase 5 – /embed-component-add (Komponente anhaengen: container/section/text/thumbnail/gallery/separator/button/select/action row).

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'embed-component-add',
  description: 'Fuegt eine Komponente zu einem Embed V2 hinzu.',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    { name: 'embed', description: 'Embed-ID oder Name', type: 3, required: true },
    {
      name: 'typ', description: 'Komponenten-Typ', type: 3, required: true, choices: [
        { name: 'Container', value: 'container' }, { name: 'Text', value: 'text' }, { name: 'Section', value: 'section' },
        { name: 'Button', value: 'button' }, { name: 'Select Menu', value: 'select' }, { name: 'Media Gallery', value: 'media_gallery' }, { name: 'Separator', value: 'separator' },
      ],
    },
    { name: 'inhalt', description: 'Text-Inhalt (fuer text/section)', type: 3, required: false },
    { name: 'position', description: 'Position (0 = oben)', type: 4, required: false, min_value: 0, max_value: 39 },
  ],
};

async function execute(interaction) {
  const { getEmbed, getEmbedByKey, listEmbeds } = require('../../modules/embed/embedService');
  const { createComponent } = require('../../modules/embed/componentService');
  const { isEmbedManager } = require('../../modules/embed/actionService');
  if (!(await isEmbedManager(interaction.member, interaction.guildId))) {
    await interaction.reply({ content: '❌ Nur Administratoren oder Embed-Manager.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const raw = interaction.options.getString('embed', true);
    let embed = await getEmbed(raw, interaction.guildId).catch(() => null);
    if (!embed) embed = await getEmbedByKey(interaction.guildId, raw).catch(() => null);
    if (!embed) { const all = await listEmbeds(interaction.guildId).catch(() => []); embed = all.find((e) => e.name.toLowerCase() === String(raw).toLowerCase()) || null; }
    if (!embed) throw new Error('Embed nicht gefunden.');
    const typ = interaction.options.getString('typ', true);
    const inhalt = interaction.options.getString('inhalt') || '';
    const data = typ === 'text' ? { content: inhalt || 'Neuer Text' } : typ === 'section' ? { texts: [inhalt || 'Section-Text'], accessory: undefined } : typ === 'separator' ? { divider: true, spacing: 'small' } : typ === 'media_gallery' ? { items: [] } : typ === 'select' ? { kind: 'string', customId: `bww_embed_select_${Date.now().toString(36)}`, placeholder: 'Bitte auswaehlen', options: [] } : typ === 'button' ? { buttons: [] } : {};
    const created = await createComponent(embed.id, interaction.guildId, { component_type: typ, position: interaction.options.getInteger('position') ?? undefined, data }, interaction.user.id);
    await interaction.followUp({ content: `✅ Komponente **${typ}** zu **${embed.name}** hinzugefuegt (\`${created.id}\`). Feinschliff im Dashboard: /embeds.`, flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: `❌ Komponente fehlgeschlagen: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
