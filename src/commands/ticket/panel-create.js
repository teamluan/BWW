// BWW Phase 3 – /ticket-panel-create (Panel erstellen, 03_TICKETS.md).
// Loader-Format: { data, execute, toJSON, name } (siehe src/loaders/commandLoader).
// Speichert in bww_ticket_panels (Felder exakt) + sendet Panel-Message mit
// Select (Typen) + Button. Permissions: Administrator oder ticket-staff.

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'ticket-panel-create',
  description: 'Erstellt ein Ticket-Panel (Select + Button).',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    { name: 'titel', description: 'Panel-Titel', type: 3, required: true },
    { name: 'beschreibung', description: 'Panel-Beschreibung', type: 3, required: false },
    { name: 'channel', description: 'Ziel-Channel für das Panel', type: 7, required: true, channel_types: [0] },
    { name: 'kategorie', description: 'Kategorie für Ticket-Kanäle', type: 7, required: false, channel_types: [4] },
    { name: 'staff-rolle', description: 'Staff-Rolle für dieses Panel', type: 8, required: false },
    { name: 'button-label', description: 'Button-Text (Standard: Ticket erstellen)', type: 3, required: false },
    { name: 'button-emoji', description: 'Button-Emoji (Standard: 🎫)', type: 3, required: false },
    { name: 'button-style', description: 'Button-Farbe', type: 3, required: false, choices: [{ name: 'Blau', value: 'primary' }, { name: 'Grau', value: 'secondary' }, { name: 'Grün', value: 'success' }, { name: 'Rot', value: 'danger' }] },
  ],
};

async function execute(interaction, client) {
  const { createPanel, listTypes, sendPanelMessage } = require('../../modules/ticket/panelService');
  const { cleanId } = require('../../services/validation');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ Nur Administratoren.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const title = interaction.options.getString('titel', true);
    const description = interaction.options.getString('beschreibung') || 'Wähle dein Anliegen';
    const channel = interaction.options.getChannel('channel', true);
    const kategorie = interaction.options.getChannel('kategorie') || null;
    const staffRolle = interaction.options.getRole('staff-rolle') || null;
    const panel = await createPanel(interaction.guildId, {
      title, description, channel_id: channel.id,
      category_id: kategorie?.id || null, staff_role_id: staffRolle?.id || null,
      button_label: interaction.options.getString('button-label') || 'Ticket erstellen',
      button_emoji: interaction.options.getString('button-emoji') || '🎫',
      button_style: interaction.options.getString('button-style') || 'primary',
    }, interaction.user.id);
    const types = await listTypes(interaction.guildId, panel.id, true).catch(() => []);
    const sent = await sendPanelMessage(client, { ...panel, channel_id: channel.id }, types);
    await interaction.followUp({ content: `✅ Panel erstellt (\`${panel.id}\`) und gesendet: ${channel} ([Nachricht](${sent.url})). Typen jetzt mit /ticket-type-add anlegen.`, flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: `❌ Panel fehlgeschlagen: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
