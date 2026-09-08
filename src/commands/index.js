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
  { name: 'nachricht', description: 'Sendet Text und optional ein Bild als Embed.', options: [
    { name: 'text', description: 'Text der Nachricht', type: 3, required: true },
    { name: 'bild', description: 'Optionale Bild-URL', type: 3, required: false }
  ]},
  { name: 'setup', description: 'Zeigt die Setup-Hilfe.' },
  { name: 'verify', description: 'Sendet das konfigurierte Verify-System.' },
  { name: 'nachrichtauswahl', description: 'Sendet das Dokumenten-Auswahl-Men\u00FC.', options: [
    { name: 'text', description: 'Optionaler Einleitungstext am Anfang', type: 3, required: false }
  ]},
  { name: 'ticket', description: 'Sendet das Ticket-Panel.' },
  { name: 'giveaway', description: 'Startet ein Giveaway.', options: [
    { name: 'preis', description: 'Was wird verlost?', type: 3, required: true },
    { name: 'dauer', description: 'Dauer in Sekunden', type: 4, required: true },
    { name: 'gewinner', description: 'Anzahl Gewinner (Standard: 1)', type: 4, required: false }
  ]},
  { name: 'panel-create', description: 'Erstellt und sendet ein Custom-Panel mit bis zu 10 Buttons (speichern+senden).', options: panelCreateOptions },
  { name: 'panel-send', description: 'Sendet ein gespeichertes Panel.', options: [{ name: 'name', description: 'Panel-Name', type: 3, required: true }]},
  { name: 'panel-delete', description: 'L\u00F6scht ein gespeichertes Panel.', options: [{ name: 'name', description: 'Panel-Name', type: 3, required: true }]},
  { name: 'panel-list', description: 'Listet alle gespeicherten Panels.' },
  { name: 'panel-add-button', description: 'F\u00FCgt Buttons zu Panel hinzu (unbegrenzt, 25/Seite).', options: [{ name: 'name', description: 'Panel-Name', type: 3, required: true }, { name: 'label', description: 'Button Label', type: 3, required: true }, { name: 'text', description: 'Button Antwort', type: 3, required: true }]},
  { name: 'document-create', description: 'Erstellt Dokument aus .docx (Werdegang).', options: [{ name: 'name', description: 'Doc ID (a-z0-9-_)', type: 3, required: true }, { name: 'titel', description: 'Titel', type: 3, required: true }, { name: 'file', description: '.docx Datei', type: 11, required: true }]},
  { name: 'document-send', description: 'Sendet Dokument in Channel (separater Command).', options: [{ name: 'name', description: 'Doc ID', type: 3, required: true }, { name: 'channel', description: 'Ziel-Kanal', type: 7, required: true, channel_types: [0] }]},
  { name: 'werdegang-setup', description: 'Sendet Werdegang-Auswahl Embed.', options: [{ name: 'channel', description: 'Kanal', type: 7, required: true, channel_types: [0] }]},
  { name: 'document-list', description: 'Listet alle Dokumente.' },
  { name: 'document-delete', description: 'L\u00F6scht Dokument.', options: [{ name: 'name', description: 'Doc ID', type: 3, required: true }]},
  { name: 'setup-status', description: 'Status-Embed Kanal festlegen (online/offline/wartung).', options: [{ name: 'channel', description: 'Kanal f\u00FCr Status-Embed', type: 7, required: true, channel_types: [0] }]},
  { name: 'wartung', description: 'Wartungsmodus umschalten (gelb).', options: [{ name: 'aktiv', description: 'true=an, false=aus', type: 5, required: true }, { name: 'grund', description: 'Grund f\u00FCr Wartung', type: 3, required: false }]},
  { name: 'restart', description: 'Startet den Bot neu (Admin).' },
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
    { name: 'kategorie', description: 'Kategorie f\u00FCr Ticket-Kan\u00E4le', type: 7, required: true, channel_types: [4] },
    { name: 'rolle', description: 'Ticket-Rolle mit Kanalzugriff', type: 8, required: true }
  ]},
  { name: 'setup-permission', description: 'Rollenberechtigung f\u00FCr Commands setzen.', options: [
    { name: 'command', description: 'Command', type: 3, required: true, choices: [
      { name: 'nachricht', value: 'nachricht' }, { name: 'setup', value: 'setup' }, { name: 'verify', value: 'verify' },
      { name: 'nachrichtauswahl', value: 'nachrichtauswahl' }, { name: 'ticket', value: 'ticket' }, { name: 'giveaway', value: 'giveaway' }, { name: 'panel-create', value: 'panel-create' }, { name: 'panel-send', value: 'panel-send' }, { name: 'panel-delete', value: 'panel-delete' }, { name: 'panel-list', value: 'panel-list' }, { name: 'panel-add-button', value: 'panel-add-button' }, { name: 'document-create', value: 'document-create' }, { name: 'document-send', value: 'document-send' }, { name: 'werdegang-setup', value: 'werdegang-setup' }, { name: 'document-list', value: 'document-list' }, { name: 'document-delete', value: 'document-delete' }, { name: 'setup-status', value: 'setup-status' }, { name: 'wartung', value: 'wartung' }, { name: 'restart', value: 'restart' },
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
