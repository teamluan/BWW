// BWW Phase 1 – src/logger.js (Basis-Logger, bleibt erhalten).
// Phase 13: Sanitizer – keine Secrets/Tokens/Keys in Logs (maskiert).
function ts() {
  return new Date().toISOString();
}

function clean(args) {
  try {
    return (Array.isArray(args) ? args : [args]).map((a) => {
      if (typeof a !== 'string') return a;
      return String(a)
        .replace(/sb_secret_[A-Za-z0-9_-]{4,}/g, '[MASKED]')
        .replace(/sb_publishable_[A-Za-z0-9_-]{4,}/g, '[MASKED]')
        .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[MASKED-JWT]')
        .slice(0, 2000);
    });
  } catch {
    return ['[SANITIZED]'];
  }
}

module.exports = {
  info(...args) {
    console.log(`[${ts()}] [INFO]`, ...clean(args));
  },
  warn(...args) {
    console.warn(`[${ts()}] [WARN]`, ...clean(args));
  },
  error(...args) {
    console.error(`[${ts()}] [ERROR]`, ...clean(args));
  },
};
