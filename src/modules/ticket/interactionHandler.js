// BWW Phase 3 – Ticket interactionCreate (Buttons/Selects).
// Buttons: [Übernehmen] [Schließen] [Wieder öffnen] [Löschen] [Transcript].
// Select: bww_ticket_type_select -> Ticket erstellen. Panel-Button:
// bww_panel_open_<panelId> -> erstes aktives Type-Modal/Erstellung.
// Gibt true zurück wenn behandelt, sonst false (Fallback Legacy).

const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { logger } = require('../../services/logger');
const { cleanId } = require('../../services/validation');

const log = logger.child('ticket:interactions');

async function ephemeral(interaction, content) {
  try {
    if (interaction.deferred || interaction.replied) await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  } catch {}
}

function ticketIdFromCustomId(customId, prefix) {
  if (!customId?.startsWith(prefix)) return null;
  const rest = customId.slice(prefix.length + 1);
  return rest || null;
}

async function resolveTicketFromInteraction(interaction) {
  const { getTicket, getTicketByChannel } = require('./ticketService');
  const cid = interaction.customId || '';
  for (const prefix of ['bww_ticket_claim_', 'bww_ticket_close_', 'bww_ticket_reopen_', 'bww_ticket_delete_', 'bww_ticket_transcript_']) {
    const tid = ticketIdFromCustomId(cid, prefix.replace(/_$/, ''));
    if (tid) { const t = await getTicket(tid, interaction.guildId).catch(() => null); if (t) return t; }
  }
  if (interaction.channelId) return getTicketByChannel(interaction.channelId, interaction.guildId).catch(() => null);
  return null;
}

