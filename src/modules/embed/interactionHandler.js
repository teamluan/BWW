// BWW Phase 5 – Embed interactionCreate (Button-/Select-Interaktionen, custom_id-Routing, Modal-Submit).
// Prefixe: bww_embed_btn_*, bww_embed_select_*, bww_embed_modal_*.
// Gibt true zurueck wenn behandelt, sonst false (kein Doppel-Handling mit Ticket/Honeypot:
// nur eigene Prefixe, alles andere -> false -> Fallback Legacy).

const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { logger } = require('../../services/logger');
const { applyVariables } = require('../../services/variables');
const { cleanId } = require('../../services/validation');

const log = logger.child('embed:interactions');

async function ephemeral(interaction, content) {
  try {
    if (interaction.deferred || interaction.replied) await interaction.followUp({ content: String(content).slice(0, 2000), flags: MessageFlags.Ephemeral });
    else await interaction.reply({ content: String(content).slice(0, 2000), flags: MessageFlags.Ephemeral });
  } catch {}
}

async function findButtonByCustomId(customId, guildId) {
  try {
    const { supabaseRequest, isConfigured } = require('../../services/supabase');
    if (!isConfigured()) return null;
    const res = await supabaseRequest(`bww_embed_buttons?select=*&custom_id=eq.${encodeURIComponent(customId)}&guild_id=eq.${encodeURIComponent(cleanId(guildId))}&limit=1`, { headers: { Prefer: 'return=representation' } });
    const rows = await res.json().catch(() => []);
    return rows?.[0] || null;
  } catch { return null; }
}

async function findOptionsBySelect(customId, guildId) {
  // Select-Custom-IDs sind pro Component eindeutig; wir suchen via Component-Lookup:
  // Vereinfachung: alle Optionen des Embeds laden und nach Component mit passender Custom-ID filtern
  // ist zu teuer -> stattdessen: Component anhand data.customId finden (bww_embed_components.data->>customId).
  // Fallback: leere Liste (Antwort generisch).
  return [];
}

async function executeButtonAction(interaction, client, button) {
  const type = String(button.action_type || 'send_message');
  const data = button.action_data || {};
  const ctx = { user: interaction.user, member: interaction.member, guild: interaction.guild };
  if (type === 'send_message' || type === 'send' || type === 'custom' || type === 'none') {
    const text = applyVariables(data.content || data.text || data.message || '✅ Fertig.', ctx);
    await ephemeral(interaction, text);
    return true;
  }
  if (type === 'send_embed') {
    const targetId = data.embed_id || data.response_embed_id;
    if (!targetId) { await ephemeral(interaction, '❌ Ziel-Embed fehlt.'); return true; }
    try {
      const { getFullEmbed } = require('./embedService');
      const { toV2Data } = require('./sendService');
      const full = await getFullEmbed(targetId, interaction.guildId);
      const v2 = toV2Data(full, ctx);
      const { prepareEmbedV2 } = require('../../utils/embeds');
      const prepared = await prepareEmbedV2(v2);
      if (interaction.replied || interaction.deferred) await interaction.followUp({ components: [prepared.container], files: prepared.attachments, flags: MessageFlags.IsComponentsV2 });
      else await interaction.reply({ components: [prepared.container], files: prepared.attachments, flags: MessageFlags.IsComponentsV2 });
    } catch (e) { await ephemeral(interaction, `❌ Embed senden fehlgeschlagen: ${e.message}`); }
    return true;
  }
  if (type === 'modal_open') {
    const modal = new ModalBuilder().setCustomId(`bww_embed_modal_${button.id}`).setTitle(String(data.title || 'Eingabe').slice(0, 45));
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input').setLabel(String(data.label || 'Deine Eingabe').slice(0, 45)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1000)));
    await interaction.showModal(modal).catch(() => ephemeral(interaction, '❌ Modal konnte nicht geoeffnet werden.'));
    return true;
  }
  if (type === 'ticket_create') {
    try {
      const { createTicket } = require('../ticket/ticketService');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ticket, channel } = await createTicket(interaction.guild, interaction.user, { typeId: data.type_id || data.typeId || null });
      await interaction.followUp({ content: `✅ Ticket erstellt: ${channel}`, flags: MessageFlags.Ephemeral });
    } catch (e) { await ephemeral(interaction, `❌ Ticket fehlgeschlagen: ${e.message}`); }
    return true;
  }
  if (type === 'open_url') {
    await ephemeral(interaction, `🔗 ${data.url || ''}`.slice(0, 2000));
    return true;
  }
  if (type === 'role_add' || type === 'role_remove' || type === 'role_toggle' || type === 'role_action') {
    const roleId = cleanId(data.role_id || data.roleId || '');
    if (!roleId) { await ephemeral(interaction, '❌ Rolle fehlt.'); return true; }
    try {
      const member = interaction.member;
      const has = member?.roles?.cache?.has?.(roleId);
      if (type === 'role_add' || (type === 'role_toggle' && !has) || type === 'role_action') await member.roles.add(roleId);
      else if (type === 'role_remove' || (type === 'role_toggle' && has)) await member.roles.remove(roleId);
      await ephemeral(interaction, data.success_message || '✅ Rolle aktualisiert.');
    } catch (e) { await ephemeral(interaction, `❌ Rolle fehlgeschlagen: ${e.message}`); }
    return true;
  }
  await ephemeral(interaction, '✅ Fertig.');
  return true;
}

