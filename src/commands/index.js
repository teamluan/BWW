const { PermissionFlagsBits } = require('discord.js');

const panelCreateOptions = [
  { name: 'name', description: 'Panel-Name (z.B. test, nur a-z0-9-_ )', type: 3, required: true },
  { name: 'intro', description: 'Text ganz oben im Panel', type: 3, required: false },
  { name: 'button1_label', description: 'Button 1 Name', type: 3, required: false },
  { name: 'button1_text', description: 'Button 1 Antwort', type: 3, required: false },
  { name: 'button2_label', description: 'Button 2 Name', type: 3, required: false },
  { name: 'button2_text', description: 'Button 2 Antwort', type: 3, required: false },
  { name: 'button3_label', description: 'Button 3 Name', type: 3, required: false },
  { name: 'button3_text', description: 'Button 3 Antwort', type: 3, required: false },
  { name: 'button4_label', description: 'Button 4 Name', type: 3, required: false },
  { name: 'button4_text', description: 'Button 4 Antwort', type: 3, required: false },
  { name: 'button5_label', description: 'Button 5 Name', type: 3, required: false },
  { name: 'button5_text', description: 'Button 5 Antwort', type: 3, required: false },
  { name: 'button6_label', description: 'Button 6 Name', type: 3, required: false },
  { name: 'button6_text', description: 'Button 6 Antwort', type: 3, required: false },
  { name: 'button7_label', description: 'Button 7 Name', type: 3, required: false },
  { name: 'button7_text', description: 'Button 7 Antwort', type: 3, required: false },
  { name: 'button8_label', description: 'Button 8 Name', type: 3, required: false },
  { name: 'button8_text', description: 'Button 8 Antwort', type: 3, required: false },
  { name: 'button9_label', description: 'Button 9 Name', type: 3, required: false },
  { name: 'button9_text', description: 'Button 9 Antwort', type: 3, required: false },
  { name: 'button10_label', description: 'Button 10 Name', type: 3, required: false },
  { name: 'button10_text', description: 'Button 10 Antwort', type: 3, required: false },
];

