const crypto = require('crypto');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';

const DEFAULT_SETTINGS = Object.freeze({
  welcome: {
    enabled: false,
    channelId: '',
    title: '',
    message: 'Willkommen {user} auf dem Server! 🎉'
  },
  verify: {
    enabled: false,
    channelId: '',
    message: 'Klicke auf den Button, um dich zu verifizieren.',
    roleId: ''
  },
  ticket: {
    enabled: false,
    categoryId: '',
    roleId: ''
  },
  status: {
    enabled: false,
    channelId: '',
    messageId: '',
    mode: 'online'
  },
  honeypot: {
    enabled: false,
    channelId: '',
    logChannelId: '',
    punishment: 'none',
    timeoutMinutes: 10,
    deleteMessage: true,
    ignoreAdmins: true,
    exemptRoleIds: []
  },
  permissions: {}
});

const settingsCache = new Map();

function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function mergeSettings(value) {
  const parsed = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    welcome: { ...DEFAULT_SETTINGS.welcome, ...(parsed.welcome || {}) },
    verify: { ...DEFAULT_SETTINGS.verify, ...(parsed.verify || {}) },
    ticket: { ...DEFAULT_SETTINGS.ticket, ...(parsed.ticket || {}) },
    status: { ...DEFAULT_SETTINGS.status, ...(parsed.status || {}) },
    honeypot: {
      ...DEFAULT_SETTINGS.honeypot,
      ...(parsed.honeypot || {}),
      exemptRoleIds: Array.isArray(parsed.honeypot?.exemptRoleIds)
        ? [...new Set(parsed.honeypot.exemptRoleIds.map((id) => String(id).replace(/\D/g, '')).filter(Boolean))].slice(0, 25)
        : []
    },
    permissions: parsed.permissions && typeof parsed.permissions === 'object' && !Array.isArray(parsed.permissions)
      ? Object.fromEntries(Object.entries(parsed.permissions).map(([key, roles]) => [
          key,
          Array.isArray(roles) ? roles.filter((id) => typeof id === 'string') : []
        ]))
      : {}
  };
}

async function supabaseRequest(path, options = {}) {
  if (!isConfigured()) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    throw new Error(`Supabase HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }
  return response;
}

async function getGuildSettings(guildId) {
  if (!guildId) return cloneDefaults();
  const cached = settingsCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) return cached.settings;

  if (!isConfigured()) return cloneDefaults();

  const response = await supabaseRequest(
    `bww_guild_settings?select=settings&guild_id=eq.${encodeURIComponent(guildId)}&limit=1`,
    { headers: { Prefer: 'return=representation' } }
  );
  const rows = response ? await response.json() : [];
  const settings = mergeSettings(rows?.[0]?.settings);
  settingsCache.set(guildId, { settings, expiresAt: Date.now() + 5000 });
  return settings;
}

async function saveGuildSettings(guildId, settings, updatedBy = null) {
  if (!guildId) throw new Error('guildId fehlt.');
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');

  const normalized = mergeSettings(settings);
  await supabaseRequest('bww_guild_settings?on_conflict=guild_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      guild_id: guildId,
      settings: normalized,
      updated_by: updatedBy ? String(updatedBy).slice(0, 100) : null,
      updated_at: new Date().toISOString()
    })
  });

  settingsCache.set(guildId, { settings: normalized, expiresAt: Date.now() + 5000 });
  return normalized;
}

async function patchGuildSettings(guildId, patch, updatedBy = null) {
  const current = await getGuildSettings(guildId);
  const next = mergeSettings({
    ...current,
    ...patch,
    welcome: { ...current.welcome, ...(patch?.welcome || {}) },
    verify: { ...current.verify, ...(patch?.verify || {}) },
    ticket: { ...current.ticket, ...(patch?.ticket || {}) },
    status: { ...current.status, ...(patch?.status || {}) },
    permissions: { ...current.permissions, ...(patch?.permissions || {}) }
  });
  return saveGuildSettings(guildId, next, updatedBy);
}

function hashDashboardCode(code) {
  return crypto.createHash('sha256').update(String(code), 'utf8').digest('hex');
}

async function createDashboardCode(guildId, createdBy = null, ttlMinutes = 60) {
  if (!guildId) throw new Error('guildId fehlt.');
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');

  const code = crypto.randomBytes(6).toString('base64url').toUpperCase();
  const codeHash = hashDashboardCode(code);
  const expiresAt = new Date(Date.now() + Math.max(5, ttlMinutes) * 60 * 1000).toISOString();

  await supabaseRequest(`bww_dashboard_logins?guild_id=eq.${encodeURIComponent(guildId)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ expires_at: new Date().toISOString() })
  });

  await supabaseRequest('bww_dashboard_logins', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      guild_id: guildId,
      code_hash: codeHash,
      expires_at: expiresAt,
      created_by: createdBy ? String(createdBy).slice(0, 100) : null
    })
  });

  return { code, expiresAt };
}

