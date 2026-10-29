// BWW Phase 9 – /settings (Alias-Schicht zu /config, Dashboard-paritaet).
// Phase 11: BWW-Matrix (view=settings.view, set=settings.manage) statt
// Admin/ManageGuild-Hardcheck. default_member_permissions bewusst entfernt.
// Legacy-Command-Mapping bleibt als Fallback.
const { MessageFlags } = require('discord.js');
const data = {
  name: 'settings',
  description: 'Guild-Settings anzeigen/aendern (Dashboard-paritaet).',
  options: [
    { name: 'view', description: 'Settings anzeigen.', type: 1, options: [{ name: 'bereich', description: 'Bereich', type: 3, required: false, choices: [{ name: 'Ticket', value: 'ticket' }, { name: 'Honeypot', value: 'honeypot' }, { name: 'Welcome', value: 'welcome' }, { name: 'Verify', value: 'verify' }, { name: 'Permissions', value: 'permissions' }, { name: 'Status', value: 'status' }] }] },
    { name: 'set', description: 'Setting setzen.', type: 1, options: [{ name: 'bereich', description: 'Bereich', type: 3, required: true, choices: [{ name: 'Ticket', value: 'ticket' }, { name: 'Honeypot', value: 'honeypot' }, { name: 'Welcome', value: 'welcome' }, { name: 'Verify', value: 'verify' }, { name: 'Status', value: 'status' }] }, { name: 'schluessel', description: 'Schluessel', type: 3, required: true }, { name: 'wert', description: 'Wert', type: 3, required: true }] },
  ],
};
async function execute(interaction, client) {
  if (!interaction.guildId || !interaction.guild) { await interaction.reply({ content: 'Nur auf Servern.', flags: MessageFlags.Ephemeral }).catch(() => {}); return; }
  const { requireGuildId, clampText } = require('../../services/validation');
  let guildId; try { guildId = requireGuildId(interaction.guildId); } catch { await interaction.reply({ content: 'Ungueltige Guild-ID.', flags: MessageFlags.Ephemeral }).catch(() => {}); return; }
  const { getGuildSettings, saveGuildSettings } = require('../../utils/database');
  const settings = await getGuildSettings(guildId).catch(() => null);
  const sub = interaction.options.getSubcommand(true);
  // Phase 11: BWW-Matrix (view=settings.view, set=settings.manage), Legacy-Fallback inklusive.
  try {
    const { requirePermission, loadGuildRoleMappings } = require('../../services/permissions');
    const guildRoles = await loadGuildRoleMappings(guildId).catch(() => []);
    await requirePermission(interaction.member, sub === 'view' ? 'settings.view' : 'settings.manage', { guildId, guildRoles, settings });
  } catch {
    await interaction.reply({ content: 'Keine Berechtigung (settings.' + (sub === 'view' ? 'view' : 'manage') + ').', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
  try {
    const parse = (raw) => { const v = String(raw ?? '').trim(); if (/^(true|an|on|1)$/i.test(v)) return true; if (/^(false|aus|off|0)$/i.test(v)) return false; if (/^\d+$/.test(v) && Number(v) < 1000000) return Number(v); return v.slice(0, 500); };
    if (sub === 'view') {
      const bereich = interaction.options.getString('bereich');
      const cfg = settings || await getGuildSettings(guildId);
      const out = bereich ? (cfg?.[bereich] ?? {}) : { ticket: cfg?.ticket, honeypot: cfg?.honeypot, welcome: cfg?.welcome, verify: cfg?.verify, status: cfg?.status };
      await interaction.followUp({ content: ('```json\n' + JSON.stringify(out, null, 2).slice(0, 1500) + '\n```').slice(0, 2000), flags: MessageFlags.Ephemeral });
      return;
    }
    const bereich = interaction.options.getString('bereich', true);
    const schluessel = clampText(interaction.options.getString('schluessel', true), 64).replace(/[^a-zA-Z0-9_\-]/g, '');
    if (!schluessel) throw new Error('Ungueltiger Schluessel.');
    const cfg = { ...(settings || await getGuildSettings(guildId)) };
    cfg[bereich] = { ...(cfg[bereich] || {}), [schluessel]: parse(interaction.options.getString('wert', true)) };
    await saveGuildSettings(guildId, cfg, interaction.user.id);
    try { const { logAudit } = require('../../services/audit'); await logAudit({ guildId, actorId: interaction.user.id, action: 'settings.update', targetId: bereich, details: { key: schluessel, via: 'settings' } }).catch(() => {}); } catch {}
    await interaction.followUp({ content: 'Gespeichert: `' + bereich + '.' + schluessel + '` (bww_guild_settings).', flags: MessageFlags.Ephemeral });
  } catch (err) { await interaction.followUp({ content: '/settings fehlgeschlagen: ' + String(err.message).slice(0, 500), flags: MessageFlags.Ephemeral }).catch(() => {}); }
}
module.exports = { data, execute, toJSON: () => data, name: data.name };
