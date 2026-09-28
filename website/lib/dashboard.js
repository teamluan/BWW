import crypto from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'bww_dashboard_session';
const SESSION_SECRET = process.env.BWW_DASHBOARD_SECRET || '';
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';

export const DEFAULT_SETTINGS = {
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
  permissions: {}
};

function mergeSettings(value) {
  const parsed = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    welcome: { ...DEFAULT_SETTINGS.welcome, ...(parsed.welcome || {}) },
    verify: { ...DEFAULT_SETTINGS.verify, ...(parsed.verify || {}) },
    ticket: { ...DEFAULT_SETTINGS.ticket, ...(parsed.ticket || {}) },
    status: {
      ...DEFAULT_SETTINGS.status,
      ...(parsed.status || {}),
      mode: ['online', 'offline', 'maintenance'].includes(parsed.status?.mode)
        ? parsed.status.mode
        : DEFAULT_SETTINGS.status.mode
    },
    permissions: parsed.permissions && typeof parsed.permissions === 'object' && !Array.isArray(parsed.permissions)
      ? Object.fromEntries(
          Object.entries(parsed.permissions).map(([name, roles]) => [
            name,
            Array.isArray(roles) ? roles.filter((id) => typeof id === 'string').slice(0, 25) : []
          ])
        )
      : {}
  };
}

export function configured() {
  return Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY && SESSION_SECRET);
}

async function dbRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('Supabase Website-Konfiguration fehlt.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return response;
}

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

function encodeSession(payload) {
  const body = Buffer.from(payload, 'utf8').toString('base64url');
  return `${body}.${sign(body)}`;
}

function decodeSession(value) {
  if (!value || !SESSION_SECRET) return null;
  const [body, signature] = String(value).split('.');
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const payload = Buffer.from(body, 'base64url').toString('utf8');
  const [id, guildId, expiresAt] = payload.split('|');
  if (!id || !guildId || !expiresAt || Date.now() >= Number(expiresAt)) return null;
  return { id, guildId, expiresAt: Number(expiresAt) };
}

export async function setDashboardSession(id, guildId, expiresAt) {
  const cookieStore = await cookies();
  const maxAge = Math.max(60, Math.floor((Number(expiresAt) - Date.now()) / 1000));
  cookieStore.set(COOKIE_NAME, encodeSession(`${id}|${guildId}|${Number(expiresAt)}`), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge
  });
}

export async function clearDashboardSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function getDashboardSession() {
  if (!SESSION_SECRET || !SUPABASE_URL || !SUPABASE_SECRET_KEY) return null;
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!session) return null;

  const response = await dbRequest(
    `bww_dashboard_logins?select=id,guild_id,expires_at&id=eq.${encodeURIComponent(session.id)}&guild_id=eq.${encodeURIComponent(session.guildId)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`,
    { headers: { Prefer: 'return=representation' } }
  );
  const rows = await response.json();
  if (!rows?.length) return null;
  return session;
}

export async function getSettings(guildId) {
  const response = await dbRequest(
    `bww_guild_settings?select=settings&guild_id=eq.${encodeURIComponent(guildId)}&limit=1`,
    { headers: { Prefer: 'return=representation' } }
  );
  const rows = await response.json();
  return mergeSettings(rows?.[0]?.settings);
}

export async function saveSettings(guildId, value, updatedBy = 'website') {
  const settings = mergeSettings(value);
  await dbRequest('bww_guild_settings?on_conflict=guild_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      guild_id: guildId,
      settings,
      updated_by: String(updatedBy).slice(0, 100),
      updated_at: new Date().toISOString()
    })
  });
  return settings;
}

export async function getGuildInfo(guildId) {
  const response = await dbRequest(
    `bww_guilds?select=guild_id,name,member_count,icon_url&guild_id=eq.${encodeURIComponent(guildId)}&limit=1`,
    { headers: { Prefer: 'return=representation' } }
  );
  const rows = await response.json();
  return rows?.[0] || { guild_id: guildId, name: guildId, member_count: 0, icon_url: null };
}

export async function findDashboardCode(code) {
  const normalized = String(code || '').trim();
  if (!normalized) return null;
  const hash = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  const response = await dbRequest(
    `bww_dashboard_logins?select=id,guild_id,expires_at&code_hash=eq.${encodeURIComponent(hash)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`,
    { headers: { Prefer: 'return=representation' } }
  );
  const rows = await response.json();
  return rows?.[0] || null;
}

export async function markDashboardCodeUsed(id) {
  await dbRequest(`bww_dashboard_logins?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ used_at: new Date().toISOString() })
  });
}

export { dbRequest, encodeSession };
