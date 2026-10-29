// BWW Phase 7 - Giveaway-Service (CRUD, Quelle: 07_GIVEAWAYS.md).
// Felder exakt: channel_id/message_id/host_id/prize/description/winner_count/duration/ends_at/status/requirements.
// Legacy-Mapping: host_id<->created_by, ends_at<->end_at (dual write), status 'active' = 'running'.
// Nutzt NUR src/services (supabase, logger, audit, validation). Keine Verification-Logik.

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');
const { cleanId, isSnowflake, clampText } = require('../../services/validation');
const { STATUSES, PRIZE_MAX, DESCRIPTION_MAX, WINNER_MIN, WINNER_MAX, DURATION_MIN_MS, DURATION_MAX_MS, normalizeStatus } = require('./constants');

const log = logger.child('giveaway:service');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

function parseDurationToMs(input) {
  if (input == null) return null;
  if (typeof input === 'number' && Number.isFinite(input)) return input >= 1000 ? Math.floor(input) : Math.floor(input * 60000);
  const raw = String(input).trim().toLowerCase().replace(/\s+/g, '');
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw) * 60000;
  const m = raw.match(/^(\d+(?:\.\d+)?)(s|sec|m|min|h|d|w)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] || 'm';
  if (unit === 's' || unit === 'sec') return Math.floor(n * 1000);
  if (unit === 'm' || unit === 'min') return Math.floor(n * 60000);
  if (unit === 'h') return Math.floor(n * 3600000);
  if (unit === 'd') return Math.floor(n * 86400000);
  if (unit === 'w') return Math.floor(n * 7 * 86400000);
  return null;
}

function formatDurationMs(ms) {
  const totalMin = Math.max(1, Math.round(ms / 60000));
  if (totalMin < 60) return totalMin + ' Minuten';
  const h = Math.floor(totalMin / 60);
  const restMin = totalMin % 60;
  if (h < 24) return restMin ? h + ' Stunden ' + restMin + ' Minuten' : h === 1 ? '1 Stunde' : h + ' Stunden';
  const d = Math.floor(h / 24);
  const restH = h % 24;
  if (restH) return d + ' Tage ' + restH + ' Stunden';
  return d === 1 ? '1 Tag' : d + ' Tage';
}

function normalizeRow(row) {
  if (!row) return null;
  const endsAt = row.ends_at || row.end_at || null;
  const createdAt = row.created_at || new Date().toISOString();
  let duration = row.duration != null ? String(row.duration) : null;
  if (!duration && endsAt) {
    const ms = new Date(endsAt).getTime() - new Date(createdAt).getTime();
    if (Number.isFinite(ms) && ms > 0) duration = formatDurationMs(ms);
  }
  let requirements = [];
  try {
    if (Array.isArray(row.requirements)) requirements = row.requirements;
    else if (typeof row.requirements === 'string' && row.requirements) requirements = JSON.parse(row.requirements);
  } catch { requirements = []; }
  return { ...row, host_id: row.host_id || row.created_by || null, description: row.description != null ? String(row.description) : null, duration, ends_at: endsAt, end_at: row.end_at || endsAt, status: normalizeStatus(row.status), status_raw: row.status, requirements, winner_count: Math.max(1, Number(row.winner_count) || 1) };
}

async function getGiveaway(id, guildId = null) {
  const gid = String(id || '').slice(0, 200);
  if (!gid) throw new Error('Giveaway-ID fehlt.');
  let q = '?select=*&id=eq.' + encodeURIComponent(gid) + '&limit=1';
  if (guildId) q = '?select=*&id=eq.' + encodeURIComponent(gid) + '&guild_id=eq.' + encodeURIComponent(cleanId(guildId)) + '&limit=1';
  const rows = await rest('bww_giveaways', q);
  return normalizeRow(rows?.[0] || null);
}

async function listGiveaways(guildId, opts = {}) {
  const gid = cleanId(guildId);
  if (!isSnowflake(gid)) throw new Error('Ungueltige Guild-ID.');
  const safe = Math.max(1, Math.min(100, Number(opts.limit) || 50));
  let q = '?select=*&guild_id=eq.' + encodeURIComponent(gid) + '&order=created_at.desc&limit=' + safe;
  if (opts.status) {
    const s = String(opts.status).toLowerCase();
    if (s === 'active' || s === 'running') q = '?select=*&guild_id=eq.' + encodeURIComponent(gid) + '&status=in.(running,active,scheduled)&order=created_at.desc&limit=' + safe;
    else if (s === 'past' || s === 'ended') q = '?select=*&guild_id=eq.' + encodeURIComponent(gid) + '&status=in.(ended,cancelled)&order=created_at.desc&limit=' + safe;
    else q = '?select=*&guild_id=eq.' + encodeURIComponent(gid) + '&status=eq.' + encodeURIComponent(s) + '&order=created_at.desc&limit=' + safe;
  }
  const rows = await rest('bww_giveaways', q);
  return (rows || []).map(normalizeRow);
}