async function upsertBotStatus(client, status = 'online') {
  if (!isConfigured()) return;
  const guilds = [...client.guilds.cache.values()];
  const memberCount = guilds.reduce((sum, guild) => sum + (guild.memberCount || 0), 0);
  await supabaseRequest('bww_bot_status?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: 'primary',
      bot_user_id: client.user?.id || null,
      bot_tag: client.user?.tag || null,
      guild_count: guilds.length,
      member_count: memberCount,
      ping_ms: Number.isFinite(client.ws.ping) ? client.ws.ping : null,
      uptime_seconds: Math.max(0, Math.floor((client.uptime || 0) / 1000)),
      status,
      updated_at: new Date().toISOString()
    })
  });
}

async function syncGuilds(client) {
  if (!isConfigured()) return;
  const rows = [...client.guilds.cache.values()].map((guild) => ({
    guild_id: guild.id,
    name: String(guild.name || 'Unbekannt').slice(0, 200),
    member_count: Math.max(0, guild.memberCount || 0),
    icon_url: guild.iconURL({ extension: 'png', size: 128 }) || null,
    joined_at: guild.joinedAt?.toISOString() || null,
    updated_at: new Date().toISOString()
  }));
  if (!rows.length) return;
  await supabaseRequest('bww_guilds?on_conflict=guild_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  });
}

async function markOffline(client) {
  if (!isConfigured()) return;
  await upsertBotStatus(client, 'offline');
}

async function findEmbedInteraction(guildId, customId) {
  if (!guildId || !customId || !isConfigured()) return null;
  const response = await supabaseRequest(
    `bww_embed_templates?select=id,name,data&guild_id=eq.${encodeURIComponent(guildId)}&limit=100`,
    { headers: { Prefer: 'return=representation' } }
  );
  const rows = (await response.json()) || [];
  for (const row of rows) {
    const components = Array.isArray(row.data?.components) ? row.data.components : [];
    for (const component of components) {
      if (component?.type === 'buttons') {
        const button = (component.buttons || []).find((item) => item?.customId === customId);
        if (button) return { template: row, component: button };
      }
      if (component?.type === 'select' && component.customId === customId) {
        return { template: row, component };
      }
      if (component?.type === 'section' && component.accessory?.type === 'button' && component.accessory.customId === customId) {
        return { template: row, component: component.accessory };
      }
    }
  }
  return null;
}

async function getPendingDashboardActions(limit = 10) {
  if (!isConfigured()) return [];
  const response = await supabaseRequest(
    `bww_dashboard_actions?select=id,guild_id,action,payload,status,created_by,created_at&status=eq.pending&order=created_at.asc&limit=${Math.max(1, Math.min(50, Number(limit) || 10))}`,
    { headers: { Prefer: 'return=representation' } }
  );
  return (await response.json()) || [];
}

async function claimDashboardAction(id) {
  if (!id || !isConfigured()) return null;
  const response = await supabaseRequest(
    `bww_dashboard_actions?id=eq.${encodeURIComponent(id)}&status=eq.pending`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'processing' })
    }
  );
  return (await response.json())?.[0] || null;
}

async function completeDashboardAction(id) {
  if (!id || !isConfigured()) return;
  await supabaseRequest(
    `bww_dashboard_actions?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'completed', processed_at: new Date().toISOString(), error: null })
    }
  );
}

async function failDashboardAction(id, error) {
  if (!id || !isConfigured()) return;
  await supabaseRequest(
    `bww_dashboard_actions?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'failed',
        processed_at: new Date().toISOString(),
        error: String(error || 'Unbekannter Fehler').slice(0, 1000)
      })
    }
  );
}

async function recordHoneypotEvent(guildId, event = {}) {
  if (!guildId || !isConfigured()) return null;
  const response = await supabaseRequest('bww_honeypot_events', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      guild_id: String(guildId),
      channel_id: String(event.channelId || '').replace(/\D/g, ''),
      message_id: String(event.messageId || '').replace(/\D/g, '') || null,
      user_id: String(event.userId || '').replace(/\D/g, ''),
      username: String(event.username || '').slice(0, 200) || null,
      action: 'triggered',
      punishment: ['none', 'kick', 'ban', 'timeout'].includes(String(event.punishment)) ? String(event.punishment) : 'none',
      punishment_success: typeof event.punishmentSuccess === 'boolean' ? event.punishmentSuccess : null,
      message_deleted: Boolean(event.messageDeleted),
      message_url: String(event.messageUrl || '').slice(0, 500) || null,
      error: String(event.error || '').slice(0, 500) || null
    })
  });
  return (await response.json())?.[0] || null;
}


