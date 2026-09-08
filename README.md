# BWW Discord Bot

Discord.js-Bot ohne Website und ohne Datenbank. Die Konfiguration wird lokal in `config/config.json` (plus `config/giveaways.json`, `config/panels.json`, `config/documents.json`) gespeichert.

## Funktionen
- `/nachricht text bild` sendet einen Container (Components V2) in den aktuellen Channel.
- Vollständiges Welcome-System mit `{user}`, `{username}`, `{displayname}`, `{server}`, `{id}`, `{count}`.
- Verify-System mit Button und frei wählbarer Verifizierungsrolle.
- Ticket-System mit Kategorie + Rolle, Select-Menü + Close-Button.
- **Custom Panels**: Bis zu 50 Buttons pro Panel, Components V2, speichern+senden, `panel-add-button` für unbegrenzt.
- **Dokumente/Werdegaenge**: Mehrere `.docx` Dokumente (z.B. `Bundeswehr Werdegang.docx` 25k → 7 Seiten), Auswahl-Embed `📚 Werdegang` mit Buttons/Select, paginierte V2 Container.
- **Status-Embed**: `🟢 Online`/`🔴 Offline`/`🟡 Wartung` in festem Channel (`/setup-status`, `/wartung`).
- Giveaway-System mit Teilnehmen/Verlassen, vorzeitigem Beenden und Reroll per Button.
- Moderations-Commands: `/kick`, `/ban`, `/unban`, `/timeout`, `/giverole`, `/removerole`.
- Rollenbezogene Command-Berechtigungen pro Command über `/setup-permission`.
- Administratoren dürfen das Setup verwalten und alle Commands benutzen.

## Start
1. Node.js installieren (22+).
2. `npm install`
3. `.env.example` zu `.env` kopieren und `DISCORD_TOKEN` eintragen.
4. `npm start` (`node sync.js` – startet Bot als Kindprozess mit Auto-Update)

Der Bot benötigt mindestens die Discord-Berechtigungen `View Channels`, `Send Messages`, `Embed Links`, `Manage Roles` sowie die Gateway Intents **Server Members Intent** (Welcome) und **Moderate Members** (Timeout). Für `/kick`, `/ban`, `/timeout`, `/giverole` und `/removerole` benötigt der Bot die jeweiligen Berechtigungen (Kick Members, Ban Members, Moderate Members, Manage Roles) und eine entsprechend hohe Rollenposition.

### Setup
- `/setup-welcome` → Channel + Welcome-Text (+ optional Titel).
- `/setup-verify` → Channel + Rolle + Verify-Text.
- `/setup-ticket` → Kategorie + Rolle.
- `/setup-status` → Channel für Status-Embed (🟢/🔴/🟡).
- `/setup-permission` → Rolle für einen Command erlauben/entfernen.
- `/verify` → konfiguriertes Verify-Panel senden.
- `/werdegang-setup` → Channel für Werdegang-Auswahl Embed.

## Commands
- `/nachricht text bild?` → Container senden (V2, mit MediaGallery für Bild).
- `/nachrichtauswahl text?` → Dokumenten-Auswahl-Panel (Buttons) mit optionalem Einleitungstext.
- `/ticket` → Ticket-Panel senden.
- `/giveaway preis dauer gewinner?` → Giveaway starten (Dauer in Sekunden).
- `/panel-create name intro button1_label button1_text ... (bis 10)` → Custom Panel speichern+senden (Components V2).
- `/panel-add-button name label text` → Button zu bestehendem Panel hinzufügen (bis 50, danach Select-Menü).
- `/panel-send name` → Gespeichertes Panel erneut senden.
- `/panel-delete name` → Panel + zugehörige Nachrichten löschen.
- `/panel-list` → Alle Panels listen.
- `/document-create name titel file:.docx` → Werdegang/Dokument aus .docx erstellen (auto-split 4000/Page).
- `/werdegang-setup channel` → Auswahl-Embed für alle Werdegaenge senden.
- `/document-list` / `/document-delete name` → Dokumente verwalten.
- `/setup-status channel` → Status-Embed erstellen.
- `/wartung aktiv grund?` → Wartungsmodus (🟡) an/aus.
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

## Panels & Dokumente
- **Panels**: `panel-create` speichert `intro` + bis zu 10 Buttons direkt, `panel-add-button` erweitert auf 50 (5×5, danach Select). `panel-delete` löscht auch alle gesendeten Nachrichten (max 20 pro Panel).
- **Werdegang**: `Bundeswehr Werdegang.docx` (25k → 7 Seiten à 4000) via `document-create`, Auswahl-Embed `📚` mit Buttons `bww_doc_select_<id>` → ephemeral Seite `1/7` + Nav `◀`/`▶`/`📚 Auswahl`.

## Status
- **🟢 Online** `0x57F287`, **🔴 Offline** `0xED4245`, **🟡 Wartung** `0xFEE75C` – `Container` V2 mit `Letztes Update: <t:...:R>` + `Uptime`.
- `/setup-status` legt Channel/Message fest, `/wartung aktiv:true grund:Update` setzt gelb, `aktiv:false` zurück auf grün, `SIGTERM`/`SIGINT` versucht rot.

## Rollensteuerung
Neue Commands (z. B. `/kick`, `/panel-create`) sind standardmäßig nur für Administratoren nutzbar. Weitere Rollen werden pro Command freigeschaltet:

```
/setup-permission command:kick role:@Moderator erlauben:true
/setup-permission command:panel-create role:@Moderator erlauben:true
/setup-permission command:document-create role:@Moderator erlauben:true
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
automatisch neu und löscht die Datei wieder. Lokal: `C:\Users\Steven\Downloads\BwW\BwW-Neustart.bat` (psftp) und `start-offline.bat` (SFTP + API `control.katabump.com` `ptlc_...`) für Offline-Start.

## Hinweise

- Kein `git` auf dem Server nötig — nur `node`, `npm` und Internet.
- `.env`, `config/config.json`, `config/giveaways.json`, `config/panels.json`, `config/documents.json`, `.deploy-sha` und `sync.js` selbst werden nie überschrieben (jetzt ohne `sync.js` in `SKIP_FILES` nach `3a06f07` doch überschrieben für Watchdog/Webhook).
  Darum bleiben Tokens und lokale Konfiguration erhalten.
- Der Stand wird in `.deploy-sha` gespeichert (letzter angewendeter Commit).
- Nach 5 Fehlern deaktiviert sich das Auto-Update selbst (Logs prüfen).
- Der Bot nutzt **keine Datenbank und kein Dashboard** — der gesamte Zustand liegt in
  `config/*.json` auf der Platte.
- **Components V2**: Alle Embeds sind jetzt `Container`+`TextDisplay`+`Section`/`MediaGallery` mit `flags: IsComponentsV2` (Discord API, `discord.js@14.25.0`).