async function handleEmbedInteraction(interaction, client) {
  try {
    const cid = String(interaction.customId || '');
    const isButton = interaction.isButton?.() && (cid.startsWith('bww_embed_btn_') || cid.startsWith('bww_embed_section_btn_'));
    const isSelect = interaction.isStringSelectMenu?.() && cid.startsWith('bww_embed_select_');
    const isModal = interaction.isModalSubmit?.() && cid.startsWith('bww_embed_modal_');
    if (!isButton && !isSelect && !isModal) return false;
    if (!interaction.guild) { await ephemeral(interaction, '❌ Nur auf Servern verfuegbar.'); return true; }

    if (isModal) {
      const input = interaction.fields?.getTextInputValue('input') || '';
      await ephemeral(interaction, `✅ Eingabe erhalten: ${String(input).slice(0, 500)}`);
      return true;
    }
    if (isButton) {
      const button = await findButtonByCustomId(cid, interaction.guildId);
      if (!button) { await ephemeral(interaction, '✅ Button gedrueckt.'); return true; }
      return executeButtonAction(interaction, client, button);
    }
    if (isSelect) {
      const values = interaction.values || [];
      // Pro Option: eigene Response / eigenes Embed / Ticket-Erstellung (05).
      // DB-Lookup: Optionen dieser Select-Component (data.customId match) -> generisch antworten wenn DB fehlt.
      try {
        const { supabaseRequest, isConfigured } = require('../../services/supabase');
        if (isConfigured()) {
          const comps = await supabaseRequest(`bww_embed_components?select=id,data&guild_id=eq.${encodeURIComponent(cleanId(interaction.guildId))}&limit=200`, { headers: { Prefer: 'return=representation' } }).then((r) => r.json()).catch(() => []);
          let compId = null;
          for (const c of comps || []) { if (c?.data?.customId === cid || c?.data?.custom_id === cid) { compId = c.id; break; } }
          if (compId) {
            const opts = await supabaseRequest(`bww_embed_select_options?select=*&component_id=eq.${encodeURIComponent(compId)}&limit=25`, { headers: { Prefer: 'return=representation' } }).then((r) => r.json()).catch(() => []);
            const picked = (opts || []).filter((o) => values.includes(o.value));
            if (picked.length) {
              for (const o of picked) {
                const rt = String(o.response_type || 'message');
                if (rt === 'ticket') {
                  try {
                    const { createTicket } = require('../ticket/ticketService');
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    const { ticket, channel } = await createTicket(interaction.guild, interaction.user, {});
                    await interaction.followUp({ content: `✅ Ticket erstellt (${o.label}): ${channel}`, flags: MessageFlags.Ephemeral });
                    return true;
                  } catch (e) { await ephemeral(interaction, `❌ Ticket fehlgeschlagen: ${e.message}`); return true; }
                }
                if (rt === 'embed' && o.response_embed_id) {
                  try {
                    const { getFullEmbed } = require('./embedService');
                    const { toV2Data } = require('./sendService');
                    const full = await getFullEmbed(o.response_embed_id, interaction.guildId);
                    const v2 = toV2Data(full, { user: interaction.user, member: interaction.member, guild: interaction.guild });
                    const { prepareEmbedV2 } = require('../../utils/embeds');
                    const prepared = await prepareEmbedV2(v2);
                    await interaction.reply({ components: [prepared.container], files: prepared.attachments, flags: MessageFlags.IsComponentsV2 });
                    return true;
                  } catch (e) { await ephemeral(interaction, `❌ Embed fehlgeschlagen: ${e.message}`); return true; }
                }
                if (o.response_content) { await ephemeral(interaction, applyVariables(o.response_content, { user: interaction.user, member: interaction.member, guild: interaction.guild, values: values.join(', ') })); return true; }
              }
            }
          }
        }
      } catch {}
      await ephemeral(interaction, `✅ Auswahl: ${values.join(', ')}`.slice(0, 2000));
      return true;
    }
    return false;
  } catch (e) {
    log.warn('Embed-Interaction fehlgeschlagen:', e.message);
    return false;
  }
}

module.exports = { handleEmbedInteraction };
