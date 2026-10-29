// BWW Phase 1 – zentraler Logger (01_ARCHITECTURE Kap. 4: logger).
// Phase 13: Sanitizer – keine Secrets/Tokens/Keys in Logs (maskiert, silent-fail).
// Duenn, synchron, silent-fail bei Webhook. Ersetzt src/logger.js NICHT –
// src/logger.js bleibt bestehen, dieser Service erweitert um debug/child.
// Optional: LOG_WEBHOOK_URL (Discord-Webhook) – nur server-seitig via ENV.

const BASE_LEVEL = String(process.env.LOG_LEVEL || 'info').toLowerCase();
const ORDER = { debug: 0, info: 1, warn: 2, error: 3 };

function ts() {
  return new Date().toISOString();
}

function enabled(level) {
  return (ORDER[level] ?? 1) >= (ORDER[BASE_LEVEL] ?? 1);
}

// Phase 13: Secrets maskieren (Tokens/Passwoerter/Keys), Logs kuerzen.
function sanitizeArgs(args) {
  try {
    return (Array.isArray(args) ? args : [args]).map((a) => {
      if (a == null) return a;
      if (typeof a !== 'string' && typeof a !== 'object') return a;
      let s = typeof a === 'string' ? a : JSON.stringify(a);
      s = String(s)
        .replace(/sb_secret_[A-Za-z0-9_-]{4,}/g, '[MASKED]')
        .replace(/sb_publishable_[A-Za-z0-9_-]{4,}/g, '[MASKED]')
        .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[MASKED-JWT]')
        .replace(/discord\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_-]+/g, '[MASKED-WEBHOOK]')
        .slice(0, 2000);
      if (typeof a === 'string') return s;
      try { return JSON.parse(s.slice(0, 2000)); } catch { return s; }
    });
  } catch {
    return ['[SANITIZED]'];
  }
}

function secretKeyHit(key) {
  const k = String(key || '').toLowerCase();
  return /(token|password|secret|service_role|private_key|api_key|authorization|bearer|code_hash|session|cookie|webhook)/.test(k);
}

function sanitizeObject(obj, depth = 0) {
  if (obj == null || depth > 3) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.slice(0, 20).map((v) => sanitizeObject(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(obj).slice(0, 30)) {
    out[k] = secretKeyHit(k) ? '[MASKED]' : sanitizeObject(v, depth + 1);
  }
  return out;
}

async function forwardToWebhook(level, args) {
  const url = process.env.LOG_WEBHOOK_URL;
  if (!url) return;
  try {
    const clean = sanitizeArgs(args);
    const content = `[${level.toUpperCase()}] ${clean.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ').slice(0, 1800)}`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  } catch {
    // silent-fail: Logging darf nie crashen
  }
}

function makeLogger(scope = 'BWW') {
  const prefix = `[${ts()}] [${scope}]`;
  return {
    debug(...args) {
      if (enabled('debug')) console.debug(`${prefix} [DEBUG]`, ...sanitizeArgs(args));
    },
    info(...args) {
      if (enabled('info')) console.log(`${prefix} [INFO]`, ...sanitizeArgs(args));
    },
    warn(...args) {
      if (enabled('warn')) console.warn(`${prefix} [WARN]`, ...sanitizeArgs(args));
      forwardToWebhook('warn', args).catch(() => {});
    },
    error(...args) {
      console.error(`${prefix} [ERROR]`, ...sanitizeArgs(args));
      forwardToWebhook('error', args).catch(() => {});
    },
    child(sub) {
      return makeLogger(`${scope}:${sub}`);
    },
  };
}

const logger = makeLogger('BWW');

module.exports = { logger, makeLogger, sanitizeArgs, sanitizeObject };
