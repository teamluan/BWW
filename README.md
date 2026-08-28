# BWW Discord Bot

Discord.js-Bot ohne Website und ohne Datenbank. Die Konfiguration wird lokal in `config/config.json` gespeichert.

## Funktionen
- `/nachricht text bild` sendet einen Embed in den aktuellen Channel.
- Vollständiges Welcome-System mit `{user}`, `{username}` und `{server}`.
- Verify-System mit Button und frei wählbarer Verifizierungsrolle.
- Setup für Welcome-Channel/Text, Verify-Channel/Text/Rolle und Rollenberechtigungen für Commands.
- Giveaway-System mit Teilnehmen/Verlassen, vorzeitigem Beenden und Reroll per Button.
- Moderations-Commands: `/kick`, `/ban`, `/unban`, `/timeout`, `/giverole`, `/removerole`.
- Rollenbezogene Command-Berechtigungen pro Command über `/setup-permission`.
- Administratoren dürfen das Setup verwalten und alle Commands benutzen.

## Start
1. Node.js installieren.
2. `npm install`
3. `.env.example` zu `.env` kopieren und `DISCORD_TOKEN` eintragen.
4. `npm start`

Der Bot benötigt mindestens die Discord-Berechtigungen `View Channels`, `Send Messages`, `Embed Links`, `Manage Roles` sowie die Gateway Intents **Server Members Intent** (Welcome) und **Moderate Members** (Timeout). Für `/kick`, `/ban`, `/timeout`, `/giverole` und `/removerole` benötigt der Bot die jeweiligen Berechtigungen (Kick Members, Ban Members, Moderate Members, Manage Roles) und eine entsprechend hohe Rollenposition.

### Setup
- `/setup-welcome` → Channel + Welcome-Text.
- `/setup-verify` → Channel + Rolle + Verify-Text.
- `/setup-ticket` → Kategorie + Rolle.
- `/setup-permission` → Rolle für einen Command erlauben/entfernen.
- `/verify` → konfiguriertes Verify-Panel senden.

## Commands
- `/nachricht text bild?` → Embed senden.
- `/nachrichtauswahl text?` → Dokumenten-Auswahl-Panel (Buttons) mit optionalem Einleitungstext.
- `/ticket` → Ticket-Panel senden.
- `/giveaway preis dauer gewinner?` → Giveaway starten (Dauer in Sekunden).
- `/restart` → Bot neu starten (nur Administrator).
- `/kick user grund?` → Mitglied kicken.
- `/ban user grund?` → Benutzer bannen.
- `/unban user` → Benutzer entbannen.
- `/timeout user dauer grund?` → Mitglied für `dauer` Minuten pausieren.
- `/giverole user rolle` → Rolle vergeben.
- `/removerole user rolle` → Rolle entfernen.

## Giveaway
- **🎉 Teilnehmen** und **❌ Verlassen** steuern die Teilnahme (Teilnehmerzahl wird live aktualisiert).
- **⏹️ Beenden** beendet das Giveaway vorzeitig und zieht die Gewinner.
- Nach dem Ende erscheint **🔁 Neu ziehen** für einen neuen Gewinner.
- Beenden/Reroll sind nur für Administratoren oder Rollen mit `giveaway`-Berechtigung möglich.

## Rollensteuerung
Neue Commands (z. B. `/kick`) sind standardmäßig nur für Administratoren nutzbar. Weitere Rollen werden pro Command freigeschaltet:

```
/setup-permission command:kick role:@Moderator erlauben:true
/setup-permission command:ban role:@Moderator erlauben:true
/setup-permission command:giveaway role:@Moderator erlauben:true
```

---

# Auto-Update auf KataBump

`sync.js` ist der Startpunkt (eine Startdatei): Es startet den Bot (`node src/index.js`)
als Kindprozess und aktualisiert den Code automatisch über die **GitHub-API** — ganz ohne
lokales git. Es vergleicht den letzten Commit (`base...main`) und lädt nur die geänderten
Dateien als Raw-Download herunter, entfernt gelöschte Dateien und startet nach einem Update neu.

## Aktivierung (env-gesteuert)

In den Umgebungsvariablen (oder `.env`):

```dotenv
AUTO_UPDATE=true
AUTO_UPDATE_INTERVAL_MS=120000   # Standard 2 Minuten
```

- `AUTO_UPDATE=true` → Auto-Update aktiv.
- `AUTO_UPDATE_INTERVAL_MS` → Prüf-Intervall in Millisekunden.

## Einrichtung auf KataBump

1. **Startdatei = `sync.js`** (die einzige gestartete Datei).
2. `DISCORD_TOKEN` als Umgebungsvariable setzen.
3. `AUTO_UPDATE=true` setzen.
4. Server starten.

Beim ersten Start installiert `sync.js` alle Repo-Dateien (Erstinstallation) und startet den Bot.
Ab dann läuft die Endlos-Schleife über die API.

## Ablauf pro Zyklus

```
Warten (Intervall, Standard 2 Min)
  └─ GitHub-API: compare {letzter SHA}...main
       ├─ geändert? → geänderte Dateien laden + npm install (falls package.json) + Neustart
       └─ unverändert → warten → erneut prüfen
```

## Neustart

Der Bot lässt sich über `/restart` (nur Administrator) nur neu starten. Zusätzlich überwacht
`sync.js` eine Watchdog-Datei: Legt man auf dem Server eine Datei mit dem Namen
`restart.requested` im Container-Root an, startet der Bot beim nächsten Check (alle 3 Sekunden)
automatisch neu und löscht die Datei wieder.

## Hinweise

- Kein `git` auf dem Server nötig — nur `node`, `npm` und Internet.
- `.env`, `config/config.json`, `.deploy-sha` und `sync.js` selbst werden nie überschrieben.
  Darum bleiben Tokens und lokale Konfiguration erhalten.
- Der Stand wird in `.deploy-sha` gespeichert (letzter angewendeter Commit).
- Nach 5 Fehlern deaktiviert sich das Auto-Update selbst (Logs prüfen).
- Der Bot nutzt **keine Datenbank und kein Dashboard** — der gesamte Zustand liegt in
  `config/config.json` auf der Platte.
