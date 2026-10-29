// BWW Phase 4 – Honeypot Interaction-Handler (Buttons, 04 + 15_FOLDER_STRUCTURE).
// Custom-IDs: bww_honeypot_toggle_<id>, bww_honeypot_delete_<id>.
// Gibt true zurück wenn behandelt. Staff-only (Administrator).

const { MessageFlags, PermissionFlagsBits } = require('discord.js');

async function handleHoneypotInteraction(interaction, client) {
  try {
    const cid = String(interaction?.customId || '');
    if (!cid.startsWith('bww_honeypot_')) return false;
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      if (interaction.isRepliable?.()) await interaction.reply({ content: 'Nur Administratoren.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }
    const { getHoneypot, setEnabled, deleteHoneypot } = require('./honeypotService');
    if (cid.startsWith('bww_honeypot_toggle_')) {
      const id = cid.replace('bww_honeypot_toggle_', '');
      const current = await getHoneypot(id, interaction.guildId).catch(() => null);
      if (!current) { await interaction.reply({ content: 'Honeypot nicht gefunden.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
      const next = !current.enabled;
      await setEnabled(id, interaction.guildId, next, interaction.user.id);
      const label = current.name || id;
      await interaction.reply({ content: next ? ('Honeypot ' + label + ' aktiviert.') : ('Honeypot ' + label + ' deaktiviert.'), flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }
    if (cid.startsWith('bww_honeypot_delete_')) {
      const id = cid.replace('bww_honeypot_delete_', '');
      const ok = await deleteHoneypot(id, interaction.guildId, interaction.user.id).catch(() => false);
      await interaction.reply({ content: ok ? ('Honeypot ' + id + ' geloescht.') : 'Loeschen fehlgeschlagen.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }
    return false;
  } catch (err) {
    try { if (interaction?.isRepliable?.() && !interaction.replied && !interaction.deferred) await interaction.reply({ content: err.message, flags: MessageFlags.Ephemeral }); } catch {}
    return true;
  }
}

module.exports = { handleHoneypotInteraction };