async function getGiveaway(id, guildId = null) {
  if (!id || !isConfigured()) return null;
  const filters = [
    `id=eq.${encodeURIComponent(id)}`
  ];
  if (guildId) filters.push(`guild_id=eq.${encodeURIComponent(guildId)}`);
  const response = await supabaseRequest(
    `bww_giveaways?select=*&${filters.join('&')}&limit=1`,
    { headers: { Prefer: 'return=representation' } }
  );
  return (await response.json())?.[0] || null;
}

async function listGiveaways(guildId, limit = 100) {
  if (!guildId || !isConfigured()) return [];
  const response = await supabaseRequest(
    `bww_giveaways?select=*&guild_id=eq.${encodeURIComponent(guildId)}&order=created_at.desc&limit=${Math.max(1, Math.min(100, Number(limit) || 100))}`,
    { headers: { Prefer: 'return=representation' } }
  );
  return (await response.json()) || [];
}

async function listActiveGiveaways(limit = 100) {
  if (!isConfigured()) return [];
  const response = await supabaseRequest(
    `bww_giveaways?select=*&status=eq.active&order=end_at.asc&limit=${Math.max(1, Math.min(100, Number(limit) || 100))}`,
    { headers: { Prefer: 'return=representation' } }
  );
  return (await response.json()) || [];
}

async function createGiveawayRecord(data = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const response = await supabaseRequest('bww_giveaways', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(data)
  });
  return (await response.json())?.[0] || null;
}

