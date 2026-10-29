// BWW Phase 7 - /giveaway (start/end/cancel/reroll/edit/list/info, 07_GIVEAWAYS.md Commands).
// Loader-Format: { data, execute, toJSON, name }.
// Phase 11: BWW-Matrix je Subcommand (start=create, end=end, cancel/edit=manage,
// reroll=reroll, list/info=view) statt Admin/ManageGuild-Hardcheck – Giveaway Manager
// (Mapping, kein Discord-Aequivalent) kann verwalten, Viewer nur lesen.
// default_member_permissions bewusst entfernt. Legacy-Command-Mapping als Fallback.

const { MessageFlags } = require('discord.js');

const data = {
  name: 'giveaway',
  description: 'Verwaltet Giveaways (starten, beenden, neu ziehen, bearbeiten).',
  options: [
    { name: 'start', description: 'Startet ein neues Giveaway.', type: 1, options: [
      { name: 'preis', description: 'Was wird verlost?', type: 3, required: true },
      { name: 'dauer', description: 'Dauer, z. B. 10m, 1h, 24h, 7d', type: 3, required: true },
      { name: 'channel', description: 'Ziel-Channel (Standard: aktueller Channel)', type: 7, required: false, channel_types: [0] },
      { name: 'gewinner', description: 'Anzahl Gewinner (1-100)', type: 4, required: false, min_value: 1, max_value: 100 },
      { name: 'beschreibung', description: 'Optionale Beschreibung', type: 3, required: false },
      { name: 'rolle', description: 'Pflichtrolle (ID als Rolle)', type: 8, required: false },
      { name: 'accountalter', description: 'Mindest-Accountalter in Tagen (0-3650)', type: 4, required: false, min_value: 0, max_value: 3650 },
      { name: 'serveralter', description: 'Mindest-Serveralter in Tagen (0-3650)', type: 4, required: false, min_value: 0, max_value: 3650 },
      { name: 'min-level', description: 'Mindest-Level (Hook, Level-System folgt)', type: 4, required: false, min_value: 0, max_value: 10000 },
      { name: 'booster', description: 'Nur Booster teilnahmeberechtigt?', type: 5, required: false },
      { name: 'verified', description: 'Nur Verifizierte (Hook, Phase 8 folgt)?', type: 5, required: false },
    ]},
    { name: 'end', description: 'Beendet ein Giveaway sofort und zieht Gewinner.', type: 1, options: [
      { name: 'id', description: 'Giveaway-ID', type: 3, required: true },
    ]},
    { name: 'cancel', description: 'Bricht ein Giveaway ohne Gewinner ab.', type: 1, options: [
      { name: 'id', description: 'Giveaway-ID', type: 3, required: true },
      { name: 'grund', description: 'Grund (optional)', type: 3, required: false },
    ]},
    { name: 'reroll', description: 'Zieht neue Gewinner fuer ein beendetes Giveaway.', type: 1, options: [
      { name: 'id', description: 'Giveaway-ID', type: 3, required: true },
      { name: 'grund', description: 'Grund (optional)', type: 3, required: false },
      { name: 'anzahl', description: 'Anzahl neue Gewinner (Standard: Original)', type: 4, required: false, min_value: 1, max_value: 100 },
    ]},
    { name: 'edit', description: 'Bearbeitet ein laufendes Giveaway.', type: 1, options: [
      { name: 'id', description: 'Giveaway-ID', type: 3, required: true },
      { name: 'preis', description: 'Neuer Preis', type: 3, required: false },
      { name: 'beschreibung', description: 'Neue Beschreibung', type: 3, required: false },
      { name: 'gewinner', description: 'Neue Gewinneranzahl (1-100)', type: 4, required: false, min_value: 1, max_value: 100 },
      { name: 'dauer', description: 'Neue Restdauer, z. B. 1h, 24h (setzt ends_at neu)', type: 3, required: false },
    ]},
    { name: 'list', description: 'Listet Giveaways dieses Servers.', type: 1, options: [
      { name: 'status', description: 'Filter', type: 3, required: false, choices: [{ name: 'Aktiv', value: 'active' }, { name: 'Vergangen', value: 'past' }, { name: 'Alle', value: 'all' }] },
    ]},
    { name: 'info', description: 'Zeigt Details, Teilnehmer, Gewinner und Requirements.', type: 1, options: [
      { name: 'id', description: 'Giveaway-ID', type: 3, required: true },
    ]},
  ],
};

