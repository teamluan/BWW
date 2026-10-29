// BWW Phase 9 – /verification (konsolidiert: setup/enable/disable/user/reset/logs).
// Duenne Wrapper um verificationService/userService/logService/flowService.
// /verify (self) bleibt als Alias erhalten. Schreibt bww_verification* wie Dashboard.
// Phase 11: BWW-Matrix je Subcommand (user=view, reset=reset, logs=logs, Rest=manage).
// Self-Lookup (/verification user ohne Angabe = eigener Status) bleibt frei wie bisher.
// default_member_permissions bewusst entfernt (Verification Staff hat kein Discord-Aequivalent).
const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const data = {
  name: 'verification',
  description: 'Verification verwalten (Setup, User, Logs).',
  options: [
    { name: 'setup', description: 'Verification einrichten.', type: 1, options: [
      { name: 'channel', description: 'Verification-Channel', type: 7, required: false, channel_types: [0] },
      { name: 'unverified-rolle', description: 'Unverified-Rolle', type: 8, required: false },
      { name: 'verified-rolle', description: 'Verified-Rolle', type: 8, required: false },
      { name: 'methode', description: 'Methode', type: 3, required: false, choices: [{ name: 'Button (1-Klick)', value: 'button' }, { name: 'Code (6-stellig)', value: 'code' }, { name: 'Captcha (Mathe)', value: 'captcha' }] },
      { name: 'code-gueltigkeit', description: 'Code-Gueltigkeit Minuten (1-1440)', type: 4, required: false, min_value: 1, max_value: 1440 },
      { name: 'log-channel', description: 'Log-Channel', type: 7, required: false, channel_types: [0] },
      { name: 'max-versuche', description: 'Max Fehlversuche (1-100)', type: 4, required: false, min_value: 1, max_value: 100 },
      { name: 'aktiv', description: 'Aktivieren?', type: 5, required: false },
      { name: 'panel', description: 'Panel sofort senden?', type: 5, required: false },
    ]},
    { name: 'enable', description: 'Verification aktivieren.', type: 1 },
    { name: 'disable', description: 'Verification deaktivieren.', type: 1 },
    { name: 'user', description: 'Status eines Users anzeigen.', type: 1, options: [{ name: 'user', description: 'Benutzer (Standard: du)', type: 6, required: false }] },
    { name: 'reset', description: 'Verification eines Users zuruecksetzen.', type: 1, options: [{ name: 'user', description: 'Benutzer', type: 6, required: true }] },
    { name: 'logs', description: 'Verification-Logs anzeigen.', type: 1, options: [{ name: 'user', description: 'Filter: Benutzer', type: 6, required: false }, { name: 'limit', description: 'Anzahl (1-50)', type: 4, required: false, min_value: 1, max_value: 50 }] },
  ],
};
// Phase 11: Matrix-Permission je Subcommand (11_PERMISSIONS: view/manage/reset/logs).
function requiredPermission(sub) {
  const map = { setup: 'verification.manage', enable: 'verification.manage', disable: 'verification.manage', user: 'verification.view', reset: 'verification.reset', logs: 'verification.logs' };
  return map[sub] || 'verification.manage';
}
async function execute(interaction, client) {
  if (!interaction.guildId || !interaction.guild) { await interaction.reply({ content: 'Nur auf Servern.', flags: MessageFlags.Ephemeral }).catch(() => {}); return; }
  const { requireGuildId, cleanId } = require('../../services/validation');
  let guildId; try { guildId = requireGuildId(interaction.guildId); } catch { await interaction.reply({ content: 'Ungueltige Guild-ID.', flags: MessageFlags.Ephemeral }).catch(() => {}); return; }
  const sub = interaction.options.getSubcommand(true);
  const isSelfUser = sub === 'user' && !(interaction.options.getUser('user'));
  // Phase 11: BWW-Matrix (Guild -> Mapping/Discord-Fallback -> Permission -> Action), Legacy-Fallback inklusive.
  if (!isSelfUser) {
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
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
  const { logger } = require('../../services/logger');
  try {
    const mod = require('../../modules/verification');
    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const uv = interaction.options.getRole('unverified-rolle');
      const vf = interaction.options.getRole('verified-rolle');
      const logCh = interaction.options.getChannel('log-channel');
      const saved = await mod.upsertVerificationConfig(guildId, {
        verification_channel_id: channel?.id ?? undefined,
        unverified_role_id: uv?.id ?? undefined,
        verified_role_id: vf?.id ?? undefined,
        verification_role_id: vf?.id ?? undefined,
        method: interaction.options.getString('methode') ?? undefined,
        code_validity_minutes: interaction.options.getInteger('code-gueltigkeit') ?? undefined,
        log_channel_id: logCh?.id ?? undefined,
        max_attempts: interaction.options.getInteger('max-versuche') ?? undefined,
        enabled: interaction.options.getBoolean('aktiv') ?? true,
      }, interaction.user.id);
      let hint = '';
      if (interaction.options.getBoolean('panel')) {
        try { await mod.ensureVerificationPanel(client, guildId, channel?.id || saved.verification_channel_id); hint = ' Panel gesendet.'; } catch (e) { hint = ' Panel fehlgeschlagen: ' + e.message; }
      }
      await interaction.followUp({ content: ('Verification gespeichert: ' + (saved.enabled ? 'aktiv' : 'pausiert') + ' (Methode: ' + saved.method + ').' + hint).slice(0, 2000), flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'enable' || sub === 'disable') {
      const updated = await mod.setEnabled(guildId, sub === 'enable', interaction.user.id);
      await interaction.followUp({ content: 'Verification ist jetzt ' + (updated.enabled ? 'aktiv.' : 'pausiert.'), flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'user') {
      const target = interaction.options.getUser('user') || interaction.user;
      const st = await mod.getVerificationStatus(guildId, target.id);
      const line = !st.config || st.config.enabled === false ? 'deaktiviert (alle gelten als verifiziert).' : ('Status: **' + st.status + '** ' + (st.verified ? '(verifiziert)' : '(nicht verifiziert)') + ' - Methode: ' + st.config.method);
      await interaction.followUp({ content: ('<@' + target.id + '>: ' + line).slice(0, 2000), flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'reset') {
      const user = interaction.options.getUser('user', true);
      const config = await mod.getVerificationConfig(guildId).catch(() => null);
      await mod.resetVerification(guildId, user.id);
      await mod.logVerification({ guildId, userId: user.id, action: 'reset', result: 'pending', reason: 'slash-reset', actorId: interaction.user.id }).catch(() => {});
      try {
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (member && config) {
          const vf = cleanId(config.verified_role_id || config.verification_role_id || '');
          const uv = cleanId(config.unverified_role_id || '');
          if (vf && member.roles.cache.has(vf)) await member.roles.remove(vf, 'BWW Verification Reset').catch(() => {});
          if (uv && !member.roles.cache.has(uv) && interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) await member.roles.add(uv, 'BWW Verification Reset').catch(() => {});
        }
      } catch {}
      await interaction.followUp({ content: 'Verification von <@' + user.id + '> zurueckgesetzt (pending).', flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'logs') {
      const user = interaction.options.getUser('user');
      const limit = Math.max(1, Math.min(50, interaction.options.getInteger('limit') || 20));
      const rows = await mod.listLogs(guildId, { userId: user?.id || null, limit });
      if (!rows.length) { await interaction.followUp({ content: 'Keine Logs' + (user ? (' fuer ' + user.tag) : '') + '.', flags: MessageFlags.Ephemeral }); return; }
      const lines = rows.slice(0, limit).map((r) => '- ' + (r.created_at ? ('<t:' + Math.floor(new Date(r.created_at).getTime() / 1000) + ':R> ') : '') + (r.user_id ? ('<@' + r.user_id + '> ') : '') + (r.action || '?') + (r.result ? (' (' + r.result + ')') : ''));
      await interaction.followUp({ content: ('Verification-Logs (' + rows.length + '):\n' + lines.join('\n')).slice(0, 2000), flags: MessageFlags.Ephemeral });
      return;
    }
    throw new Error('Unbekannter Subcommand.');
  } catch (err) {
    logger.child('command:verification').warn('failed', guildId, err.message);
    await interaction.followUp({ content: 'Fehlgeschlagen: ' + String(err.message).slice(0, 500), flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}
module.exports = { data, execute, toJSON: () => data, name: data.name };