async function listDueGiveaways(limit = 100) {
  const safe = Math.max(1, Math.min(200, Number(limit) || 100));
  const now = new Date().toISOString();
  try {
    const rows = await rest('bww_giveaways', '?select=id,guild_id,channel_id,message_id,host_id,created_by,prize,description,winner_count,duration,ends_at,end_at,status,requirements,created_at&status=in.(running,active,scheduled)&or=(ends_at.lte.' + encodeURIComponent(now) + ',end_at.lte.' + encodeURIComponent(now) + ')&order=ends_at.asc&limit=' + safe);
    return (rows || []).map(normalizeRow);
  } catch {
    const all = await rest('bww_giveaways', '?select=*&status=in.(running,active,scheduled)&order=created_at.asc&limit=' + safe);
    return (all || []).filter((r) => { const t = r.ends_at || r.end_at; return t && new Date(t).getTime() <= Date.now(); }).map(normalizeRow);
  }
}

async function createGiveaway(input = {}) {
  const gid = cleanId(input.guildId);
  const cid = cleanId(input.channelId);
  const hid = cleanId(input.hostId || '');
  if (!isSnowflake(gid)) throw new Error('Ungueltige Guild-ID.');
  if (!isSnowflake(cid)) throw new Error('Ungueltige Channel-ID.');
  const cleanPrize = clampText(input.prize || '', PRIZE_MAX).trim();
  if (!cleanPrize) throw new Error('Preis fehlt.');
  const wc = Math.max(WINNER_MIN, Math.min(WINNER_MAX, Number(input.winnerCount) || 1));
  let endsAtIso = input.endsAt ? new Date(input.endsAt).toISOString() : null;
  let ms = input.durationMs != null ? Number(input.durationMs) : parseDurationToMs(input.duration);
  if (ms == null && endsAtIso) ms = new Date(endsAtIso).getTime() - Date.now();
  if (ms == null) throw new Error('Dauer fehlt (z. B. 10m, 1h, 24h, 7d).');
  ms = Math.max(DURATION_MIN_MS, Math.min(DURATION_MAX_MS, Math.floor(ms)));
  if (!endsAtIso || Number.isNaN(new Date(endsAtIso).getTime())) endsAtIso = new Date(Date.now() + ms).toISOString();
  const desc = input.description != null && String(input.description).trim() !== '' ? clampText(input.description, DESCRIPTION_MAX) : null;
  const reqArr = Array.isArray(input.requirements) ? input.requirements.slice(0, 25) : [];
  const id = Date.now() + '_' + require('crypto').randomUUID();
  const payload = { id, guild_id: gid, channel_id: cid, message_id: null, host_id: hid || null, created_by: hid || null, prize: cleanPrize, description: desc, winner_count: wc, duration: formatDurationMs(ms), ends_at: endsAtIso, end_at: endsAtIso, status: 'running', requirements: reqArr };
  let rows = [];
  try {
    rows = await rest('bww_giveaways', '', { method: 'POST', body: JSON.stringify(payload) });
  } catch (e) {
    const msg = String(e.message);
    if (msg.includes('host_id') || msg.includes('description') || msg.includes('requirements') || msg.includes('duration')) {
      const fb = { ...payload };
      delete fb.host_id; delete fb.description; delete fb.duration; delete fb.requirements;
      rows = await rest('bww_giveaways', '', { method: 'POST', body: JSON.stringify(fb) });
    } else throw e;
  }
  const created = normalizeRow(rows?.[0] || { ...payload });
  if (reqArr.length) {
    try { const { syncRequirements } = require('./requirementService'); await syncRequirements(created.id, gid, reqArr); }
    catch (e) { log.warn('Requirements-Sync fehlgeschlagen:', e.message); }
  }
  await logAudit({ guildId: gid, actorId: hid || null, action: 'giveaway.start', targetId: created.id, details: { prize: cleanPrize, winner_count: wc, ends_at: endsAtIso } }).catch(() => {});
  log.info('Giveaway erstellt:', created.id, cleanPrize);
  return created;
}

async function setMessageId(id, messageId, guildId = null) {
  const suffix = guildId ? '&guild_id=eq.' + encodeURIComponent(cleanId(guildId)) : '';
  const rows = await rest('bww_giveaways', '?id=eq.' + encodeURIComponent(String(id)) + suffix, { method: 'PATCH', body: JSON.stringify({ message_id: String(messageId), updated_at: new Date().toISOString() }) });
  return normalizeRow(rows?.[0] || null);
}

