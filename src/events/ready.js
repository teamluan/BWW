// BWW Phase 1 – events/ready.js (Ziel-Struktur per 15_FOLDER_STRUCTURE).
// Duenne Huelle: Slash-Commands registrieren + DB-Sync anstossen.
// KANONISCH bleibt vorerst src/index.js (monolithisch); diese Datei wird ab Phase 2
// vom loaders/eventLoader verdrahtet, sobald der Umzug beginnt. Kein Doppel-Registrieren.

const { REST, Routes } = require('discord.js');
const { loadCommands } = require('../loaders/commandLoader');
const { logger } = require('../services/logger');

const log = logger.child('ready');

async function execute(client) {
  const token = process.env.DISCORD_TOKEN || '';
  if (!token) {
    log.error('DISCORD_TOKEN fehlt.');
    return;
  }
  const rest = new REST({ version: '10' }).setToken(token);
  const body = loadCommands();
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body });
    log.info(`BWW Bot online als ${client.user.tag} (${body.length} Commands).`);
  } catch (err) {
    log.error('Slash-Command Registrierung fehlgeschlagen:', err.message);
  }
}

module.exports = execute;
module.exports.execute = execute;
