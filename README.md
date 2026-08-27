# BWW Discord Bot

Discord.js-Bot ohne Website und ohne Datenbank. Die Konfiguration wird lokal in `config/config.json` gespeichert.

## Funktionen
- `/nachricht text bild` sendet einen Embed in den aktuellen Channel.
- Vollständiges Welcome-System mit `{user}`, `{username}` und `{server}`.
- Verify-System mit Button und frei wählbarer Verifizierungsrolle.
- Setup für Welcome-Channel/Text, Verify-Channel/Text/Rolle und Rollenberechtigungen für Commands.
- Administratoren dürfen das Setup verwalten und alle Commands benutzen.

## Start
1. Node.js installieren.
2. `npm install`
3. `.env.example` zu `.env` kopieren und `DISCORD_TOKEN` eintragen.
4. `npm start`

Der Bot benötigt mindestens die Discord-Berechtigungen `View Channels`, `Send Messages`, `Embed Links`, `Manage Roles` sowie den Gateway Intent **Server Members Intent** für das Welcome-System.

### Setup
- `/setup-welcome` → Channel + Welcome-Text.
- `/setup-verify` → Channel + Rolle + Verify-Text.
- `/setup-permission` → Rolle für einen Command erlauben/entfernen.
- `/verify` → konfiguriertes Verify-Panel senden.
