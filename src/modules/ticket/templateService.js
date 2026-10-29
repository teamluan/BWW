// BWW Phase 3 – Template-Service (bww_ticket_templates: name/content/enabled).
// Nutzt services (supabase, cache, variables, logger). Templates werden beim
// Ticket-Erstellen/Schließen als Antwort-Bausteine verwendet.

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { applyVariables } = require('../../services/variables');
const { TtlCache } = require('../../services/cache');
const { cleanId, clampText } = require('../../services/validation');

const log = logger.child('ticket:templates');
const cache = new TtlCache(30000, 500);

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

async function listTemplates(guildId, onlyEnabled = false) {
  const gid = cleanId(guildId);
  const key = `tpl:${gid}:${onlyEnabled}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let q = `?select=*&guild_id=eq.${encodeURIComponent(gid)}&order=name.asc`;
  if (onlyEnabled) q += '&enabled=eq.true';
  const rows = (await rest('bww_ticket_templates', q).catch((e) => { log.warn('Templates laden fehlgeschlagen:', e.message); return []; })) || [];
  cache.set(key, rows);
  return rows;
}

async function getTemplate(id, guildId = null) {
  const rows = await rest('bww_ticket_templates', `?select=*&id=eq.${encodeURIComponent(id)}${guildId ? `&guild_id=eq.${encodeURIComponent(cleanId(guildId))}` : ''}&limit=1`);
  return rows?.[0] || null;
}

async function upsertTemplate(guildId, { name, content, enabled = true }, actorId = null) {
  const gid = cleanId(guildId);
  if (!name) throw new Error('Template-Name fehlt.');
  const row = {
    guild_id: gid, name: clampText(name, 100), template_key: clampText(name, 100).toLowerCase(),
    title: clampText(name, 200), content: clampText(content || '', 8000), enabled: enabled !== false,
    updated_at: new Date().toISOString(),
  };
  const rows = await rest('bww_ticket_templates', '?on_conflict=guild_id,name', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(row),
  });
  cache.clear();
  return rows?.[0] || null;
}

async function deleteTemplate(id, guildId) {
  if (!isConfigured()) return false;
  await supabaseRequest(`bww_ticket_templates?id=eq.${encodeURIComponent(id)}&guild_id=eq.${encodeURIComponent(cleanId(guildId))}`, { method: 'DELETE' });
  cache.clear();
  return true;
}

function renderTemplate(template, context = {}) {
  return applyVariables(template?.content || '', context);
}

module.exports = { listTemplates, getTemplate, upsertTemplate, deleteTemplate, renderTemplate };
