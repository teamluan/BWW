// BWW Phase 3 – Ticket-Controls (Buttons [Übernehmen][Schließen][Wieder öffnen]
// [Löschen][Transcript] + Priority-Select). Zentrale Builder, damit Bot-Flow
// (create) und Interaction-Refresh dieselben Custom-IDs nutzen.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { PRIORITY_META, STATUS_META } = require('./constants');

function ticketHeader(ticket) {
  const st = STATUS_META[ticket.status] || { label: ticket.status, emoji: '🎫' };
  const pr = PRIORITY_META[ticket.priority] || PRIORITY_META.normal;
  return `## 🎫 Ticket #${ticket.ticket_number ?? '-'} (${ticket.id})\n**Status:** ${st.emoji} ${st.label} · **Priorität:** ${pr.emoji} ${pr.label}\n**Ersteller:** <@${ticket.creator_id || ticket.owner_id}>${ticket.claimed_by ? ` · **Bearbeiter:** <@${ticket.claimed_by}>` : ''}${ticket.reason ? `\n**Anliegen:** ${String(ticket.reason).slice(0, 500)}` : ''}`;
}

function buildTicketControls(ticket) {
  const closed = ticket.status === 'closed' || ticket.status === 'deleted';
  const container = new ContainerBuilder().setAccentColor(ticket.priority === 'urgent' ? 0xd92d20 : 0x5865f2);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(ticketHeader(ticket)));
  if (closed) {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bww_ticket_reopen_${ticket.id}`).setLabel('Wieder öffnen').setEmoji('🔓').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`bww_ticket_transcript_${ticket.id}`).setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`bww_ticket_delete_${ticket.id}`).setLabel('Löschen').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    ));
  } else {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bww_ticket_claim_${ticket.id}`).setLabel(ticket.claimed_by ? 'Übernahme wechseln' : 'Übernehmen').setEmoji('👤').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`bww_ticket_close_${ticket.id}`).setLabel('Schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`bww_ticket_transcript_${ticket.id}`).setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`bww_ticket_delete_${ticket.id}`).setLabel('Löschen').setEmoji('🗑️').setStyle(ButtonStyle.Secondary),
    ));
    const select = new StringSelectMenuBuilder().setCustomId(`bww_ticket_priority_${ticket.id}`).setPlaceholder('Priorität ändern')
      .addOptions(Object.entries(PRIORITY_META).map(([v, m]) => new StringSelectMenuOptionBuilder().setValue(v).setLabel(m.label).setEmoji(m.emoji).setDefault(ticket.priority === v)));
    // Priority-Select wird in interactionHandler separat behandelt (Prefix bww_ticket_priority_)
    container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
  }
  return { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

module.exports = { buildTicketControls, ticketHeader };
