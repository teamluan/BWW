// BWW Phase 6 - Log-Service (06_WELCOME.md: bww_welcome_logs).
// Felder: guild/user/channel/message_id (+sent_success/error). Nie werfen.

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { cleanId } = require('../../services/validation');

const log = logger.child('welcome:logs');

async function logWelcome(entry = {}) {
  try {
    if (!isConfigured()) return null;
    const guildId = cleanId(entry.guildId || entry.guild_id || '');
    const userId = cleanId(entry.userId || entry.user_id || '');
    if (!guildId || !userId) return null;
    const payload = {
      guild_id: guildId,
      user_id: userId,
      channel_id: entry.channelId || entry.channel_id || null,
      message_id: entry.messageId || entry.message_id || null,
      sent_success: entry.sentSuccess !== false && entry.sent_success !== false,
      error: entry.error ? String(entry.error).slice(0, 1000) : null,
    };
    const res = await supabaseRequest('bww_welcome_logs', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload),
    });
    const rows = await res.json().catch(() => []);
    return rows?.[0] || null;
  } catch (err) {
    log.warn('Welcome-Log fehlgeschlagen:', err?.message || err);
    return null;
  }
}

async function listWelcomeLogs(guildId, limit = 50) {
  const gid = cleanId(guildId);
  const safe = Math.max(1, Math.min(100, Number(limit) || 50));
  const res = await supabaseRequest(
    `bww_welcome_logs?select=id,guild_id,user_id,channel_id,message_id,sent_success,error,created_at&guild_id=eq.${encodeURIComponent(gid)}&order=created_at.desc&limit=${safe}`,
    { headers: { Prefer: 'return=representation' } }
  );
  return (await res.json()) || [];
}

module.exports = { logWelcome, listWelcomeLogs };
