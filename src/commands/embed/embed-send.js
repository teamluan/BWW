// BWW Phase 5 – /embed-send (gespeichertes Embed an berechtigten Channel senden, Channel-Perm-Check).

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'embed-send',
  description: 'Sendet ein gespeichertes Embed V2 in einen Channel.',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    { name: 'embed', description: 'Embed-ID oder Name', type: 3, required: true },
    { name: 'channel', description: 'Ziel-Channel', type: 7, required: true, channel_types: [0] },
  ],
};

async function resolveEmbed(guildId, raw) {
  const { getEmbed, getEmbedByKey, listEmbeds } = require('../../modules/embed/embedService');
  const v = String(raw || '').trim();
  const direct = await getEmbed(v, guildId).catch(() => null);
  if (direct) return direct;
  const byKey = await getEmbedByKey(guildId, v).catch(() => null);
  if (byKey) return byKey;
  const all = await listEmbeds(guildId).catch(() => []);
  return all.find((e) => e.name.toLowerCase() === v.toLowerCase()) || null;
}

async function execute(interaction, client) {
  const { sendEmbed } = require('../../modules/embed/sendService');
  const { isEmbedManager } = require('../../modules/embed/actionService');
  if (!(await isEmbedManager(interaction.member, interaction.guildId))) {
    await interaction.reply({ content: '❌ Nur Administratoren oder Embed-Manager.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const embed = await resolveEmbed(interaction.guildId, interaction.options.getString('embed', true));
    if (!embed) throw new Error('Embed nicht gefunden (ID oder Name pruefen, /embed-list).');
    const channel = interaction.options.getChannel('channel', true);
    const sent = await sendEmbed(client, embed.id, interaction.guildId, channel.id, interaction.member);
    await interaction.followUp({ content: `✅ Embed **${embed.name}** gesendet: ${channel} ([Nachricht](${sent.url})).`, flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: `❌ Senden fehlgeschlagen: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
