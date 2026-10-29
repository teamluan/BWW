// BWW Phase 4 – /honeypot-list (Übersicht, 04_HONEYPOT.md Kap. Dashboard).
// Loader-Format: { data, execute, toJSON, name }. Permissions: Administrator.

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'honeypot-list',
  description: 'Listet alle Honeypots (aktiv/deaktiviert, Treffer).',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
};

async function execute(interaction, client) {
  const { listHoneypots } = require('../../modules/honeypot/honeypotService');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Nur Administratoren.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const all = await listHoneypots(interaction.guildId);
    if (!all.length) { await interaction.followUp({ content: 'Keine Honeypots angelegt. Mit /honeypot-create starten.', flags: MessageFlags.Ephemeral }); return; }
    const NL = String.fromCharCode(10);
    const lines = all.slice(0, 20).map((h) => {
      const state = h.enabled ? 'aktiv' : 'pausiert';
      return '- ' + (h.name || h.id) + ' in <#' + (h.channel_id || '?') + '> | ' + h.action + ' | ' + state + ' | Hits: ' + (h.hit_count ?? 0) + ' | ID: ' + h.id;
    });
    await interaction.followUp({ content: 'Honeypots (' + all.length + '):' + NL + lines.join(NL), flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: 'Liste fehlgeschlagen: ' + err.message, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
