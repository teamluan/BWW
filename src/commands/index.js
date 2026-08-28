const { PermissionFlagsBits } = require('discord.js');

const commands = [
  { name: 'nachricht', description: 'Sendet Text und optional ein Bild als Embed.', options: [
    { name: 'text', description: 'Text der Nachricht', type: 3, required: true },
    { name: 'bild', description: 'Optionale Bild-URL', type: 3, required: false }
  ]},
  { name: 'setup', description: 'Zeigt die Setup-Hilfe.' },
  { name: 'verify', description: 'Sendet das konfigurierte Verify-System.' },
  { name: 'nachrichtauswahl', description: 'Sendet das Dokumenten-Auswahl-Menü.' },
  { name: 'ticket', description: 'Sendet das Ticket-Panel.' },
  { name: 'giveaway', description: 'Startet ein Giveaway.', options: [
    { name: 'preis', description: 'Was wird verlost?', type: 3, required: true },
    { name: 'dauer', description: 'Dauer in Sekunden', type: 4, required: true },
    { name: 'gewinner', description: 'Anzahl Gewinner (Standard: 1)', type: 4, required: false }
  ]},
  { name: 'setup-welcome', description: 'Welcome-System konfigurieren.', options: [
    { name: 'channel', description: 'Welcome-Channel', type: 7, required: true, channel_types: [0] },
    { name: 'text', description: 'Welcome-Text; Platzhalter siehe /setup', type: 3, required: true },
    { name: 'title', description: 'Optionaler endloser Titel des Embeds', type: 3, required: false }
  ]},
  { name: 'setup-verify', description: 'Verify-System konfigurieren.', options: [
    { name: 'channel', description: 'Verify-Channel', type: 7, required: true, channel_types: [0] },
    { name: 'role', description: 'Verifizierungsrolle', type: 8, required: true },
    { name: 'text', description: 'Text des Verify-Embeds', type: 3, required: true }
  ]},
  { name: 'setup-ticket', description: 'Ticket-System konfigurieren.', options: [
    { name: 'kategorie', description: 'Kategorie für Ticket-Kanäle', type: 7, required: true, channel_types: [4] },
    { name: 'rolle', description: 'Ticket-Rolle mit Kanalzugriff', type: 8, required: true }
  ]},
  { name: 'setup-permission', description: 'Rollenberechtigung für Commands setzen.', options: [
    { name: 'command', description: 'Command', type: 3, required: true, choices: [
      { name: 'nachricht', value: 'nachricht' }, { name: 'setup', value: 'setup' }, { name: 'verify', value: 'verify' },
      { name: 'nachrichtauswahl', value: 'nachrichtauswahl' }, { name: 'ticket', value: 'ticket' }, { name: 'giveaway', value: 'giveaway' }
    ]},
    { name: 'role', description: 'Rolle', type: 8, required: true },
    { name: 'erlauben', description: 'true = erlauben, false = entfernen', type: 5, required: true }
  ]}
];

function isAllowed(interaction, config) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roles = config.permissions[interaction.commandName] || [];
  return roles.some(id => interaction.member.roles.cache.has(id));
}

module.exports = { commands, isAllowed };