async function editGiveaway(id, guildId, patch = {}, actorId = null) {
  const current = await getGiveaway(id, guildId);
  if (!current) throw new Error('Giveaway nicht gefunden.');
  if (['ended', 'cancelled'].includes(current.status)) throw new Error('Beendete Giveaways koennen nicht bearbeitet werden.');
  const body = {};
  if (patch.prize !== undefined) {
    const p = clampText(patch.prize || '', PRIZE_MAX).trim();
    if (!p) throw new Error('Preis darf nicht leer sein.');
    body.prize = p;
  }
  if (patch.description !== undefined) body.description = patch.description == null || String(patch.description).trim() === '' ? null : clampText(patch.description, DESCRIPTION_MAX);
  if (patch.winner_count !== undefined || patch.winnerCount !== undefined) body.winner_count = Math.max(WINNER_MIN, Math.min(WINNER_MAX, Number(patch.winner_count ?? patch.winnerCount) || current.winner_count));
  if (patch.ends_at !== undefined || patch.endsAt !== undefined || patch.duration !== undefined || patch.durationMs !== undefined) {
    const rawEnds = patch.ends_at ?? patch.endsAt;
    const rawDur = patch.duration ?? patch.durationMs;
    if (rawEnds) {
      const iso = new Date(rawEnds).toISOString();
      if (Number.isNaN(new Date(iso).getTime())) throw new Error('Ungueltiges Enddatum.');
      body.ends_at = iso; body.end_at = iso;
      body.duration = formatDurationMs(Math.max(DURATION_MIN_MS, new Date(iso).getTime() - new Date(current.created_at).getTime()));
    } else if (rawDur != null) {
      const parsed = typeof rawDur === 'number' ? rawDur : parseDurationToMs(rawDur);
      if (parsed == null) throw new Error('Ungueltige Dauer.');
      const clamped = Math.max(DURATION_MIN_MS, Math.min(DURATION_MAX_MS, Math.floor(parsed)));
      const endIso = new Date(Date.now() + clamped).toISOString();
      body.ends_at = endIso; body.end_at = endIso; body.duration = formatDurationMs(clamped);
    }
  }
  if (patch.requirements !== undefined) {
    const arr = Array.isArray(patch.requirements) ? patch.requirements.slice(0, 25) : [];
    body.requirements = arr;
    try { const { syncRequirements } = require('./requirementService'); await syncRequirements(current.id, current.guild_id, arr); }
    catch (e) { log.warn('Requirements-Sync (edit) fehlgeschlagen:', e.message); }
  }
  if (!Object.keys(body).length) return current;
  body.updated_at = new Date().toISOString();
  let rows = [];
  try {
    rows = await rest('bww_giveaways', '?id=eq.' + encodeURIComponent(current.id) + '&guild_id=eq.' + encodeURIComponent(current.guild_id), { method: 'PATCH', body: JSON.stringify(body) });
  } catch {
    const fb = { ...body };
    delete fb.description; delete fb.duration; delete fb.requirements;
    rows = await rest('bww_giveaways', '?id=eq.' + encodeURIComponent(current.id) + '&guild_id=eq.' + encodeURIComponent(current.guild_id), { method: 'PATCH', body: JSON.stringify(fb) });
  }
  const updated = normalizeRow(rows?.[0] || { ...current, ...body });
  await logAudit({ guildId: current.guild_id, actorId, action: 'giveaway.edit', targetId: current.id, details: { patch: Object.keys(body) } }).catch(() => {});
  return updated;
}

async function cancelGiveaway(id, guildId, actorId = null, reason = null) {
  const current = await getGiveaway(id, guildId);
  if (!current) throw new Error('Giveaway nicht gefunden.');
  if (['ended', 'cancelled'].includes(current.status)) throw new Error('Giveaway ist bereits beendet.');
  const rows = await rest('bww_giveaways', '?id=eq.' + encodeURIComponent(current.id) + '&guild_id=eq.' + encodeURIComponent(current.guild_id), { method: 'PATCH', body: JSON.stringify({ status: 'cancelled', ended_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
  const updated = normalizeRow(rows?.[0] || { ...current, status: 'cancelled' });
  await logAudit({ guildId: current.guild_id, actorId, action: 'giveaway.cancel', targetId: current.id, details: { reason: reason ? String(reason).slice(0, 500) : null } }).catch(() => {});
  log.info('Giveaway abgebrochen:', current.id);
  return updated;
}

module.exports = { parseDurationToMs, formatDurationMs, normalizeRow, getGiveaway, listGiveaways, listDueGiveaways, createGiveaway, setMessageId, editGiveaway, cancelGiveaway };