// Phase 11: Matrix-Permission je Subcommand (11_PERMISSIONS Giveaway: 5 Rechte).
function requiredPermission(sub) {
  const map = { start: 'giveaway.create', end: 'giveaway.end', cancel: 'giveaway.manage', reroll: 'giveaway.reroll', edit: 'giveaway.manage', list: 'giveaway.view', info: 'giveaway.view' };
  return map[sub] || 'giveaway.manage';
}

async function execute(interaction, client) {
  // Phase 11 (09-Grundprinzip Schritt 1): Guild-Kontext zuerst (vorher fehlend).
  if (!interaction.guildId || !interaction.guild) { await interaction.reply({ content: 'Nur auf Servern.', flags: MessageFlags.Ephemeral }).catch(() => {}); return; }
  const { requireGuildId } = require('../../services/validation');
  let guildId; try { guildId = requireGuildId(interaction.guildId); } catch { await interaction.reply({ content: 'Ungueltige Guild-ID.', flags: MessageFlags.Ephemeral }).catch(() => {}); return; }
  const sub = interaction.options.getSubcommand();
  // Phase 11 (Schritte 2-3): BWW-Matrix statt Admin/ManageGuild-Hardcheck, Legacy-Fallback inklusive.
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
  const mod = require('../../modules/giveaway');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    if (sub === 'start') {
      const prize = interaction.options.getString('preis', true);
      const duration = interaction.options.getString('dauer', true);
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      if (!channel?.isTextBased?.()) throw new Error('Ziel-Channel ist nicht textbasiert.');
      const requirements = [];
      const role = interaction.options.getRole('rolle');
      if (role) requirements.push({ requirement_type: 'role', requirement_value: role.id });
      const acc = interaction.options.getInteger('accountalter');
      if (acc != null && acc > 0) requirements.push({ requirement_type: 'account_age', requirement_value: String(acc) });
      const srv = interaction.options.getInteger('serveralter');
      if (srv != null && srv > 0) requirements.push({ requirement_type: 'server_age', requirement_value: String(srv) });
      const lvl = interaction.options.getInteger('min-level');
      if (lvl != null && lvl > 0) requirements.push({ requirement_type: 'minimum_level', requirement_value: String(lvl) });
      if (interaction.options.getBoolean('booster')) requirements.push({ requirement_type: 'booster', requirement_value: 'true' });
      if (interaction.options.getBoolean('verified')) requirements.push({ requirement_type: 'verified', requirement_value: 'true' });
      const created = await mod.createGiveaway({ guildId: interaction.guildId, channelId: channel.id, hostId: interaction.user.id, prize, description: interaction.options.getString('beschreibung') || null, winnerCount: interaction.options.getInteger('gewinner') || 1, duration, requirements });
      try {
        const target = client.channels.cache.get(channel.id) || await client.channels.fetch(channel.id).catch(() => null);
        const ch = target || channel;
        await mod.sendGiveawayMessage(client, ch, created, { entryCount: 0 });
      } catch (e) { await mod.setMessageId(created.id, 'pending', interaction.guildId).catch(() => {}); }
      await interaction.followUp({ content: 'Giveaway gestartet: **' + created.prize + '** (ID: `' + created.id + '`, Ende: <t:' + Math.floor(new Date(created.ends_at).getTime() / 1000) + ':R>, Gewinner: ' + created.winner_count + (requirements.length ? ', Requirements: ' + requirements.length : '') + ').', flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'end') {
      const id = interaction.options.getString('id', true);
      const g = await mod.getGiveaway(id, interaction.guildId);
      if (!g) throw new Error('Giveaway nicht gefunden.');
      const winners = await mod.endGiveaway(client, g, { actorId: interaction.user.id });
      await interaction.followUp({ content: winners.length ? 'Beendet. Gewinner: ' + winners.map((w) => '<@' + w + '>').join(', ') : 'Beendet. Keine gueltigen Teilnehmer.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'cancel') {
      const id = interaction.options.getString('id', true);
      const grund = interaction.options.getString('grund') || null;
      const g = await mod.getGiveaway(id, interaction.guildId);
      if (!g) throw new Error('Giveaway nicht gefunden.');
      await mod.cancelGiveaway(g.id, g.guild_id, interaction.user.id, grund);
      await mod.updateGiveawayMessage(client, { ...g, status: 'cancelled' }).catch(() => {});
      await interaction.followUp({ content: 'Giveaway abgebrochen' + (grund ? ': ' + grund : '.'), flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'reroll') {
      const id = interaction.options.getString('id', true);
      const grund = interaction.options.getString('grund') || null;
      const anzahl = interaction.options.getInteger('anzahl') || null;
      const g = await mod.getGiveaway(id, interaction.guildId);
      if (!g) throw new Error('Giveaway nicht gefunden.');
      const res = await mod.rerollGiveaway(client, g, { actorId: interaction.user.id, reason: grund, count: anzahl });
      await interaction.followUp({ content: res.newWinnerIds.length ? 'Neue Gewinner: ' + res.newWinnerIds.map((w) => '<@' + w + '>').join(', ') : 'Keine weiteren Teilnehmer.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'edit') {
      const id = interaction.options.getString('id', true);
      const patch = {};
      const preis = interaction.options.getString('preis');
      if (preis) patch.prize = preis;
      const beschreibung = interaction.options.getString('beschreibung');
      if (beschreibung !== null && beschreibung !== undefined) patch.description = beschreibung;
      const gewinner = interaction.options.getInteger('gewinner');
      if (gewinner) patch.winner_count = gewinner;
      const dauer = interaction.options.getString('dauer');
      if (dauer) patch.duration = dauer;
      if (!Object.keys(patch).length) throw new Error('Nichts zu aendern (preis/beschreibung/gewinner/dauer).');
      const g = await mod.getGiveaway(id, interaction.guildId);
      if (!g) throw new Error('Giveaway nicht gefunden.');
      const updated = await mod.editGiveaway(g.id, g.guild_id, patch, interaction.user.id);
      await mod.updateGiveawayMessage(client, updated).catch(() => {});
      await interaction.followUp({ content: 'Gespeichert: **' + updated.prize + '** (' + updated.winner_count + ' Gewinner, Ende <t:' + Math.floor(new Date(updated.ends_at).getTime() / 1000) + ':R>).', flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'list') {
      const status = interaction.options.getString('status') || 'active';
      const rows = await mod.listGiveaways(interaction.guildId, { status: status === 'all' ? null : status, limit: 15 });
      if (!rows.length) { await interaction.followUp({ content: 'Keine Giveaways gefunden.', flags: MessageFlags.Ephemeral }); return; }
      const lines = rows.map((r) => {
        const icon = ['ended'].includes(r.status) ? 'ENDET' : r.status === 'cancelled' ? 'ABBR' : 'AKTIV';
        return '[' + icon + '] `' + r.id + '` - **' + r.prize + '** (' + r.winner_count + 'x, Ende <t:' + Math.floor(new Date(r.ends_at || r.end_at || Date.now()).getTime() / 1000) + ':R>)';
      });
      await interaction.followUp({ content: ('Giveaways (' + rows.length + '):\n' + lines.join('\n')).slice(0, 2000), flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'info') {
      const id = interaction.options.getString('id', true);
      const g = await mod.getGiveaway(id, interaction.guildId);
      if (!g) throw new Error('Giveaway nicht gefunden.');
      const [entries, winners, reqs] = await Promise.all([
        mod.listEntries(g.id, 2000).catch(() => []),
        (async () => { try { const { supabaseRequest, isConfigured } = require('../../services/supabase'); if (!isConfigured()) return []; const r = await supabaseRequest('bww_giveaway_winners?select=user_id,position&giveaway_id=eq.' + encodeURIComponent(g.id) + '&order=position.asc&limit=100', { headers: { Prefer: 'return=representation' } }); return r.json(); } catch { return []; } })(),
        mod.listRequirements(g.id).catch(() => []),
      ]);
      const reqLine = reqs.length ? reqs.map((r) => r.requirement_type + '=' + r.requirement_value).join(', ') : 'keine';
      await interaction.followUp({ content: ('**' + g.prize + '**\nID: `' + g.id + '`\nStatus: ' + g.status + '\nGewinneranzahl: ' + g.winner_count + '\nEnde: <t:' + Math.floor(new Date(g.ends_at || g.end_at || Date.now()).getTime() / 1000) + ':f>\nTeilnehmer: ' + entries.length + '\nGewinner: ' + (winners.map((w) => '<@' + w.user_id + '>').join(', ') || '-') + '\nRequirements: ' + reqLine + (g.description ? '\nBeschreibung: ' + String(g.description).slice(0, 500) : '')).slice(0, 2000), flags: MessageFlags.Ephemeral });
      return;
    }
    throw new Error('Unbekannter Subcommand.');
  } catch (err) {
    await interaction.followUp({ content: 'Fehlgeschlagen: ' + err.message, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
