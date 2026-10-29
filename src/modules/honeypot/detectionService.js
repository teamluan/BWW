// BWW Phase 4 – Detection-Service (04_HONEYPOT.md Kap. Ablauf).
// Neue Nachricht -> Honeypot Channel? -> Ausnahmeprüfung -> Trigger speichern
// -> Nachricht löschen (falls aktiviert) -> Aktion -> Audit/System-Log.
// Nutzt services (supabase, logger) + honeypot/exemption/action-Services.
// Wirft nie (silent-fail), gibt { handled } zurück. Keine Doppel-Verarbeitung:
// Bots/Webhooks/Bot-eigene Nachrichten + Throttle (15s pro User+Channel).

const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { cleanId, clampText } = require('../../services/validation');
const { TRIGGER_THROTTLE_MS, toLegacyActionTaken } = require('./constants');
const { getHoneypotByChannel, bumpHitCount } = require('./honeypotService');
const { isExempt } = require('./exemptionService');
const { executeAction } = require('./actionService');

const log = logger.child('honeypot:detect');
const throttle = new Map(); // key userId:channelId -> timestamp

function throttled(userId, channelId, now = Date.now()) {
  const key = `${userId}:${channelId}`;
  const prev = throttle.get(key) || 0;
  if (now - prev < TRIGGER_THROTTLE_MS) return true;
  throttle.set(key, now);
  if (throttle.size > 5000) {
    for (const [k, ts] of throttle) if (now - ts >= TRIGGER_THROTTLE_MS) throttle.delete(k);
  }
  return false;
}

async function saveTrigger({ honeypot, message }) {
  const guildId = String(message.guildId || message.guild?.id);
  const content = clampText(message.content || '', 2000);
  const action = String(honeypot.action || 'log_only');
  const payload = {
    honeypot_id: honeypot.id,
    guild_id: guildId,
    user_id: String(message.author.id),
    message_id: String(message.id),
    channel_id: String(message.channelId || message.channel?.id || honeypot.channel_id),
    content: content || null,
    action,
    message_url: message.url || null,
    action_taken: toLegacyActionTaken(action),
  };
  const res = await supabaseRequest('bww_honeypot_triggers', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) });
  const rows = await res.json().catch(() => []);
  return { ...payload, id: rows?.[0]?.id || null, created_at: rows?.[0]?.created_at || new Date().toISOString() };
}

// message: discord.js Message, client: Client (fuer actionService/Log-Channel).
async function handleHoneypotMessage(message, client = null) {
  try {
    if (!message?.guild || !message.author || message.author.bot || message.webhookId) return { handled: false };
    if (!isConfigured()) return { handled: false };
    const guildId = String(message.guildId || message.guild.id);
    const channelId = String(message.channelId || message.channel?.id || '');
    const userId = String(message.author.id);
    if (!guildId || !channelId || !userId) return { handled: false };
    let matches = [];
    try { matches = await getHoneypotByChannel(channelId, guildId); }
    catch (err) { log.warn('Honeypot-Lookup fehlgeschlagen:', err.message); return { handled: false }; }
    if (!matches.length) return { handled: false };
    if (throttled(userId, channelId)) return { handled: false, throttled: true };
    const honeypot = matches[0];
    // Ausnahmeprüfung (Staff + DB-Exemptions) – exempt -> ignorieren/optional loggen
    let exempt = null;
    try {
      const member = message.member || await message.guild.members.fetch(userId).catch(() => null);
      exempt = await isExempt(guildId, member, userId);
    } catch {}
    if (exempt?.exempt) {
      log.debug?.(`Honeypot exempt (${exempt.kind}): ${guildId}/${channelId}/${userId}`);
      return { handled: false, exempt: true, kind: exempt.kind, honeypot };
    }
    // Trigger speichern
    let trigger = null;
    try { trigger = await saveTrigger({ honeypot, message }); }
    catch (err) { log.warn('Trigger-Speichern fehlgeschlagen:', err.message); return { handled: false }; }
    bumpHitCount(honeypot.id, guildId).catch(() => {});
    // Nachricht löschen (falls aktiviert) + Aktion – Fehler landen in actionService-Result
    let deleted = false;
    if (honeypot.delete_message && message.deletable) {
      try { await message.delete(); deleted = true; } catch {}
    }
    let actionResult = { ok: true, steps: deleted ? ['Nachricht gelöscht'] : [], errors: [] };
    try { actionResult = await executeAction(client, message, honeypot, { ...trigger, message_deleted: deleted }); }
    catch (err) { log.warn('Honeypot-Aktion Fehler:', err.message); }
    log.info(`Honeypot-Treffer: ${guildId}/${channelId}/${userId} (${honeypot.action})`);
    return { handled: true, honeypot, trigger, deleted, action: actionResult };
  } catch (err) {
    log.warn('Detection-Fehler:', err?.message || err);
    return { handled: false };
  }
}

module.exports = { handleHoneypotMessage };
