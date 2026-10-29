// BWW Phase 9 – /honeypot (konsolidiert: create/delete/list/enable/disable/logs/whitelist).
// Duenne Wrapper um bestehende Modul-Services (keine Duplikat-Logik).
// Whitelist = exempt-add/remove (exemptionService). Legacy-Aliase bleiben (honeypot-create/list/toggle/exempt-*).
// Grundprinzip: 1 Guild, 2 BWW-Perm, 3 Discord-Perm, 4 Validation, 5 DB via Service, 6 ephemeral, 7 Audit/Log.
// Phase 11: BWW-Matrix je Subcommand (view vs. manage getrennt, 11_PERMISSIONS) statt
// Admin-Hardcheck – Manager/Moderator mit honeypot.*-Recht (Mapping oder Discord-Fallback)
// duerfen lesen/verwalten, Viewer nur lesen. Legacy-Command-Mapping bleibt als Fallback.
// default_member_permissions bewusst entfernt (BWW-Rollen haben teils kein Discord-Aequivalent).
const { MessageFlags } = require('discord.js');
const data = {
  name: 'honeypot',
  description: 'Honeypot verwalten (Trap, Logs, Whitelist).',
  options: [
    { name: 'create', description: 'Honeypot anlegen.', type: 1, options: [
      { name: 'channel', description: 'Trap-Channel', type: 7, required: true, channel_types: [0] },
      { name: 'name', description: 'Name (z.B. trap-1)', type: 3, required: true },
      { name: 'beschreibung', description: 'Beschreibung (intern)', type: 3, required: false },
      { name: 'aktion', description: 'Aktion bei Treffer', type: 3, required: false, choices: [{ name: 'Nur loggen', value: 'log_only' }, { name: 'Loeschen', value: 'delete' }, { name: 'Verwarnen', value: 'warn' }, { name: 'Timeout', value: 'timeout' }, { name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' }, { name: 'Staff benachrichtigen', value: 'notify_staff' }] },
      { name: 'nachricht-loeschen', description: 'Trigger-Nachricht loeschen? (Standard: ja)', type: 5, required: false },
      { name: 'timeout-aktiv', description: 'Zusatz-Timeout aktivieren?', type: 5, required: false },
      { name: 'timeout-dauer', description: 'Timeout-Dauer in Minuten (1-40320)', type: 4, required: false, min_value: 1, max_value: 40320 },
      { name: 'ban-aktiv', description: 'Zusatz-Ban aktivieren?', type: 5, required: false },
      { name: 'log-channel', description: 'Log-Channel fuer Treffer', type: 7, required: false, channel_types: [0] },
    ]},
    { name: 'delete', description: 'Honeypot loeschen.', type: 1, options: [{ name: 'id', description: 'Honeypot-ID (siehe /honeypot list)', type: 3, required: true }] },
    { name: 'list', description: 'Alle Honeypots auflisten.', type: 1, options: [{ name: 'nur-aktiv', description: 'Nur aktive?', type: 5, required: false }] },
    { name: 'enable', description: 'Honeypot aktivieren.', type: 1, options: [{ name: 'id', description: 'Honeypot-ID', type: 3, required: true }] },
    { name: 'disable', description: 'Honeypot deaktivieren.', type: 1, options: [{ name: 'id', description: 'Honeypot-ID', type: 3, required: true }] },
    { name: 'logs', description: 'Letzte Treffer/Logs anzeigen.', type: 1, options: [{ name: 'limit', description: 'Anzahl (1-25, Standard 10)', type: 4, required: false, min_value: 1, max_value: 25 }, { name: 'user', description: 'Filter: Benutzer', type: 6, required: false }] },
    { name: 'whitelist', description: 'Staff-Ausnahmen (exempt).', type: 2, options: [
      { name: 'add', description: 'Ausnahme anlegen (User ODER Rolle).', type: 1, options: [{ name: 'benutzer', description: 'Benutzer', type: 6, required: false }, { name: 'rolle', description: 'Rolle', type: 8, required: false }, { name: 'grund', description: 'Grund', type: 3, required: false }] },
      { name: 'remove', description: 'Ausnahme entfernen.', type: 1, options: [{ name: 'id', description: 'Exemption-ID', type: 3, required: true }] },
      { name: 'list', description: 'Ausnahmen auflisten.', type: 1 },
    ]},
  ],
};
async function guard(interaction) {
  if (!interaction.guildId || !interaction.guild) { await interaction.reply({ content: 'Nur auf Servern.', flags: MessageFlags.Ephemeral }).catch(() => {}); return null; }
  const { requireGuildId } = require('../../services/validation');
  let guildId; try { guildId = requireGuildId(interaction.guildId); } catch { await interaction.reply({ content: 'Ungueltige Guild-ID.', flags: MessageFlags.Ephemeral }).catch(() => {}); return null; }
  return guildId;
}
// Phase 11: Matrix-Permission je Subcommand (view vs. manage getrennt, 11_PERMISSIONS).
function requiredPermission(group, sub) {
  if (group === 'whitelist') return sub === 'list' ? 'honeypot.view' : 'honeypot.exemptions';
  const map = { create: 'honeypot.manage', delete: 'honeypot.manage', list: 'honeypot.view', enable: 'honeypot.manage', disable: 'honeypot.manage', logs: 'honeypot.logs' };
  return map[sub] || 'honeypot.manage';
}
async function execute(interaction, client) {
  const guildId = await guard(interaction);
  if (!guildId) return;
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand(true);
  // Phase 11: BWW-Matrix (Guild -> Mapping/Discord-Fallback -> Permission -> Action), Legacy-Fallback inklusive.
  try {
    const { requirePermission, loadGuildRoleMappings } = require('../../services/permissions');
    const { getGuildSettings } = require('../../utils/database');
    const settings = await getGuildSettings(guildId).catch(() => null);
    const guildRoles = await loadGuildRoleMappings(guildId).catch(() => []);
    await requirePermission(interaction.member, requiredPermission(group, sub), { guildId, guildRoles, settings });
  } catch {
    await interaction.reply({ content: 'Keine Berechtigung (' + requiredPermission(group, sub) + ').', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
  const { logAudit } = require('../../services/audit');
  const { logger } = require('../../services/logger');
  try {
    if (group === 'whitelist') {
      const { addExemption, removeExemption, listExemptions } = require('../../modules/honeypot/exemptionService');
      if (sub === 'add') {
        const user = interaction.options.getUser('benutzer');
        const role = interaction.options.getRole('rolle');
        if ((user && role) || (!user && !role)) throw new Error('Genau eine Angabe: benutzer ODER rolle.');
        const created = await addExemption(guildId, { user_id: user?.id || null, role_id: role?.id || null, reason: interaction.options.getString('grund') || 'Staff-Ausnahme' }, interaction.user.id);
        await interaction.followUp({ content: 'Ausnahme angelegt: ' + (user ? ('User ' + user.tag) : ('Rolle ' + role.name)) + ' (ID: ' + created.id + ').', flags: MessageFlags.Ephemeral });
        return;
      }
      if (sub === 'remove') {
        const id = interaction.options.getString('id', true);
        const ok = await removeExemption(id, guildId, interaction.user.id);
        await interaction.followUp({ content: ok ? ('Ausnahme ' + id + ' entfernt.') : 'Ausnahme nicht gefunden.', flags: MessageFlags.Ephemeral });
        return;
      }
      const all = await listExemptions(guildId);
      if (!all.length) { await interaction.followUp({ content: 'Keine Ausnahmen. Mit /honeypot whitelist add anlegen.', flags: MessageFlags.Ephemeral }); return; }
      const lines = all.slice(0, 20).map((e) => '- `' + e.id + '` ' + (e.user_id ? ('<@' + e.user_id + '>') : (e.role_id ? ('<@&' + e.role_id + '>') : e.exempt_id || '')) + (e.reason ? (' - ' + String(e.reason).slice(0, 60)) : ''));
      await interaction.followUp({ content: ('Whitelist (' + all.length + '):\n' + lines.join('\n')).slice(0, 2000), flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'create') {
      const { createHoneypot } = require('../../modules/honeypot/honeypotService');
      const channel = interaction.options.getChannel('channel', true);
      const timeoutMin = interaction.options.getInteger('timeout-dauer');
      const created = await createHoneypot(guildId, {
        channel_id: channel.id,
        name: interaction.options.getString('name', true),
        description: interaction.options.getString('beschreibung') || null,
        action: interaction.options.getString('aktion') || 'log_only',
        delete_message: interaction.options.getBoolean('nachricht-loeschen') ?? true,
        timeout_enabled: interaction.options.getBoolean('timeout-aktiv') ?? false,
        timeout_duration: timeoutMin != null ? timeoutMin * 60 : 600,
        ban_enabled: interaction.options.getBoolean('ban-aktiv') ?? false,
        log_channel_id: interaction.options.getChannel('log-channel')?.id || null,
        enabled: true,
      }, interaction.user.id);
      await interaction.followUp({ content: 'Honeypot erstellt: ' + (created.name || created.id) + ' in ' + channel + ' (Aktion: ' + created.action + ', ID: ' + created.id + ').', flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'delete') {
      const { deleteHoneypot, getHoneypot } = require('../../modules/honeypot/honeypotService');
      const id = interaction.options.getString('id', true);
      const cur = await getHoneypot(id, guildId).catch(() => null);
      if (!cur) throw new Error('Honeypot nicht gefunden.');
      await deleteHoneypot(id, guildId, interaction.user.id);
      await interaction.followUp({ content: 'Honeypot `' + (cur.name || id) + '` geloescht.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'list') {
      const { listHoneypots } = require('../../modules/honeypot/honeypotService');
      const onlyActive = interaction.options.getBoolean('nur-aktiv') === true;
      const all = await listHoneypots(guildId, { onlyEnabled: onlyActive });
      if (!all.length) { await interaction.followUp({ content: 'Keine Honeypots. Mit /honeypot create starten.', flags: MessageFlags.Ephemeral }); return; }
      const lines = all.slice(0, 20).map((h) => '- ' + (h.name || h.id) + ' in <#' + (h.channel_id || '?') + '> | ' + h.action + ' | ' + (h.enabled ? 'aktiv' : 'pausiert') + ' | Hits: ' + (h.hit_count ?? 0) + ' | ID: ' + h.id);
      await interaction.followUp({ content: ('Honeypots (' + all.length + '):\n' + lines.join('\n')).slice(0, 2000), flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'enable' || sub === 'disable') {
      const { getHoneypot, setEnabled } = require('../../modules/honeypot/honeypotService');
      const id = interaction.options.getString('id', true);
      const cur = await getHoneypot(id, guildId);
      if (!cur) throw new Error('Honeypot nicht gefunden.');
      const updated = await setEnabled(id, guildId, sub === 'enable', interaction.user.id);
      await interaction.followUp({ content: 'Honeypot ' + (updated.name || updated.id) + ' ist jetzt ' + (updated.enabled ? 'aktiv.' : 'pausiert.'), flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'logs') {
      const { listRecentTriggers, getHoneypotStats } = require('../../modules/honeypot/statsService');
      const limit = Math.max(1, Math.min(25, interaction.options.getInteger('limit') || 10));
      const user = interaction.options.getUser('user');
      const stats = await getHoneypotStats(guildId, { recentLimit: limit }).catch(() => null);
      let rows = await listRecentTriggers(guildId, limit).catch(() => []);
      if (user) rows = rows.filter((r) => String(r.user_id || '') === user.id);
      if (!rows.length) { await interaction.followUp({ content: 'Keine Treffer' + (user ? (' fuer ' + user.tag) : '') + ' (aktiv: ' + (stats?.active ?? '?') + ', gesamt: ' + (stats?.total ?? '?') + ').', flags: MessageFlags.Ephemeral }); return; }
      const lines = rows.slice(0, limit).map((t) => '- <@' + (t.user_id || '?') + '> in <#' + (t.channel_id || '?') + '> | ' + (t.action || t.action_taken || 'log_only') + ' | ' + (t.created_at ? ('<t:' + Math.floor(new Date(t.created_at).getTime() / 1000) + ':R>') : ''));
      const head = 'Honeypot-Logs (' + rows.length + (stats ? (', aktiv: ' + stats.active + ', heute: ' + stats.today) : '') + '):';
      await interaction.followUp({ content: (head + '\n' + lines.join('\n')).slice(0, 2000), flags: MessageFlags.Ephemeral });
      try { await logAudit({ guildId, actorId: interaction.user.id, action: 'honeypot.logs_view', details: { limit } }).catch(() => {}); } catch {}
      return;
    }
    throw new Error('Unbekannter Subcommand.');
  } catch (err) {
    logger.child('command:honeypot').warn('failed', guildId, err.message);
    await interaction.followUp({ content: 'Fehlgeschlagen: ' + String(err.message).slice(0, 500), flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}
module.exports = { data, execute, toJSON: () => data, name: data.name };
