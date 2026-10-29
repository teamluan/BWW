// BWW Phase 9 – /embed (konsolidiert: create/edit/delete/list/send/preview/clone/template).
// Duenne Wrapper um embedService/clone/saveAsTemplate (keine Duplikat-Logik).
// Legacy-Aliase bleiben (embed-create/list/send/clone/component-add).
// Phase 11: BWW-Matrix feingranular je Subcommand (create/edit/delete/send/templates/view)
// statt grobem isEmbedManager-Gate – z. B. darf Giveaway Manager Embeds lesen
// (embed.view), aber nur Manager+ senden/loschen. Service-Layer (isEmbedManager,
// jetzt ebenfalls Matrix) bleibt zweite Schicht. default_member_permissions bewusst
// entfernt (BWW-Rollen haben teils kein Discord-Aequivalent). Legacy-Mapping als Fallback.
const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const data = {
  name: 'embed',
  description: 'Embed V2 verwalten (erstellen, senden, klonen, Templates).',
  options: [
    { name: 'create', description: 'Embed anlegen.', type: 1, options: [{ name: 'name', description: 'Embed-Name', type: 3, required: true }, { name: 'beschreibung', description: 'Kurzbeschreibung', type: 3, required: false }, { name: 'aktiv', description: 'Sofort aktivieren', type: 5, required: false }] },
    { name: 'edit', description: 'Embed bearbeiten (Wrapper um updateEmbed).', type: 1, options: [{ name: 'embed', description: 'Embed-ID oder Name', type: 3, required: true }, { name: 'name', description: 'Neuer Name', type: 3, required: false }, { name: 'beschreibung', description: 'Neue Beschreibung', type: 3, required: false }, { name: 'farbe', description: 'Hex-Farbe (#RRGGBB)', type: 3, required: false }, { name: 'aktiv', description: 'Aktiviert?', type: 5, required: false }] },
    { name: 'delete', description: 'Embed loeschen (Wrapper um deleteEmbed).', type: 1, options: [{ name: 'embed', description: 'Embed-ID oder Name', type: 3, required: true }] },
    { name: 'list', description: 'Embeds auflisten.', type: 1, options: [{ name: 'nur-aktiv', description: 'Nur aktivierte', type: 5, required: false }] },
    { name: 'send', description: 'Embed in Channel senden.', type: 1, options: [{ name: 'embed', description: 'Embed-ID oder Name', type: 3, required: true }, { name: 'channel', description: 'Ziel-Channel', type: 7, required: true, channel_types: [0] }] },
    { name: 'preview', description: 'Embed-Vorschau (ephemeral).', type: 1, options: [{ name: 'embed', description: 'Embed-ID oder Name', type: 3, required: true }] },
    { name: 'clone', description: 'Embed klonen (Wrapper um cloneEmbed).', type: 1, options: [{ name: 'quelle', description: 'Quell-Embed (ID/Name)', type: 3, required: true }, { name: 'name', description: 'Neuer Name', type: 3, required: true }] },
    { name: 'template', description: 'Als Template speichern (Wrapper um saveAsTemplate).', type: 1, options: [{ name: 'embed', description: 'Embed-ID oder Name', type: 3, required: true }, { name: 'template-name', description: 'Template-Name', type: 3, required: false }] },
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
  return all.find((e) => String(e.name || '').toLowerCase() === v.toLowerCase()) || null;
}
// Phase 11: Matrix-Permission je Subcommand (11_PERMISSIONS Embed V2: 6 Rechte).
function requiredPermission(sub) {
  const map = { create: 'embed.create', edit: 'embed.edit', delete: 'embed.delete', list: 'embed.view', send: 'embed.send', preview: 'embed.view', clone: 'embed.create', template: 'embed.templates' };
  return map[sub] || 'embed.view';
}
async function execute(interaction, client) {
  if (!interaction.guildId || !interaction.guild) { await interaction.reply({ content: 'Nur auf Servern.', flags: MessageFlags.Ephemeral }).catch(() => {}); return; }
  const { requireGuildId } = require('../../services/validation');
  let guildId; try { guildId = requireGuildId(interaction.guildId); } catch { await interaction.reply({ content: 'Ungueltige Guild-ID.', flags: MessageFlags.Ephemeral }).catch(() => {}); return; }
  const sub = interaction.options.getSubcommand(true);
  // Phase 11: BWW-Matrix (Guild -> Mapping/Discord-Fallback -> Permission -> Action), Legacy-Fallback inklusive.
  try {
    const { requirePermission, loadGuildRoleMappings } = require('../../services/permissions');
    const { getGuildSettings } = require('../../utils/database');
    const settings = await getGuildSettings(guildId).catch(() => null);
    const guildRoles = await loadGuildRoleMappings(guildId).catch(() => []);
    await requirePermission(interaction.member, requiredPermission(sub), { guildId, guildRoles, settings });
  } catch {
    await interaction.reply({ content: 'Keine Berechtigung (' + requiredPermission(sub) + ').', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  if (!interaction.channel?.permissionsFor?.(interaction.guild.members.me)?.has?.(PermissionFlagsBits.SendMessages) && ['send'].includes(interaction.options.getSubcommand(false) || '')) {
    await interaction.reply({ content: 'Bot darf hier nicht schreiben.', flags: MessageFlags.Ephemeral }).catch(() => {}); return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
  const { logger } = require('../../services/logger');
  try {
    const svc = require('../../modules/embed/embedService');
    if (sub === 'create') {
      const created = await svc.createEmbed(guildId, { name: interaction.options.getString('name', true), description: interaction.options.getString('beschreibung') || null, enabled: interaction.options.getBoolean('aktiv') !== false }, interaction.user.id);
      await interaction.followUp({ content: 'Embed erstellt: **' + created.name + '** (`' + created.id + '`).', flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'edit') {
      const found = await resolveEmbed(guildId, interaction.options.getString('embed', true));
      if (!found) throw new Error('Embed nicht gefunden.');
      const patch = {};
      const n = interaction.options.getString('name'); if (n) patch.name = n;
      const d = interaction.options.getString('beschreibung'); if (d !== null && d !== undefined) patch.description = d;
      const c = interaction.options.getString('farbe'); if (c) { if (!/^#[0-9a-f]{6}$/i.test(c)) throw new Error('Farbe als #RRGGBB.'); patch.color = c; }
      const a = interaction.options.getBoolean('aktiv'); if (a !== null && a !== undefined) patch.enabled = a;
      if (!Object.keys(patch).length) throw new Error('Nichts zu aendern.');
      const updated = await svc.updateEmbed(found.id, guildId, patch, interaction.user.id);
      await interaction.followUp({ content: 'Gespeichert: **' + updated.name + '** (`' + updated.id + '`).', flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'delete') {
      const found = await resolveEmbed(guildId, interaction.options.getString('embed', true));
      if (!found) throw new Error('Embed nicht gefunden.');
      await svc.deleteEmbed(found.id, guildId, interaction.user.id);
      await interaction.followUp({ content: 'Embed `' + found.name + '` geloescht.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'list') {
      const rows = await svc.listEmbeds(guildId, { onlyEnabled: interaction.options.getBoolean('nur-aktiv') === true });
      if (!rows.length) { await interaction.followUp({ content: 'Keine Embeds gespeichert.', flags: MessageFlags.Ephemeral }); return; }
      const lines = rows.slice(0, 20).map((e) => (e.enabled !== false ? '🟢' : '⚪') + ' **' + e.name + '** (`' + String(e.id).slice(0, 8) + '`)');
      await interaction.followUp({ content: ('Embeds (' + rows.length + '):\n' + lines.join('\n')).slice(0, 2000), flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'send') {
      const { sendEmbed } = require('../../modules/embed/sendService');
      const found = await resolveEmbed(guildId, interaction.options.getString('embed', true));
      if (!found) throw new Error('Embed nicht gefunden.');
      const channel = interaction.options.getChannel('channel', true);
      const sent = await sendEmbed(client, found.id, guildId, channel.id, interaction.member);
      await interaction.followUp({ content: 'Embed **' + found.name + '** gesendet: ' + channel + ' ([Nachricht](' + sent.url + ')).', flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'preview') {
      const found = await resolveEmbed(guildId, interaction.options.getString('embed', true));
      if (!found) throw new Error('Embed nicht gefunden.');
      const full = await svc.getFullEmbed(found.id, guildId).catch(() => null);
      const summary = 'Preview **' + found.name + '** (`' + found.id + '`)\nBeschreibung: ' + String(found.description || '-').slice(0, 300) + '\nAktiv: ' + (found.enabled !== false ? 'ja' : 'nein') + (full ? ('\nKomponenten: ' + (full.components?.length || 0) + ' - Buttons: ' + (full.buttons?.length || 0) + ' - Selects: ' + (full.options?.length || 0) + ' - Actions: ' + (full.actions?.length || 0)) : '');
      await interaction.followUp({ content: summary.slice(0, 2000), flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'clone') {
      const src = await resolveEmbed(guildId, interaction.options.getString('quelle', true));
      if (!src) throw new Error('Quell-Embed nicht gefunden.');
      const created = await svc.cloneEmbed(src.id, guildId, interaction.options.getString('name', true), interaction.user.id);
      await interaction.followUp({ content: 'Geklont: **' + src.name + '** -> **' + created.name + '** (`' + created.id + '`).', flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'template') {
      const found = await resolveEmbed(guildId, interaction.options.getString('embed', true));
      if (!found) throw new Error('Embed nicht gefunden.');
      const tpl = await svc.saveAsTemplate(found.id, guildId, interaction.options.getString('template-name') || found.name, interaction.user.id);
      await interaction.followUp({ content: 'Als Template gespeichert: `' + (tpl?.name || found.name) + '` (aus **' + found.name + '**).', flags: MessageFlags.Ephemeral });
      return;
    }
    throw new Error('Unbekannter Subcommand.');
  } catch (err) {
    logger.child('command:embed').warn('failed', guildId, err.message);
    await interaction.followUp({ content: 'Fehlgeschlagen: ' + String(err.message).slice(0, 500), flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}
module.exports = { data, execute, toJSON: () => data, name: data.name };
