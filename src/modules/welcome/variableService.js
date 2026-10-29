// BWW Phase 6 - Variable-Service (06_WELCOME.md: Variablen).
// Standard exakt: {user} {user.id} {user.name} {user.displayName}
// {server} {server.id} {server.name} {member.count} {channel} {channel.name}
// + custom aus bww_welcome_variables (name/value/enabled).
// Ersetzt via variables/messageBuilder-Services (applyVariables), nie direkt Layout.

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { applyVariables } = require('../../services/variables');
const { cleanId, isSnowflake, clampText } = require('../../services/validation');
const { STANDARD_VARIABLES } = require('./constants');

const log = logger.child('welcome:variables');

function normalizeVariableRow(row) {
  if (!row) return null;
  const name = String(row.name || row.variable_key || '').trim();
  if (!name) return null;
  const value = row.value != null ? String(row.value) : (row.default_value != null ? String(row.default_value) : '');
  return { ...row, name, value, enabled: row.enabled !== false };
}

function placeholderFor(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  if (n.startsWith('{') && n.endsWith('}')) return n;
  return `{${n}}`;
}

function buildStandardMap(member, channel) {
  const user = member?.user || null;
  const guild = member?.guild || null;
  const userId = user?.id || member?.id || '';
  const username = user?.username || member?.displayName || '';
  const displayName = member?.displayName || username || '';
  const guildId = guild?.id || '';
  const guildName = guild?.name || '';
  const memberCount = String(guild?.memberCount ?? '');
  const channelId = channel?.id || '';
  const channelName = channel?.name || '';
  return {
    '{user}': userId ? `<@${userId}>` : '{user}',
    '{user.id}': userId || '{user.id}',
    '{user.name}': username || '{user.name}',
    '{user.displayName}': displayName || '{user.displayName}',
    '{server}': guildName || '{server}',
    '{server.id}': guildId || '{server.id}',
    '{server.name}': guildName || '{server.name}',
    '{member.count}': memberCount || '{member.count}',
    '{channel}': channelId ? `<#${channelId}>` : '{channel}',
    '{channel.name}': channelName || '{channel.name}',
  };
}

function applyStandard(text, member, channel) {
  if (text == null) return '';
  let out = String(text);
  const map = buildStandardMap(member, channel);
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of keys) out = out.split(key).join(String(map[key]));
  return out;
}

function applyCustom(text, customVars = []) {
  if (text == null) return '';
  let out = String(text);
  for (const v of customVars || []) {
    if (!v || v.enabled === false) continue;
    const ph = placeholderFor(v.name);
    if (!ph) continue;
    out = out.split(ph).join(String(v.value ?? ''));
  }
  return out;
}

function replaceVariables(text, context = {}, customVars = []) {
  if (text == null) return '';
  const member = context.member || null;
  const channel = context.channel || null;
  let out = applyStandard(String(text), member, channel);
  try {
    out = applyVariables(out, {
      user: context.user || member?.user || null,
      member,
      guild: context.guild || member?.guild || null,
    });
  } catch {}
  out = applyCustom(out, customVars);
  return out.slice(0, 4000);
}

async function listCustomVariables(guildId, opts = {}) {
  const gid = cleanId(guildId);
  if (!isSnowflake(gid)) throw new Error('Ungueltige Guild-ID.');
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  let q = `?select=*&guild_id=eq.${encodeURIComponent(gid)}&order=name.asc&limit=200`;
  if (opts.onlyEnabled) q += '&enabled=eq.true';
  const res = await supabaseRequest(`bww_welcome_variables${q}`, { headers: { Prefer: 'return=representation' } });
  const rows = await res.json();
  return (rows || []).map(normalizeVariableRow).filter(Boolean);
}

function sanitizeVariableInput(data = {}) {
  const raw = String(data.name ?? data.variable_key ?? '').trim().slice(0, 64);
  if (!raw) throw new Error('Variablen-Name fehlt.');
  const name = raw.replace(/^\{|\}$/g, '');
  if (!/^[A-Za-z0-9_.\-]+$/.test(name)) throw new Error('Ungueltiger Name (a-z, 0-9, _ . -).');
  const value = data.value !== undefined ? clampText(data.value ?? '', 2000) : clampText(data.default_value ?? '', 2000);
  return { name, value, enabled: (data.enabled ?? true) !== false };
}

async function createVariable(guildId, data = {}) {
  const gid = cleanId(guildId);
  if (!isSnowflake(gid)) throw new Error('Ungueltige Guild-ID.');
  const clean = sanitizeVariableInput(data);
  const res = await supabaseRequest('bww_welcome_variables', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ guild_id: gid, ...clean, variable_key: clean.name, default_value: clean.value }),
  });
  const rows = await res.json();
  const created = normalizeVariableRow(rows?.[0] || null);
  log.info('Welcome-Variable erstellt:', gid, clean.name);
  return created;
}

async function updateVariable(id, guildId, patch = {}) {
  const gid = cleanId(guildId);
  const body = {};
  if (patch.name !== undefined || patch.variable_key !== undefined) {
    const c = sanitizeVariableInput({ name: patch.name ?? patch.variable_key ?? 'x', value: patch.value ?? patch.default_value ?? '' });
    body.name = c.name;
    body.variable_key = c.name;
  }
  if (patch.value !== undefined || patch.default_value !== undefined) {
    body.value = clampText(patch.value ?? patch.default_value ?? '', 2000);
    body.default_value = body.value;
  }
  if (patch.enabled !== undefined) body.enabled = patch.enabled !== false;
  body.updated_at = new Date().toISOString();
  const res = await supabaseRequest(`bww_welcome_variables?id=eq.${encodeURIComponent(String(id))}&guild_id=eq.${encodeURIComponent(gid)}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body),
  });
  const rows = await res.json();
  if (!rows?.[0]) throw new Error('Variable nicht gefunden.');
  return normalizeVariableRow(rows[0]);
}

async function deleteVariable(id, guildId) {
  const gid = cleanId(guildId);
  const res = await supabaseRequest(`bww_welcome_variables?id=eq.${encodeURIComponent(String(id))}&guild_id=eq.${encodeURIComponent(gid)}`, {
    method: 'DELETE', headers: { Prefer: 'return=representation' },
  });
  const rows = await res.json().catch(() => []);
  return (rows?.length || 0) > 0;
}

module.exports = {
  STANDARD_VARIABLES,
  buildStandardMap,
  applyStandard,
  applyCustom,
  replaceVariables,
  listCustomVariables,
  createVariable,
  updateVariable,
  deleteVariable,
  normalizeVariableRow,
  placeholderFor,
};
