// BWW Phase 1 – events/guildCreate.js (Ziel-Struktur).
// Neue Guild -> Bot-Status + Guild-Verzeichnis in Supabase syncen (Single Source of Truth).
// Delegiert an src/utils/database.js (upsertBotStatus/syncGuilds).

async function execute(guild, client) {
  try {
    const db = require('../utils/database');
    if (typeof db.upsertBotStatus === 'function') await db.upsertBotStatus(client || guild?.client, 'online');
    if (typeof db.syncGuilds === 'function') await db.syncGuilds(client || guild?.client);
  } catch (err) {
    console.error('[BWW] GuildCreate-Sync fehlgeschlagen:', err.message);
  }
}

module.exports = execute;
module.exports.execute = execute;
