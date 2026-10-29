// BWW Phase 3 – Panel-Service (03_TICKETS.md: Panel + Typen).
// Tabellen exakt: bww_ticket_panels(channel_id/message_id/title/description/
// button_label/button_emoji(button_emoji)/button_style/category/staff/enabled),
// bww_ticket_types(name/emoji/color + category_id/staff_role_id pro Typ).
// Nutzt NUR src/services (supabase, logger, audit, validation, cache).

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');
const { cleanId, clampText } = require('../../services/validation');
const { TtlCache } = require('../../services/cache');
const { BUTTON_STYLES } = require('./constants');

const log = logger.child('ticket:panel');
const panelCache = new TtlCache(10000, 500);

function styleToDiscord(style) {
  switch (String(style || 'primary').toLowerCase()) {
    case 'secondary': return ButtonStyle.Secondary;
    case 'success': return ButtonStyle.Success;
    case 'danger': return ButtonStyle.Danger;
    default: return ButtonStyle.Primary;
  }
}

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, {
    ...options,
    headers: { Prefer: 'return=representation', ...(options.headers || {}) },
  });
  return res.json();
}

async function createPanel(guildId, data = {}, actorId = null) {
  const gid = cleanId(guildId);
  if (!gid) throw new Error('Ungültige Guild-ID.');
  const row = {
    guild_id: gid,
    panel_key: clampText(data.panel_key || data.key || 'default', 64).toLowerCase().replace(/[^a-z0-9-_]/g, '-') || 'default',
    channel_id: data.channel_id ? cleanId(data.channel_id) || null : null,
    message_id: data.message_id ? cleanId(data.message_id) || null : null,
    title: clampText(data.title || 'Support', 256),
    description: data.description ? clampText(data.description, 2000) : null,
    button_label: clampText(data.button_label || data.buttonLabel || 'Ticket erstellen', 80),
    button_emoji: clampText(data.button_emoji || data.buttonEmoji || '🎫', 32),
    button_style: BUTTON_STYLES.includes(String(data.button_style || data.buttonStyle || 'primary').toLowerCase()) ? String(data.button_style || data.buttonStyle || 'primary').toLowerCase() : 'primary',
    category_id: data.category_id || data.categoryId ? cleanId(data.category_id || data.categoryId) || null : null,
    staff_role_id: data.staff_role_id || data.staffRoleId ? cleanId(data.staff_role_id || data.staffRoleId) || null : null,
    status: 'active',
    enabled: data.enabled !== false,
  };
  const rows = await rest('bww_ticket_panels', '', { method: 'POST', body: JSON.stringify(row) });
  const created = rows?.[0] || null;
  panelCache.clear();
  if (created) await logAudit({ guildId: gid, actorId, action: 'ticket.panel.create', targetId: created.id, details: { panel_key: row.panel_key } }).catch(() => {});
  return created;
}

async function listPanels(guildId, onlyEnabled = false) {
  const gid = cleanId(guildId);
  const key = `panels:${gid}:${onlyEnabled}`;
  const hit = panelCache.get(key);
  if (hit) return hit;
  let q = `?select=*&guild_id=eq.${encodeURIComponent(gid)}&order=created_at.asc`;
  if (onlyEnabled) q += '&enabled=eq.true';
  const rows = await rest('bww_ticket_panels', q);
  panelCache.set(key, rows || []);
  return rows || [];
}

async function getPanelById(id, guildId = null) {
  const rows = await rest('bww_ticket_panels', `?select=*&id=eq.${encodeURIComponent(id)}${guildId ? `&guild_id=eq.${encodeURIComponent(cleanId(guildId))}` : ''}&limit=1`);
  return rows?.[0] || null;
}

async function updatePanelMessage(panelId, channelId, messageId) {
  const rows = await rest('bww_ticket_panels', `?id=eq.${encodeURIComponent(panelId)}`, {
    method: 'PATCH', body: JSON.stringify({ channel_id: channelId, message_id: messageId, updated_at: new Date().toISOString() }),
  });
  panelCache.clear();
  return rows?.[0] || null;
}

