// BWW Phase 5 – Send-Service (gespeichertes Embed via Slash/Dashboard an berechtigten Channel senden).
// Channel-Perm-Check (ViewChannel+SendMessages), Preview-Daten, wiederverwendbar fuer Welcome/Ticket:
// getEmbedForWelcome() liegt in embedService; renderTicketPanel() baut Ticket-Panel via Embed-Daten.
// Nutzt services (supabase, permissions, logger, audit, messageBuilder/variables, validation).

const { MessageFlags, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');
const { applyVariables } = require('../../services/variables');
const { cleanId } = require('../../services/validation');

const log = logger.child('embed:send');

function toV2Data(full, context = {}) {
  const embed = full.embed || full;
  const components = full.components || [];
  const buttons = full.buttons || [];
  const options = full.options || [];
  // Basis: gespeicherte Components (data enthaelt bereits V2-JSON); Variablen anwenden
  const mapped = components.map((c) => {
    const d = { ...(c.data || {}) };
    if (typeof d.content === 'string') d.content = applyVariables(d.content, context);
    if (Array.isArray(d.texts)) d.texts = d.texts.map((t) => applyVariables(String(t), context));
    return { type: c.component_type === 'media' ? 'media_gallery' : c.component_type, ...d };
  });
  // Separat gespeicherte Buttons/Selects als Action-Rows anhaengen (falls keine Button-Components in data)
  const hasButtonsRow = mapped.some((m) => m.type === 'buttons');
  const hasSelectRow = mapped.some((m) => m.type === 'select');
  if (buttons.length && !hasButtonsRow) {
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push({ type: 'buttons', buttons: buttons.slice(i, i + 5).map((b) => ({
        label: b.label, style: b.style || 'secondary', emoji: b.emoji || undefined,
        customId: b.custom_id, url: b.url || undefined, disabled: !!b.disabled,
      })) });
    }
    mapped.push(...rows);
  }
  if (options.length && !hasSelectRow) {
    const byComp = new Map();
    for (const o of options) {
      const key = o.component_id || '__default';
      if (!byComp.has(key)) byComp.set(key, []);
      byComp.get(key).push(o);
    }
    for (const [, opts] of byComp) {
      mapped.push({
        type: 'select', kind: 'string', customId: `bww_embed_select_${Date.now().toString(36)}`,
        placeholder: 'Bitte auswaehlen', minValues: 1, maxValues: 1,
        options: opts.slice(0, 25).map((o) => ({ label: o.label, value: o.value, description: o.description || undefined, emoji: o.emoji || undefined })),
      });
    }
  }
  if (!mapped.length) {
    if (embed.description) mapped.push({ type: 'text', content: applyVariables(embed.description, context) });
    else if (embed.title || embed.name) mapped.push({ type: 'text', content: `## ${applyVariables(embed.title || embed.name, context)}` });
  }
  return { title: embed.title || embed.name || '', description: embed.description || '', color: (embed.color || '#5865F2').replace('#', ''), components: mapped.slice(0, 40) };
}

async function getPreviewData(embedId, guildId, context = {}) {
  const { getFullEmbed } = require('./embedService');
  const full = await getFullEmbed(embedId, guildId);
  const v2 = toV2Data(full, context);
  return { embed: full.embed, components: full.components, buttons: full.buttons, options: full.options, actions: full.actions, v2, count: v2.components.length };
}

async function checkChannelPermissions(client, channelId, member = null) {
  const cid = cleanId(channelId);
  if (!cid) throw new Error('Ungueltige Channel-ID.');
  const channel = await client.channels.fetch(cid).catch(() => null);
  if (!channel?.isTextBased()) throw new Error('Channel nicht gefunden oder nicht textbasiert.');
  const me = channel.guild?.members?.me;
  if (me) {
    const perms = channel.permissionsFor?.(me);
    if (perms && (!perms.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.SendMessages))) throw new Error('Bot darf in diesem Channel nicht schreiben (ViewChannel/SendMessages fehlt).');
  }
  if (member) {
    const perms = channel.permissionsFor?.(member);
    if (perms && (!perms.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.SendMessages))) throw new Error('Du darfst in diesem Channel nicht schreiben.');
  }
  return channel;
}

async function sendEmbed(client, embedId, guildId, channelId, actorMember = null, context = {}) {
  const { getFullEmbed } = require('./embedService');
  const full = await getFullEmbed(embedId, guildId);
  if (full.embed.guild_id !== cleanId(guildId)) throw new Error('Embed gehoert zu anderem Server.');
  if (full.embed.enabled === false) throw new Error('Embed ist deaktiviert.');
  const channel = await checkChannelPermissions(client, channelId, null);
  const v2 = toV2Data(full, { guild: channel.guild, member: actorMember, user: actorMember?.user, ...context });
  const { prepareEmbedV2 } = require('../../utils/embeds');
  const prepared = await prepareEmbedV2(v2);
  const sent = await channel.send({ components: [prepared.container], files: prepared.attachments, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
  try {
    const { supabaseRequest, isConfigured } = require('../../services/supabase');
    if (isConfigured()) await supabaseRequest(`bww_embeds?id=eq.${encodeURIComponent(full.embed.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ channel_id: channel.id, message_id: sent.id, updated_at: new Date().toISOString() }) });
  } catch (e) { log.warn('Send-Message-ID speichern fehlgeschlagen:', e.message); }
  await logAudit({ guildId: full.embed.guild_id, actorId: actorMember?.id || null, action: 'embed.send', targetId: full.embed.id, details: { channel_id: channel.id, message_id: sent.id } }).catch(() => {});
  return sent;
}

// Wiederverwendbar (01_ARCHITECTURE Kap.5): Ticket -> Embed V2.
// Baut Ticket-Panel aus Embed-Daten; delegiert an Ticket-Modul wenn vorhanden, sonst Fallback-Container.
// KEINE Ticket-Logik hier (nur Rendering-Huelle).
function renderTicketPanel(embedOrFull, panel = null, types = []) {
  try {
    const ticketPanel = require('../ticket/panelService');
    if (panel && typeof ticketPanel.buildPanelMessage === 'function') return ticketPanel.buildPanelMessage(panel, types);
  } catch {}
  const name = embedOrFull?.embed?.name || embedOrFull?.name || 'Support';
  const desc = embedOrFull?.embed?.description || embedOrFull?.description || 'Waehe dein Anliegen';
  const c = new ContainerBuilder().setAccentColor(0x5865f2);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## \uD83C\uDFAB ${String(name).slice(0, 200)}\n\n${String(desc).slice(0, 2000)}`));
  return c;
}

module.exports = { toV2Data, getPreviewData, checkChannelPermissions, sendEmbed, renderTicketPanel };
