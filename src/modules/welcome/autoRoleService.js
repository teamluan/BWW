// BWW Phase 6 - AutoRole-Service (optionale Auto-Rolle, 06_WELCOME.md).
// Prueft Bot-Perm ManageRoles + Rollen-Hierarchie, Fehler loggen, nie werfen.

const { PermissionFlagsBits } = require('discord.js');
const { logger } = require('../../services/logger');
const { cleanId, isSnowflake } = require('../../services/validation');

const log = logger.child('welcome:autorole');

async function assignAutoRole(member, config) {
  if (!config?.auto_role_enabled) return { applied: false, reason: 'disabled' };
  const roleId = cleanId(config.auto_role_id || '');
  if (!roleId || !isSnowflake(roleId)) return { applied: false, reason: 'no-role' };
  const guild = member?.guild;
  if (!guild || !member) return { applied: false, reason: 'no-member' };
  try {
    const role = await guild.roles.fetch(roleId).catch(() => guild.roles.cache.get(roleId) || null);
    if (!role) {
      log.warn('Auto-Rolle fehlt:', guild.id, roleId);
      return { applied: false, reason: 'role-missing' };
    }
    const me = guild.members.me;
    if (!me) return { applied: false, reason: 'no-bot' };
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      log.warn('Auto-Rolle ohne ManageRoles:', guild.id, roleId);
      return { applied: false, reason: 'no-perm' };
    }
    const botTop = me.roles.highest?.position ?? 0;
    if (role.position >= botTop) {
      log.warn('Auto-Rolle ueber Bot-Rolle:', guild.id, roleId);
      return { applied: false, reason: 'hierarchy' };
    }
    if (member.roles.cache.has(roleId)) return { applied: true, reason: 'already' };
    await member.roles.add(roleId, 'BWW Welcome Auto-Rolle');
    return { applied: true };
  } catch (err) {
    log.warn('Auto-Rolle fehlgeschlagen:', guild?.id, roleId, '-', err?.message || err);
    return { applied: false, reason: 'error', error: String(err?.message || err).slice(0, 500) };
  }
}

module.exports = { assignAutoRole };