async function createType(guildId, data = {}, actorId = null) {
  const gid = cleanId(guildId);
  if (!gid) throw new Error('Ungültige Guild-ID.');
  if (!data.name) throw new Error('Typ-Name fehlt.');
  const row = {
    guild_id: gid,
    panel_id: data.panel_id || data.panelId || null,
    type_key: clampText(data.type_key || data.key || data.name, 64).toLowerCase().replace(/[^a-z0-9-_]/g, '-') || 'default',
    name: clampText(data.name, 100),
    description: data.description ? clampText(data.description, 1000) : null,
    emoji: data.emoji ? clampText(data.emoji, 32) : '🎫',
    category_id: data.category_id || data.categoryId ? cleanId(data.category_id || data.categoryId) || null : null,
    staff_role_id: data.staff_role_id || data.staffRoleId ? cleanId(data.staff_role_id || data.staffRoleId) || null : null,
    color: /^#[0-9a-f]{6}$/i.test(String(data.color || '')) ? String(data.color) : '#5865F2',
    enabled: data.enabled !== false,
    is_active: data.enabled !== false,
  };
  const rows = await rest('bww_ticket_types', '', { method: 'POST', body: JSON.stringify(row) });
  const created = rows?.[0] || null;
  panelCache.clear();
  if (created) await logAudit({ guildId: gid, actorId, action: 'ticket.type.create', targetId: created.id, details: { name: row.name } }).catch(() => {});
  return created;
}

async function listTypes(guildId, panelId = null, onlyEnabled = false) {
  const gid = cleanId(guildId);
  let q = `?select=*&guild_id=eq.${encodeURIComponent(gid)}&order=name.asc`;
  if (panelId) q += `&panel_id=eq.${encodeURIComponent(panelId)}`;
  if (onlyEnabled) q += '&enabled=eq.true';
  return (await rest('bww_ticket_types', q)) || [];
}

async function getTypeById(id, guildId = null) {
  const rows = await rest('bww_ticket_types', `?select=*&id=eq.${encodeURIComponent(id)}${guildId ? `&guild_id=eq.${encodeURIComponent(cleanId(guildId))}` : ''}&limit=1`);
  return rows?.[0] || null;
}

// Panel-Message mit Select (Typen) + Button (03: Technischer Support etc.).
function buildPanelMessage(panel, types = []) {
  const title = panel?.title || 'Support';
  const desc = panel?.description || 'Wähle dein Anliegen';
  const container = new ContainerBuilder().setAccentColor(0x5865f2);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎫 ${title}\n\n${desc}`));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  const active = (types || []).filter((t) => t.enabled !== false && t.is_active !== false).slice(0, 25);
  if (active.length) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('bww_ticket_type_select')
      .setPlaceholder('🎫 Anliegen auswählen')
      .addOptions(active.map((t) => new StringSelectMenuOptionBuilder()
        .setLabel(String(t.name).slice(0, 100))
        .setValue(String(t.id).slice(0, 100))
        .setEmoji(t.emoji ? { name: String(t.emoji).slice(0, 32) } : undefined)
        .setDescription(String(t.description || t.name).slice(0, 100))));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
  }
  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bww_panel_open_${panel?.id || 'default'}`)
      .setLabel(String(panel?.button_label || 'Ticket erstellen').slice(0, 80))
      .setEmoji(panel?.button_emoji ? String(panel.button_emoji).slice(0, 32) : undefined)
      .setStyle(styleToDiscord(panel?.button_style)),
  ));
  return container;
}

async function sendPanelMessage(client, panel, types = []) {
  const channelId = cleanId(panel?.channel_id);
  if (!channelId) throw new Error('Panel hat keinen Channel.');
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) throw new Error('Panel-Channel nicht gefunden.');
  const container = buildPanelMessage(panel, types);
  const sent = await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
  await updatePanelMessage(panel.id, channelId, sent.id).catch((e) => log.warn('Panel-Message-ID speichern fehlgeschlagen:', e.message));
  return sent;
}

module.exports = { createPanel, listPanels, getPanelById, updatePanelMessage, createType, listTypes, getTypeById, buildPanelMessage, sendPanelMessage };
