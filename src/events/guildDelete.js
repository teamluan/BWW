// BWW Phase 1 – events/guildDelete.js (Ziel-Struktur per 15_FOLDER_STRUCTURE).
// Guild entfernt -> Verzeichnis neu syncen. Kein Loeschen von bww_-Daten in Phase 1
// (Audit/Transcripts bleiben erhalten; Retention folgt in Phase 8/9).
// KANONISCH bleibt vorerst src/index.js; diese Datei wird ab Phase 2 vom
// loaders/eventLoader verdrahtet. Kein Doppel-Handling.

async function execute(guild, client) {
  try {
    const db = require('../utils/database');
    if (typeof db.syncGuilds === 'function') await db.syncGuilds(client || guild?.client);
    if (typeof db.upsertBotStatus === 'function') await db.upsertBotStatus(client || guild?.client, 'online');
  } catch (err) {
    console.error('[BWW] GuildDelete-Sync fehlgeschlagen:', err.message);
  }
}

module.exports = execute;
module.exports.execute = execute;
