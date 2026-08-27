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

---

# Auto-Sync auf KataBump

`sync.js` prüft alle **2 Minuten** per `git fetch`, ob sich `main` geändert hat.
Bei neuem Commit wird per `git pull --ff-only` aktualisiert, Abhängigkeiten installiert
und der Bot neu gestartet. Sonst wird 2 Minuten gewartet und erneut geprüft.

## Einrichtung (eine Startdatei)

Das App-Verzeichnis auf KataBump muss eine **echte git-Clone** des Repos sein
(damit `pull` funktioniert). In den KataBump-Settings:

1. **Startdatei = `sync.js`** (die einzige Datei, die gestartet wird).
2. `DISCORD_TOKEN` als Umgebungsvariable setzen.
3. Server starten.

`sync.js` startet den Bot (`node src/index.js`) im selben Verzeichnis als Kindprozess
und hält ihn bei jedem Sync am Laufen.

## Ablauf pro Zyklus

```
Warten (2 Min)
  └─ git fetch origin main
       ├─ geändert? → git pull --ff-only + npm install + Bot-Neustart
       └─ unverändert → warten (2 Min) → erneut prüfen
```

## Hinweise

- Benötigt **git**, `node` und `npm` auf dem Server.
- `.env` und `config/config.json` sind in `.gitignore` → bleiben bei jedem Pull erhalten.
- Liegen lokale (getrackte) Änderungen vor, wird der Pull übersprungen (kein `reset --hard`).
- Der Bot nutzt **keine Datenbank und kein Dashboard** — der gesamte Zustand liegt in
  `config/config.json` auf der Platte.
