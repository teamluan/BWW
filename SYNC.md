# BWW Auto-Sync auf KataBump

Endlos-Schleife: prüft alle **2 Minuten** auf neue Commits in `teamluan/BWW` (Branch `main`).
Bei neuem Commit wird der Code aktualisiert, Abhängigkeiten installiert und der Bot neu gestartet.
Sonst wird einfach 2 Minuten gewartet und erneut geprüft.

## Dateien

- `sync.js` — der Sync-Wrapper (neuer Startpunkt des Servers).
- `bot/` — der eigentliche BWW-Bot, wird von `sync.js` automatisch geklont und gepflegt.

`config/config.json` und `.env` sind in `.gitignore` des Repos → sie werden bei jedem Sync **nicht**
überschrieben und bleiben erhalten.

## Setup auf KataBump

1. In der **Startup**-Konfiguration des Servers den Startbefehl auf `node sync.js` setzen.
   (Startpunkt = `sync.js`, NICHT `src/index.js`.)
2. `DISCORD_TOKEN` als Umgebungsvariable setzen (wie bisher).
3. Server starten. Beim ersten Start:
   - `sync.js` klont `teamluan/BWW` in den Unterordner `bot/`.
   - Installiert die Abhängigkeiten (`npm install`).
   - Startet den Bot (`node bot/src/index.js`).
4. Ab jetzt wird alle 2 Minuten per `git fetch` geprüft, ob sich `main` geändert hat.

## Ablauf pro Zyklus

```
Warten (2 Min)
  └─ git fetch origin main
       ├─ geändert? → reset --hard origin/main + npm install + Bot-Neustart
       └─ unverändert → warten (2 Min) → erneut prüfen
```

## Hinweise

- Benötigt **git**, `node` und `npm` auf dem Server.
- Lokale Änderungen in `bot/` (z. B. `.env`, `config/config.json`) bleiben erhalten.
- `git reset --hard` überschreibt alle *getrackten* Dateien mit dem GitHub-Stand. Beabsichtigte
  lokale Anpassungen gehören nach `config/` oder `.env` (beide nicht getrackt).
