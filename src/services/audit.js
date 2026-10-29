// BWW Phase 1 – Audit-Service (01_ARCHITECTURE Kap. 4: audit).
// Phase 13: Details werden maskiert (keine Secrets/Tokens/Keys im Audit).
// Schreibt moduluebergreifend nach public.bww_audit_logs (siehe Migration
// 20261003120000_bww_phase1_fundament.sql). Tabelle fehlt auf alten Ständen ->
// Fallback auf logger, NIEMALS werfen (Audit darf Bot-Flow nie brechen).

const { supabaseRequest, isConfigured } = require('./supabase');
const { logger } = require('./logger');

const log = logger.child('audit');

function sanitizeDetails(details) {
  try {
    if (details == null) return {};
    const obj = details && typeof details === 'object' ? details : { value: String(details).slice(0, 1000) };
    const out = {};
    for (const [k, v] of Object.entries(obj).slice(0, 30)) {
      if (/(token|password|secret|service_role|private_key|api_key|authorization|bearer|code_hash|session|cookie|webhook)/i.test(k)) {
        out[String(k).slice(0, 50)] = '[MASKED]';
      } else if (typeof v === 'string') {
        out[String(k).slice(0, 50)] = String(v)
          .replace(/sb_secret_[A-Za-z0-9_-]{4,}/g, '[MASKED]')
          .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[MASKED-JWT]')
          .slice(0, 1000);
      } else {
        out[String(k).slice(0, 50)] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

async function logAudit({ guildId, actorId = null, action, targetId = null, details = {} } = {}) {
  if (!guildId || !action) return null;
  const entry = {
    guild_id: String(guildId),
    actor_id: actorId ? String(actorId).slice(0, 100) : null,
    action: String(action).slice(0, 100),
    target_id: targetId ? String(targetId).slice(0, 200) : null,
    details: sanitizeDetails(details),
  };
  if (!isConfigured()) {
    log.info('audit (no-supabase):', entry.action, entry.guild_id);
    return null;
  }
  try {
    const res = await supabaseRequest('bww_audit_logs', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(entry),
    });
    const rows = await res.json().catch(() => []);
    return rows?.[0] || null;
  } catch (err) {
    // Tabelle evtl. noch nicht migriert -> Fallback Log (ohne Details-Leak), kein Throw
    log.info('audit-fallback:', entry.action, entry.guild_id);
    return null;
  }
}

module.exports = { logAudit };
