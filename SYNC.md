# BWW Auto-Sync auf KataBump

Endlos-Schleife: prüft alle **2 Minuten** auf neue Commits in `teamluan/BWW` (Branch `main`).
Bei neuem Commit wird der Code aktualisiert, Abhängigkeiten installiert und der Bot neu gestartet.
Sonst wird einfach 2 Minuten gewartet und erneut geprüft.

## Dateien

- `sync.js` — der Sync-Wrapper (neuer Startpunkt des Servers).
- `bot/` — der eigentliche BWW-Bot, wird von `sync.js` automatisch geklont und gepflegt.
- `backups/` — automatische Backups der KataBump-Dateien (nur beim allerersten Start).
- `.synced` — Zustandsdatei (markiert, ob der Erststart bereits durchgelaufen ist).

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

## Setup auf KataBump

1. **Startup**-Konfiguration auf `node sync.js` setzen (Startpunkt = `sync.js`, NICHT `src/index.js`).
2. `DISCORD_TOKEN` als Umgebungsvariable setzen (wie bisher).
3. Server starten. Beim ersten Start:
   - Backup aller vorhandenen Dateien → `backups/<zeitstempel>/`.
   - `sync.js` klont `teamluan/BWW` in `bot/`.
   - Installiert Abhängigkeiten (`npm install`).
   - Sicherheits-Check läuft.
   - Bot startet (`node bot/src/index.js`).
4. Ab jetzt alle 2 Minuten per `git fetch` prüfen.

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
