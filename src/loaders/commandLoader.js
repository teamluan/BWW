// BWW Phase 1 – Command Loader (14_IMPLEMENTATION: Command Loader).
// Laedt Slash-Command-Definitionen aus src/commands/**. Unterordner pro Modul
// (ticket/, honeypot/, embed/, welcome/, giveaway/, verification/) sind vorgesehen;
// Bestand (src/commands/index.js mit export { commands }) bleibt kompatibel.
// Rueckgabe: Array discord.js-konformer Command-JSONs fuer REST-Registrierung.

const fs = require('fs');
const path = require('path');

function loadCommands(commandsDir = path.join(__dirname, '..', 'commands')) {
  const out = [];
  // 1) Bestand: monolithischer Export
  try {
    const legacy = require('../commands');
    const arr = Array.isArray(legacy) ? legacy : legacy?.commands;
    if (Array.isArray(arr)) out.push(...arr);
  } catch {
    // kein Bestand – ok
  }
  // 2) Modulare Dateien: src/commands/<modul>/*.js mit { data / toJSON }
  if (!fs.existsSync(commandsDir)) return out;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.js') && entry.name !== 'index.js' && entry.name !== 'README.md') {
        try {
          const mod = require(full);
          const json = mod?.data?.toJSON?.() || mod?.toJSON?.() || (mod?.name ? mod : null);
          if (json) out.push(json);
        } catch (err) {
          console.warn(`[BWW] Command-Datei übersprungen (${full}):`, err.message);
        }
      }
    }
  };
  walk(commandsDir);
  // Dedupe nach Name, letzter gewinnt
  const seen = new Map();
  for (const cmd of out) if (cmd?.name) seen.set(cmd.name, cmd);
  return [...seen.values()];
}

module.exports = { loadCommands };
