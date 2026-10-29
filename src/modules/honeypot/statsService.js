// BWW Phase 4 – Stats-Service (Dashboard Übersicht, 04_HONEYPOT.md Kap. Dashboard).
// Liefert: aktive Honeypots, Treffer gesamt/heute, Aktionen, letzte Trigger.
// Single Source of Truth = Supabase. Wirft bei fehlender Config (Aufrufer faengt).

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { cleanId } = require('../../services/validation');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

function startOfTodayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function getHoneypotStats(guildId, { recentLimit = 10 } = {}) {
  const gid = cleanId(guildId);
  const [honeypots, triggers, recent] = await Promise.all([
    rest('bww_honeypots', `?select=id,enabled,status&guild_id=eq.${encodeURIComponent(gid)}&limit=200`).catch(() => []),
    rest('bww_honeypot_triggers', `?select=id,action,action_taken,created_at&guild_id=eq.${encodeURIComponent(gid)}&order=created_at.desc&limit=1000`).catch(() => []),
    rest('bww_honeypot_triggers', `?select=id,honeypot_id,guild_id,user_id,message_id,channel_id,content,action,message_url,created_at&guild_id=eq.${encodeURIComponent(gid)}&order=created_at.desc&limit=${Math.max(1, Math.min(50, recentLimit))}`).catch(() => []),
  ]);
  const active = (honeypots || []).filter((h) => h.enabled !== false && h.status !== 'inactive' && h.status !== 'archived').length;
  const list = triggers || [];
  const todayIso = startOfTodayUTC();
  const today = list.filter((t) => t.created_at && t.created_at >= todayIso).length;
  const byAction = {};
  for (const t of list) {
    const key = String(t.action || t.action_taken || 'log_only');
    byAction[key] = (byAction[key] || 0) + 1;
  }
  return {
    active,
    honeypotCount: (honeypots || []).length,
    total: list.length,
    today,
    byAction,
    recent: recent || [],
  };
}

async function listRecentTriggers(guildId, limit = 20) {
  const gid = cleanId(guildId);
  return (await rest('bww_honeypot_triggers', `?select=*&guild_id=eq.${encodeURIComponent(gid)}&order=created_at.desc&limit=${Math.max(1, Math.min(100, limit))}`)) || [];
}

module.exports = { getHoneypotStats, listRecentTriggers };
