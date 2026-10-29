// BWW Phase 1 – Event Loader (14_IMPLEMENTATION: Event Loader).
// Verdrahtet src/events/*.js mit discord.js Client-Events. Mapping:
//   ready.js -> ClientReady (once) | interactionCreate.js -> InteractionCreate
//   guildCreate.js -> GuildCreate | guildDelete.js -> GuildDelete
//   guildMemberAdd.js -> GuildMemberAdd | messageCreate.js -> MessageCreate
// Bestand (src/index.js + interactions.js/welcome.js) bleibt vorerst kanonisch;
// dieser Loader ist die Ziel-Struktur fuer den schrittweisen Umzug (Phase 2+).

const { Events } = require('discord.js');

const MAP = {
  'ready.js': { event: Events.ClientReady, once: true },
  'interactionCreate.js': { event: Events.InteractionCreate, once: false },
  'guildCreate.js': { event: Events.GuildCreate, once: false },
  'guildDelete.js': { event: Events.GuildDelete, once: false },
  'guildMemberAdd.js': { event: Events.GuildMemberAdd, once: false },
  'messageCreate.js': { event: Events.MessageCreate, once: false },
};

function loadEvents(client, handlers = {}) {
  for (const [file, { event, once }] of Object.entries(MAP)) {
    const base = file.replace(/\.js$/, '');
    let handler = handlers[base] || handlers[file];
    if (!handler) {
      try {
        handler = require(`../events/${file}`);
      } catch {
        continue; // Datei fehlt -> ueberspringen (Platzhalter-Phase)
      }
    }
    const fn = typeof handler === 'function' ? handler : handler?.execute;
    if (typeof fn !== 'function') continue;
    if (once) client.once(event, (...args) => fn(...args, client));
    else client.on(event, (...args) => fn(...args, client));
  }
  return client;
}

module.exports = { loadEvents, EVENT_MAP: MAP };
