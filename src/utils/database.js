const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';

function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
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

module.exports = { isConfigured, upsertBotStatus, syncGuilds, markOffline };
