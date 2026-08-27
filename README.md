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

# BWW Auto-Sync auf KataBump

Endlos-Schleife: prüft alle **2 Minuten** auf neue Commits in `teamluan/BWW` (Branch `main`).
Bei neuem Commit wird der Code aktualisiert, Abhängigkeiten installiert und der Bot neu gestartet.
Sonst wird einfach 2 Minuten gewartet und erneut geprüft.

## Dateien

- `sync.js` — der Sync-Wrapper (Startpunkt des Servers).
- `bot/` — der eigentliche BWW-Bot, wird von `sync.js` automatisch geklont und gepflegt.
- `backups/` — automatische Backups der KataBump-Dateien (nur beim allerersten Start).
- `.synced` — Zustandsdatei (markiert, ob der Erststart bereits durchgelaufen ist).

## Start auf KataBump (eine Startdatei)

Da KataBump in den Settings nur **eine Startdatei** zulässt, setzt du dort einfach:

1. **Startdatei = `package.json`** (oder direkt `sync.js`).
2. `DISCORD_TOKEN` als Umgebungsvariable setzen (wie bisher).
3. Server starten. Beim ersten Start:
   - Backup aller vorhandenen Dateien → `backups/<zeitstempel>/`.
   - `sync.js` klont `teamluan/BWW` in `bot/`.
   - Installiert Abhängigkeiten (`npm install`).
   - Sicherheits-Check läuft.
   - Bot startet (`node bot/src/index.js`), gesteuert von `sync.js`.
4. Ab jetzt alle 2 Minuten per `git fetch` prüfen.

`npm start` führt `node sync.js` aus, das den Bot automatisch als Kindprozess startet.

## Neue Features

### 1. Backup beim ersten Start
Sobald `sync.js` zum ersten Mal läuft, werden **alle bestehenden Dateien** auf dem
KataBump-Server (inkl. Ordnerstruktur) nach `backups/<zeitstempel>/` kopiert.
Übersprungen werden nur `node_modules/`, `bot/`, `backups/` und `.git`.
So geht beim späteren Sync-Vorfall nichts verloren — Notfall-Wiederherstellung aus dem Backup ist möglich.

### 2. Sicherheits-Check
Bei jedem Start **und nach jedem neuen Commit** scannt `sync.js` den Bot-Quellcode
sowie lokale `.env`/`config`-Dateien auf kritische Muster:

- Hardcoded Discord-Token / Secrets
- `eval` / `new Function`
- `exec`/`spawn` mit Variablen
- Fehlende `DISCORD_TOKEN`-Umgebungsvariable

Befunde erscheinen als **SICHERHEIT:**-Warnungen im Log. Der Bot startet trotzdem,
damit der Dienst läuft — aber du siehst sofort, was zu beheben ist.

## Ablauf pro Zyklus

```
Warten (2 Min)
  └─ git fetch origin main
       ├─ geändert? → reset --hard origin/main + npm install + Sicherheits-Check + Bot-Neustart
       └─ unverändert → warten (2 Min) → erneut prüfen
```

## Hinweise

- Benötigt **git**, `node` und `npm` auf dem Server.
- Lokale Änderungen in `bot/` (z. B. `.env`, `config/config.json`) bleiben erhalten.
- `git reset --hard` überschreibt alle *getrackten* Dateien mit dem GitHub-Stand. Beabsichtigte
  lokale Anpassungen gehören nach `config/` oder `.env` (beide nicht getrackt).
- Der Bot nutzt **keine Datenbank und kein Dashboard** — der gesamte Zustand liegt in
  `config/config.json` (auf der Platte). Genau deshalb ist das Erststart-Backup wichtig:
  es sichert deine lokal gespeicherte Konfiguration.