async function updateGiveawayRecord(id, patch = {}) {
  if (!id || !isConfigured()) return null;
  const response = await supabaseRequest(
    `bww_giveaways?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patch)
    }
  );
  return (await response.json())?.[0] || null;
}

async function addGiveawayEntry(giveawayId, userId, entryCount = 1) {
  if (!giveawayId || !userId || !isConfigured()) throw new Error('Giveaway-/User-ID fehlt.');
  const response = await supabaseRequest('bww_giveaway_entries?on_conflict=giveaway_id,user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({
      giveaway_id: String(giveawayId),
      user_id: String(userId),
      entry_count: Math.max(1, Math.min(21, Number(entryCount) || 1))
    })
  });
  return (await response.json())?.[0] || null;
}

async function removeGiveawayEntry(giveawayId, userId) {
  if (!giveawayId || !userId || !isConfigured()) return false;
  const response = await supabaseRequest(
    `bww_giveaway_entries?giveaway_id=eq.${encodeURIComponent(giveawayId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: { Prefer: 'return=representation' } }
  );
  return (await response.json())?.length > 0;
}

async function getGiveawayEntry(giveawayId, userId) {
  if (!giveawayId || !userId || !isConfigured()) return null;
  const response = await supabaseRequest(
    `bww_giveaway_entries?select=giveaway_id,user_id,entry_count,entered_at&giveaway_id=eq.${encodeURIComponent(giveawayId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    { headers: { Prefer: 'return=representation' } }
  );
  return (await response.json())?.[0] || null;
}

async function listGiveawayEntries(giveawayId) {
  if (!giveawayId || !isConfigured()) return [];
  const response = await supabaseRequest(
    `bww_giveaway_entries?select=user_id,entry_count,entered_at&giveaway_id=eq.${encodeURIComponent(giveawayId)}&order=entered_at.asc`,
    { headers: { Prefer: 'return=representation' } }
  );
  return (await response.json()) || [];
}

async function recordGiveawayWinner(giveawayId, userId, drawType, drawNumber) {
  if (!giveawayId || !userId || !isConfigured()) return null;
  const response = await supabaseRequest('bww_giveaway_winners', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      giveaway_id: String(giveawayId),
      user_id: String(userId),
      draw_type: drawType === 'reroll' ? 'reroll' : 'initial',
      draw_number: Math.max(1, Number(drawNumber) || 1)
    })
  });
  return (await response.json())?.[0] || null;
}

async function listGiveawayWinnerHistory(giveawayId) {
  if (!giveawayId || !isConfigured()) return [];
  const response = await supabaseRequest(
    `bww_giveaway_winners?select=user_id,draw_type,draw_number,created_at&giveaway_id=eq.${encodeURIComponent(giveawayId)}&order=created_at.asc`,
    { headers: { Prefer: 'return=representation' } }
  );
  return (await response.json()) || [];
}

async function getTicket(id, guildId = null) {
  if (!id || !isConfigured()) return null;
  const filters = ['id=eq.' + encodeURIComponent(id)];
  if (guildId) filters.push('guild_id=eq.' + encodeURIComponent(guildId));
  const response = await supabaseRequest(
    'bww_tickets?select=*&' + filters.join('&') + '&limit=1',
    { headers: { Prefer: 'return=representation' } }
  );
  return (await response.json())?.[0] || null;
}

async function getTicketByChannel(channelId, guildId = null) {
  if (!channelId || !isConfigured()) return null;
  const filters = ['channel_id=eq.' + encodeURIComponent(channelId)];
  if (guildId) filters.push('guild_id=eq.' + encodeURIComponent(guildId));
  const response = await supabaseRequest(
    'bww_tickets?select=*&' + filters.join('&') + '&limit=1',
    { headers: { Prefer: 'return=representation' } }
  );
  return (await response.json())?.[0] || null;
}

async function listTickets(guildId, limit = 100, status = null) {
  if (!guildId || !isConfigured()) return [];
  const filters = ['guild_id=eq.' + encodeURIComponent(guildId)];
  if (status && ['open', 'locked', 'closed'].includes(status)) filters.push('status=eq.' + status);
  const response = await supabaseRequest(
    'bww_tickets?select=*&' + filters.join('&') + '&order=updated_at.desc&limit=' + Math.max(1, Math.min(100, Number(limit) || 100)),
    { headers: { Prefer: 'return=representation' } }
  );
  return (await response.json()) || [];
}

async function createTicketRecord(data = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const response = await supabaseRequest('bww_tickets', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(data)
  });
  return (await response.json())?.[0] || null;
}

async function updateTicketRecord(id, patch = {}) {
  if (!id || !isConfigured()) return null;
  const response = await supabaseRequest(
    'bww_tickets?id=eq.' + encodeURIComponent(id),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
    }
  );
  return (await response.json())?.[0] || null;
}

async function countOpenTickets(guildId, ownerId) {
  if (!guildId || !ownerId || !isConfigured()) return 0;
  const response = await supabaseRequest(
    'bww_tickets?select=id&guild_id=eq.' + encodeURIComponent(guildId) + '&owner_id=eq.' + encodeURIComponent(ownerId) + '&status=in.(open,locked)',
    { headers: { Prefer: 'return=representation' } }
  );
  return (await response.json())?.length || 0;
}

async function addTicketEvent(ticketId, guildId, eventType, actorId = null, targetUserId = null, details = {}) {
  if (!ticketId || !guildId || !isConfigured()) return null;
  const response = await supabaseRequest('bww_ticket_events', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      ticket_id: String(ticketId),
      guild_id: String(guildId),
      event_type: String(eventType).slice(0, 64),
      actor_id: actorId ? String(actorId) : null,
      target_user_id: targetUserId ? String(targetUserId) : null,
      details: details && typeof details === 'object' ? details : {}
    })
  });
  return (await response.json())?.[0] || null;
}

async function listTicketEvents(ticketId, limit = 100) {
  if (!ticketId || !isConfigured()) return [];
  const response = await supabaseRequest(
    'bww_ticket_events?select=id,event_type,actor_id,target_user_id,details,created_at&ticket_id=eq.' + encodeURIComponent(ticketId) + '&order=created_at.desc&limit=' + Math.max(1, Math.min(200, Number(limit) || 100)),
    { headers: { Prefer: 'return=representation' } }
  );
  return (await response.json()) || [];
}
async function getHoneypotEvents(guildId, limit = 50) {
  if (!guildId || !isConfigured()) return [];
  const response = await supabaseRequest(
    `bww_honeypot_events?select=id,channel_id,message_id,user_id,username,punishment,punishment_success,message_deleted,message_url,error,created_at&guild_id=eq.${encodeURIComponent(guildId)}&order=created_at.desc&limit=${Math.max(1, Math.min(100, Number(limit) || 50))}`,
    { headers: { Prefer: 'return=representation' } }
  );
  return (await response.json()) || [];
}

module.exports = {
  DEFAULT_SETTINGS,
  isConfigured,
  getGuildSettings,
  saveGuildSettings,
  patchGuildSettings,
  createDashboardCode,
  upsertBotStatus,
  syncGuilds,
  markOffline,
  getPendingDashboardActions,
  claimDashboardAction,
  completeDashboardAction,
  failDashboardAction,
  findEmbedInteraction,
  recordHoneypotEvent,
  getHoneypotEvents,
  getTicket,
  getTicketByChannel,
  listTickets,
  createTicketRecord,
  updateTicketRecord,
  countOpenTickets,
  addTicketEvent,
  listTicketEvents,
  getGiveaway,
  listGiveaways,
  listActiveGiveaways,
  createGiveawayRecord,
  updateGiveawayRecord,
  addGiveawayEntry,
  removeGiveawayEntry,
  getGiveawayEntry,
  listGiveawayEntries,
  recordGiveawayWinner,
  listGiveawayWinnerHistory
};