const commands = [
  { name: 'nachricht', description: 'Sendet ein Components-V2-Embed.', options: [
    { name: 'text', description: 'Text der Nachricht', type: 3, required: true },
    { name: 'bild', description: 'Optionale Bild-URL', type: 3, required: false }
  ]},
  { name: 'embed', description: 'Erstellt ein flexibles Components-V2-Embed.', options: [
    { name: 'text', description: 'Inhalt des Embeds', type: 3, required: true },
    { name: 'titel', description: 'Optionaler Titel', type: 3, required: false },
    { name: 'bild', description: 'Optionale Bild-URL', type: 3, required: false },
    { name: 'thumbnail', description: 'Optionale Thumbnail-URL', type: 3, required: false },
    { name: 'farbe', description: 'Hex-Farbe, z. B. 5865F2', type: 3, required: false },
    { name: 'footer', description: 'Optionaler Footer', type: 3, required: false }
  ]},
  { name: 'setup', description: 'Zeigt die Setup-Hilfe.' },
  { name: 'verify', description: 'Sendet das konfigurierte Verify-System.' },

  { name: 'ticket', description: 'Sendet das Ticket-Panel.' },
  { name: 'ticket-list', description: 'Listet Tickets dieses Servers.', options: [
    { name: 'status', description: 'Optionaler Statusfilter', type: 3, required: false, choices: [
      { name: 'Offen', value: 'open' }, { name: 'Gesperrt', value: 'locked' }, { name: 'Geschlossen', value: 'closed' }
    ]}
  ]},
  { name: 'ticket-close', description: 'Schließt ein Ticket.', options: [{ name: 'id', description: 'Optional: Ticket-ID. Im Ticket-Channel automatisch.', type: 3, required: false }]},
  { name: 'ticket-claim', description: 'Übernimmt oder gibt ein Ticket frei.', options: [{ name: 'id', description: 'Optional: Ticket-ID. Im Ticket-Channel automatisch.', type: 3, required: false }]},
  { name: 'ticket-reopen', description: 'Öffnet ein geschlossenes Ticket erneut.', options: [{ name: 'id', description: 'Ticket-ID', type: 3, required: true }]},
  { name: 'ticket-add', description: 'Fügt einen Benutzer zum Ticket hinzu.', options: [
    { name: 'user', description: 'Benutzer', type: 6, required: true },
    { name: 'id', description: 'Optional: Ticket-ID. Im Ticket-Channel automatisch.', type: 3, required: false }
  ]},
  { name: 'ticket-remove', description: 'Entfernt einen Benutzer aus dem Ticket.', options: [
    { name: 'user', description: 'Benutzer', type: 6, required: true },
    { name: 'id', description: 'Optional: Ticket-ID. Im Ticket-Channel automatisch.', type: 3, required: false }
  ]},
  { name: 'ticket-rename', description: 'Benennt ein Ticket um.', options: [
    { name: 'name', description: 'Neuer Name', type: 3, required: true },
    { name: 'id', description: 'Optional: Ticket-ID. Im Ticket-Channel automatisch.', type: 3, required: false }
  ]},
  { name: 'ticket-priority', description: 'Ändert die Ticket-Priorität.', options: [
    { name: 'priority', description: 'Neue Priorität', type: 3, required: true, choices: [
      { name: 'Niedrig', value: 'low' }, { name: 'Normal', value: 'normal' }, { name: 'Hoch', value: 'high' }, { name: 'Dringend', value: 'urgent' }
    ]},
    { name: 'id', description: 'Optional: Ticket-ID. Im Ticket-Channel automatisch.', type: 3, required: false }
  ]},
  { name: 'ticket-lock', description: 'Sperrt ein Ticket für Benutzer.', options: [{ name: 'id', description: 'Optional: Ticket-ID. Im Ticket-Channel automatisch.', type: 3, required: false }]},
  { name: 'ticket-unlock', description: 'Entsperrt ein Ticket.', options: [{ name: 'id', description: 'Optional: Ticket-ID. Im Ticket-Channel automatisch.', type: 3, required: false }]},
  { name: 'giveaway', description: 'Erstellt ein vollständiges Giveaway.', options: [
    { name: 'preis', description: 'Was wird verlost?', type: 3, required: true },
    { name: 'dauer', description: 'Dauer in Sekunden (5 bis 2592000)', type: 4, required: true },
    { name: 'gewinner', description: 'Anzahl Gewinner (1-100)', type: 4, required: false },
    { name: 'channel', description: 'Ziel-Channel (Standard: aktueller Channel)', type: 7, required: false, channel_types: [0] },
    { name: 'pflichtrolle', description: 'Rolle, die zur Teilnahme nötig ist', type: 8, required: false },
    { name: 'accountalter', description: 'Mindestalter des Discord-Accounts in Tagen', type: 4, required: false },
    { name: 'serveralter', description: 'Mindestzeit auf dem Server in Tagen', type: 4, required: false },
    { name: 'bonusrolle', description: 'Rolle für zusätzliche Gewinnchancen', type: 8, required: false },
    { name: 'bonus', description: 'Zusätzliche Gewinnchancen für die Bonusrolle (0-20)', type: 4, required: false }
  ]},
  { name: 'giveaway-end', description: 'Beendet ein aktives Giveaway sofort.', options: [{ name: 'id', description: 'Giveaway-ID', type: 3, required: true }]},
  { name: 'giveaway-reroll', description: 'Zieht neue Gewinner für ein beendetes Giveaway.', options: [{ name: 'id', description: 'Giveaway-ID', type: 3, required: true }]},
  { name: 'giveaway-cancel', description: 'Bricht ein aktives Giveaway ab.', options: [{ name: 'id', description: 'Giveaway-ID', type: 3, required: true }]},
  { name: 'giveaway-list', description: 'Listet die letzten Giveaways dieses Servers.' },  { name: 'panel-create', description: 'Erstellt und sendet ein Custom-Panel mit bis zu 10 Buttons (speichern+senden).', options: panelCreateOptions },
  { name: 'panel-send', description: 'Sendet ein gespeichertes Panel.', options: [{ name: 'name', description: 'Panel-Name', type: 3, required: true }]},
  { name: 'panel-delete', description: 'L\u00F6scht ein gespeichertes Panel.', options: [{ name: 'name', description: 'Panel-Name', type: 3, required: true }]},
  { name: 'panel-list', description: 'Listet alle gespeicherten Panels.' },
  { name: 'panel-add-button', description: 'F\u00FCgt Buttons zu Panel hinzu (unbegrenzt, 25/Seite).', options: [{ name: 'name', description: 'Panel-Name', type: 3, required: true }, { name: 'label', description: 'Button Label', type: 3, required: true }, { name: 'text', description: 'Button Antwort', type: 3, required: true }]},
  { name: 'umfrage', description: 'Erstellt Event-Umfrage mit Live-Z\u00E4hler.', options: [
    { name: 'frage', description: 'Frage', type: 3, required: true },
    { name: 'option1', description: 'Option 1', type: 3, required: true },
    { name: 'option2', description: 'Option 2', type: 3, required: true },
    { name: 'option3', description: 'Option 3', type: 3, required: false },
    { name: 'option4', description: 'Option 4', type: 3, required: false },
    { name: 'option5', description: 'Option 5', type: 3, required: false }
  ]},
  { name: 'setup-status', description: 'Status-Embed Kanal festlegen (online/offline/wartung).', options: [{ name: 'channel', description: 'Kanal f\u00FCr Status-Embed', type: 7, required: true, channel_types: [0] }]},
  { name: 'wartung', description: 'Wartungsmodus umschalten (gelb).', options: [{ name: 'aktiv', description: 'true=an, false=aus', type: 5, required: true }, { name: 'grund', description: 'Grund f\u00FCr Wartung', type: 3, required: false }]},
  { name: 'restart', description: 'Startet den Bot neu (Admin).' },
  { name: 'dashboard-code', description: 'Erzeugt einen 60-Minuten-Zugangscode für das BWW-Web-Dashboard (Admin).' },
  { name: 'kick', description: 'Kickt ein Mitglied.', options: [
    { name: 'user', description: 'Mitglied', type: 6, required: true },
    { name: 'grund', description: 'Grund', type: 3, required: false }
  ]},
  { name: 'ban', description: 'Bannt einen Benutzer.', options: [
    { name: 'user', description: 'Benutzer', type: 6, required: true },
    { name: 'grund', description: 'Grund', type: 3, required: false }
  ]},
  { name: 'unban', description: 'Entbannt einen Benutzer.', options: [
    { name: 'user', description: 'Benutzer', type: 6, required: true }
  ]},
  { name: 'timeout', description: 'Pausiert ein Mitglied f\u00FCr eine Dauer.', options: [
    { name: 'user', description: 'Mitglied', type: 6, required: true },
    { name: 'dauer', description: 'Dauer in Minuten', type: 4, required: true },
    { name: 'grund', description: 'Grund', type: 3, required: false }
  ]},
  { name: 'giverole', description: 'Gibt einem Mitglied eine Rolle.', options: [
    { name: 'user', description: 'Mitglied', type: 6, required: true },
    { name: 'rolle', description: 'Rolle', type: 8, required: true }
  ]},
  { name: 'removerole', description: 'Entfernt einem Mitglied eine Rolle.', options: [
    { name: 'user', description: 'Mitglied', type: 6, required: true },
    { name: 'rolle', description: 'Rolle', type: 8, required: true }
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
    { name: 'rolle', description: 'Ticket-Rolle mit Kanalzugriff', type: 8, required: true },
    { name: 'log-channel', description: 'Optionaler Channel für Ticket-Logs und Transcripts', type: 7, required: false, channel_types: [0] },
    { name: 'transcript', description: 'Transcript beim Schließen erstellen', type: 5, required: false },
    { name: 'close-delete', description: 'Ticket-Channel nach Schließen löschen', type: 5, required: false },
    { name: 'user-close', description: 'Ticket-Ersteller darf selbst schließen', type: 5, required: false },
    { name: 'max', description: 'Maximale offene Tickets pro Benutzer (1-5)', type: 4, required: false, min_value: 1, max_value: 5 }
  ]},
  { name: 'setup-honeypot', description: 'Honeypot konfigurieren und aktivieren/deaktivieren.', options: [
    { name: 'aktiv', description: 'true = aktiv, false = deaktiviert', type: 5, required: true },
    { name: 'channel', description: 'Honeypot-Channel', type: 7, required: false, channel_types: [0] },
    { name: 'log-channel', description: 'Optionaler Log-Channel', type: 7, required: false, channel_types: [0] },
    { name: 'bestrafung', description: 'Reaktion nach einem Treffer', type: 3, required: false, choices: [
      { name: 'Keine', value: 'none' }, { name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' }, { name: 'Timeout', value: 'timeout' }
    ]},
    { name: 'timeout', description: 'Timeout in Minuten (1-40320)', type: 4, required: false },
    { name: 'nachricht-loeschen', description: 'Getriggerte Nachricht löschen', type: 5, required: false },
    { name: 'admins-ignorieren', description: 'Administratoren ausnehmen', type: 5, required: false },
    { name: 'ausnahme-rolle', description: 'Optionale Rolle, die ausgenommen wird', type: 8, required: false }
  ]},
  { name: 'setup-permission', description: 'Rollenberechtigung f\u00FCr Commands setzen.', options: [
    { name: 'command', description: 'Command', type: 3, required: true, choices: [
      { name: 'nachricht', value: 'nachricht' }, { name: 'embed', value: 'embed' }, { name: 'setup', value: 'setup' }, { name: 'verify', value: 'verify' },
      { name: 'ticket', value: 'ticket' }, { name: 'giveaway', value: 'giveaway' }, { name: 'giveaway-end', value: 'giveaway-end' }, { name: 'giveaway-reroll', value: 'giveaway-reroll' }, { name: 'giveaway-cancel', value: 'giveaway-cancel' }, { name: 'giveaway-list', value: 'giveaway-list' }, { name: 'panel-create', value: 'panel-create' }, { name: 'panel-send', value: 'panel-send' }, { name: 'panel-delete', value: 'panel-delete' }, { name: 'panel-list', value: 'panel-list' }, { name: 'panel-add-button', value: 'panel-add-button' }, { name: 'umfrage', value: 'umfrage' }, { name: 'setup-status', value: 'setup-status' }, { name: 'wartung', value: 'wartung' }, { name: 'restart', value: 'restart' },
      { name: 'kick', value: 'kick' }, { name: 'ban', value: 'ban' }, { name: 'unban', value: 'unban' }, { name: 'timeout', value: 'timeout' },
      { name: 'giverole', value: 'giverole' }, { name: 'removerole', value: 'removerole' }
    ]},
    { name: 'role', description: 'Rolle', type: 8, required: true },
    { name: 'erlauben', description: 'true = erlauben, false = entfernen', type: 5, required: true }
  ]}
];

function isAllowed(interaction, config) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const key = interaction.commandName;
  if (!key) return false;
  const roles = config.permissions[key] || [];
  const memberRoles = interaction.member?.roles?.cache;
  if (!memberRoles) return false;
  return roles.some(id => memberRoles.has(id));
}

module.exports = { commands, isAllowed };
