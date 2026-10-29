// BWW Phase 4 – Exemption-Service (Staff-Ausnahmen, 04_HONEYPOT.md).
// Tabelle bww_honeypot_exemptions: 04-Felder user_id/role_id + legacy
// exempt_type/exempt_id (beide werden geschrieben/gelesen).
// Nutzt services (supabase, logger, audit, validation).

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');
const { cleanId, isSnowflake, clampText } = require('../../services/validation');

const log = logger.child('honeypot:exemptions');

async function rest(table, query = '', options = {}) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const res = await supabaseRequest(`${table}${query}`, { ...options, headers: { Prefer: 'return=representation', ...(options.headers || {}) } });
  return res.json();
}

async function listExemptions(guildId) {
  const gid = cleanId(guildId);
  return (await rest('bww_honeypot_exemptions', `?select=*&guild_id=eq.${encodeURIComponent(gid)}&order=created_at.asc&limit=200`)) || [];
}

async function addExemption(guildId, { user_id = null, role_id = null, reason = null } = {}, actorId = null) {
  const gid = cleanId(guildId);
  if (!isSnowflake(gid)) throw new Error('Ungültige Guild-ID.');
  const uid = cleanId(user_id || '');
  const rid = cleanId(role_id || '');
  if ((uid && rid) || (!uid && !rid)) throw new Error('Genau eine Angabe erforderlich: user_id ODER role_id.');
  if (uid && !isSnowflake(uid)) throw new Error('Ungültige User-ID.');
  if (rid && !isSnowflake(rid)) throw new Error('Ungültige Rollen-ID.');
  const payload = {
    guild_id: gid,
    user_id: uid || null,
    role_id: rid || null,
    exempt_type: uid ? 'user' : 'role',
    exempt_id: uid || rid,
    reason: reason != null ? clampText(reason, 500) : null,
    created_by: actorId ? String(actorId).slice(0, 100) : null,
  };
  const rows = await rest('bww_honeypot_exemptions', '', { method: 'POST', body: JSON.stringify(payload) });
  const created = rows?.[0] || null;
  await logAudit({ guildId: gid, actorId, action: 'honeypot.exempt_add', targetId: created?.id || null, details: { user_id: uid || null, role_id: rid || null } }).catch(() => {});
  return created;
}

async function removeExemption(id, guildId, actorId = null) {
  const gid = cleanId(guildId);
  const res = await supabaseRequest(`bww_honeypot_exemptions?id=eq.${encodeURIComponent(String(id))}&guild_id=eq.${encodeURIComponent(gid)}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
  const rows = await res.json().catch(() => []);
  await logAudit({ guildId: gid, actorId, action: 'honeypot.exempt_remove', targetId: String(id), details: {} }).catch(() => {});
  return (rows?.length || 0) > 0;
}

function memberRoleIds(member) {
  try {
    const cache = member?.roles?.cache;
    if (cache?.keys) return [...cache.keys()];
    if (Array.isArray(member?.roles)) return member.roles.map(String);
  } catch {}
  return [];
}

// DB-Ausnahmen prüfen (user_id/role_id + legacy exempt_type/exempt_id).
// Gibt { exempt, kind, id } zurück. Wirft nie (false bei DB-Fehler).
async function checkDbExempt(guildId, member, userId) {
  try {
    const uid = cleanId(userId);
    const exemptions = await listExemptions(guildId);
    const roles = new Set(memberRoleIds(member));
    for (const ex of exemptions) {
      const exUser = cleanId(ex.user_id || (ex.exempt_type === 'user' ? ex.exempt_id : ''));
      const exRole = cleanId(ex.role_id || (ex.exempt_type === 'role' ? ex.exempt_id : ''));
      if (exUser && uid && exUser === uid) return { exempt: true, kind: 'user', id: ex.id };
      if (exRole && roles.has(exRole)) return { exempt: true, kind: 'role', id: ex.id };
    }
  } catch (err) {
    log.warn('Exempt-Check DB-Fehler:', err.message);
  }
  return { exempt: false };
}

function isStaffMember(member) {
  try {
    const { PermissionsBitField } = require('discord.js');
    if (member?.permissions?.has?.(PermissionsBitField.Flags.Administrator)) return true;
    if (member?.permissions?.has?.(PermissionsBitField.Flags.ManageGuild)) return true;
    if (member?.permissions?.has?.(PermissionsBitField.Flags.ModerateMembers)) return true;
  } catch {}
  return false;
}

// Vollprüfung: Staff (Admin/ManageGuild/ModerateMembers) + DB-Ausnahmen.
async function isExempt(guildId, member, userId) {
  if (isStaffMember(member)) return { exempt: true, kind: 'staff' };
  return checkDbExempt(guildId, member, userId);
}

module.exports = { listExemptions, addExemption, removeExemption, isExempt, checkDbExempt, isStaffMember };
