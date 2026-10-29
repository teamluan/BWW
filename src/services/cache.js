// BWW Phase 1 – Cache-Service (TTL Map, prozesslokal).
// Nutzung: Guild-Settings (5s), Bot-Status, Validation-Ergebnisse.
// Kein Redis in Phase 1 – bewusst prozesslokal, Dashboard nutzt eigene Next-Caches.

class TtlCache {
  constructor(defaultTtlMs = 5000, maxEntries = 1000) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
    this.store = new Map();
  }
  get(key) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }
  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + Math.max(0, ttlMs) });
    return value;
  }
  del(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const guildSettingsCache = new TtlCache(5000, 2000);

module.exports = { TtlCache, guildSettingsCache };
