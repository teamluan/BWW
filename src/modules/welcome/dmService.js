// BWW Phase 6 - DM-Service (optionale Begruessungs-DM, 06_WELCOME.md).
// dm_enabled/dm_message aus bww_welcome. Fehler bei geschlossener DM
// abfangen + loggen, nie werfen (Flow darf nie brechen).

const { logger } = require('../../services/logger');
const { replaceVariables } = require('./variableService');

const log = logger.child('welcome:dm');

async function sendWelcomeDM(member, config, customVars = []) {
  if (!config?.dm_enabled) return { sent: false, reason: 'disabled' };
  const raw = String(config.dm_message || '').trim();
  if (!raw) return { sent: false, reason: 'empty' };
  if (!member?.send) return { sent: false, reason: 'no-member' };
  const text = replaceVariables(raw, { member, user: member.user, guild: member.guild }, customVars);
  if (!text.trim()) return { sent: false, reason: 'empty-resolved' };
  try {
    await member.send({ content: text.slice(0, 4000) });
    return { sent: true };
  } catch (err) {
    const code = err?.code || err?.status;
    const closed = code === 50007;
    log.warn('Welcome-DM fehlgeschlagen:', member?.guild?.id, member?.id, closed ? 'DM geschlossen' : (err?.message || err));
    return { sent: false, reason: closed ? 'dm-closed' : 'error', error: String(err?.message || err).slice(0, 500) };
  }
}

module.exports = { sendWelcomeDM };