async function handleTicketInteraction(interaction, client) {
  try {
    const cid = interaction.customId || '';
    const isTicketButton = cid.startsWith('bww_ticket_') || cid.startsWith('bww_panel_open_');
    const isTypeSelect = interaction.isStringSelectMenu?.() && cid === 'bww_ticket_type_select';
    if (!isTicketButton && !isTypeSelect) return false;
    if (!interaction.guild) { await ephemeral(interaction, '❌ Nur auf Servern verfügbar.'); return true; }

    const actions = require('./actionsService');
    const { createTicket } = require('./ticketService');
    const { listTypes } = require('./panelService');

    // --- Type-Select: Ticket erstellen ---
    if (isTypeSelect) {
      const typeId = interaction.values?.[0];
      if (!typeId) { await ephemeral(interaction, '❌ Kein Anliegen gewählt.'); return true; }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const { ticket, channel } = await createTicket(interaction.guild, interaction.user, { typeId });
        const { buildTicketControls } = require('./controls');
        await channel.send(buildTicketControls(ticket)).catch(() => {});
        await interaction.followUp({ content: `✅ Ticket #${ticket.ticket_number} erstellt: ${channel}`, flags: MessageFlags.Ephemeral });
      } catch (e) { await interaction.followUp({ content: `❌ ${e.message}`, flags: MessageFlags.Ephemeral }); }
      return true;
    }

    // --- Panel-Button: erstes aktives Type nehmen oder Auswahl-Hinweis ---
    if (cid.startsWith('bww_panel_open_')) {
      const panelId = cid.replace('bww_panel_open_', '');
      const types = await listTypes(interaction.guildId, panelId === 'default' ? null : panelId, true).catch(() => []);
      if (!types.length) { await ephemeral(interaction, '❌ Keine Ticket-Typen konfiguriert.'); return true; }
      if (types.length === 1) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          const { ticket, channel } = await createTicket(interaction.guild, interaction.user, { typeId: types[0].id, panelId: panelId === 'default' ? null : panelId });
          const { buildTicketControls } = require('./controls');
          await channel.send(buildTicketControls(ticket)).catch(() => {});
          await interaction.followUp({ content: `✅ Ticket #${ticket.ticket_number} erstellt: ${channel}`, flags: MessageFlags.Ephemeral });
        } catch (e) { await interaction.followUp({ content: `❌ ${e.message}`, flags: MessageFlags.Ephemeral }); }
      } else {
        await ephemeral(interaction, `🎫 Bitte wähle oben im Panel dein Anliegen aus (${types.length} Typen verfügbar).`);
      }
      return true;
    }

    // --- Ticket-Buttons (brauchen Member für Permissions) ---
    const member = interaction.member;
    if (cid.startsWith('bww_ticket_claim_')) {
      const t = await resolveTicketFromInteraction(interaction);
      if (!t) { await ephemeral(interaction, '❌ Ticket nicht gefunden.'); return true; }
      try {
        const claimed = t.claimed_by && t.claimed_by !== member.id;
        const res = t.claimed_by === member.id ? await actions.unclaimTicket(client, t.id, member) : await actions.claimTicket(client, t.id, member);
        await interaction.reply({ content: t.claimed_by === member.id ? '✅ Ticket freigegeben.' : `✅ Ticket übernommen von <@${member.id}>.`, flags: MessageFlags.Ephemeral }).catch(() => ephemeral(interaction, '✅ Fertig.'));
        await refreshControls(client, res?.id || t.id);
      } catch (e) { await ephemeral(interaction, `❌ ${e.message}`); }
      return true;
    }
    if (cid.startsWith('bww_ticket_close_')) {
      const t = await resolveTicketFromInteraction(interaction);
      if (!t) { await ephemeral(interaction, '❌ Ticket nicht gefunden.'); return true; }
      const modal = new ModalBuilder().setCustomId(`bww_ticket_close_modal_${t.id}`).setTitle('Ticket schließen')
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Grund').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000)));
      await interaction.showModal(modal).catch(() => ephemeral(interaction, '❌ Modal konnte nicht geöffnet werden.'));
      return true;
    }
    if (interaction.isModalSubmit?.() && cid.startsWith('bww_ticket_close_modal_')) {
      const tid = cid.replace('bww_ticket_close_modal_', '');
      const reason = interaction.fields?.getTextInputValue('reason') || 'Kein Grund angegeben';
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await actions.closeTicket(client, tid, member, reason);
        await interaction.followUp({ content: '🔒 Ticket geschlossen.', flags: MessageFlags.Ephemeral });
      } catch (e) { await interaction.followUp({ content: `❌ ${e.message}`, flags: MessageFlags.Ephemeral }); }
      return true;
    }
    if (cid.startsWith('bww_ticket_reopen_')) {
      const t = await resolveTicketFromInteraction(interaction);
      if (!t) { await ephemeral(interaction, '❌ Ticket nicht gefunden.'); return true; }
      try { await actions.reopenTicket(client, t.id, member); await ephemeral(interaction, '🔓 Ticket wieder geöffnet.'); await refreshControls(client, t.id); }
      catch (e) { await ephemeral(interaction, `❌ ${e.message}`); }
      return true;
    }
    if (cid.startsWith('bww_ticket_delete_')) {
      const t = await resolveTicketFromInteraction(interaction);
      if (!t) { await ephemeral(interaction, '❌ Ticket nicht gefunden.'); return true; }
      try { await actions.deleteTicket(client, t.id, member, { deleteChannel: true }); await ephemeral(interaction, '🗑️ Ticket gelöscht.'); }
      catch (e) { await ephemeral(interaction, `❌ ${e.message}`); }
      return true;
    }
    if (cid.startsWith('bww_ticket_transcript_')) {
      const t = await resolveTicketFromInteraction(interaction);
      if (!t) { await ephemeral(interaction, '❌ Ticket nicht gefunden.'); return true; }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const { createTranscript } = require('./transcriptService');
        const full = await require('./ticketService').getTicket(t.id, interaction.guildId);
        const res = await createTranscript(client, full || t);
        await interaction.followUp({ content: `📄 Transcript erstellt (${res.messages} Nachrichten): \`${res.url}\``, flags: MessageFlags.Ephemeral });
      } catch (e) { await interaction.followUp({ content: `❌ ${e.message}`, flags: MessageFlags.Ephemeral }); }
      return true;
    }
    return false;
  } catch (e) {
    log.warn('Ticket-Interaction fehlgeschlagen:', e.message);
    return false;
  }
}

async function refreshControls(client, ticketId) {
  try {
    const { getTicket } = require('./ticketService');
    const { buildTicketControls } = require('./controls');
    const t = await getTicket(ticketId);
    if (!t?.channel_id) return;
    const channel = await client.channels.fetch(t.channel_id).catch(() => null);
    if (!channel?.isTextBased()) return;
    await channel.send({ ...buildTicketControls(t) }).catch(() => {});
  } catch {}
}

module.exports = { handleTicketInteraction };
