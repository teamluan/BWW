# BWW Discord Bot

 Discord.js-Bot mit zentraler Supabase-Konfiguration. Kein Web-Dashboard: `website/` (Next.js) wurde entfernt, einzige Quellen sind Discord-Commands (`src/`) und Supabase (`supabase/`).

 ## Architektur

 - `src/` [[arr]] Discord-Bot (Commands/Events/Module/Services, vgl. `docs/STRUCTURE.md`)
 - `supabase/migrations/` [[arr]] versionierte Datenbank-Schemata (in Dateinamen-Reihenfolge ausführen)
 - `bww_guild_settings` [[arr]] zentrale Einstellungen pro Discord-Guild
 - `bww_bot_status` [[arr]] Bot-Status, Ping, Uptime und Mitgliederzahlen
 - `bww_guilds` [[arr]] Guild-[[UE]]bersicht (wird vom Bot synchronisiert)
 - `bw_*` [[arr]] Ältere Tabellen; werden nur noch aus KompatibilitÄtsgründen vorgehalten (vgl. `docs/LEGACY.md`)

 Struktur/Prinzip: `docs/STRUCTURE.md` Ä Legacy: `docs/LEGACY.md` Ä Release: `docs/RELEASE_CHECKLIST.md`.

 ## Entfernt: Web-Dashboard

 Das Dashboard (`website/`, Next.js) ist gelöscht. Es gibt keinen Vercel-Deploy mehr aus diesem Repository (kein `vercel.json`, kein Website-Build in der CI). Falls in der Vercel-UI noch **Root Directory = `website`** eingetragen ist: Vercel-Projekt pausieren/löschen oder auf ein anderes Repository zeigen lassen - per Git lÄsst sich die Vercel-UI-Einstellung nicht Ändern. Der Bot lÄuft unabhÄngig davon (eigener Server/Container mit `npm start`).

 Der Discord-Befehl `/dashboard-code` antwortet nur noch mit einem Hinweis auf die Entfernung; Einstellungen werden ausschließlich über Discord-Commands geÄndert.

 ## Konfiguration

 Bot-Einstellungen liegen in Supabase (`bww_guild_settings`), nicht in `config/*.json`.

 Administratoren Ändern Einstellungen über Discord:

 - `/setup-welcome` [[arr]] Welcome-Channel, Text und Titel
 - `/setup-verify` [[arr]] Verify-Channel, Rolle und Text
 - `/setup-ticket` [[arr]] Ticket-Kategorie und Support-Rolle
 - `/setup-status` [[arr]] Status-Embed einrichten
 - `/setup-permission` [[arr]] Rollenberechtigungen für Commands
 - `/wartung` [[arr]] Online/Wartung umschalten
 - `/setup` [[arr]] [[UE]]bersicht der verfügbaren Verwaltungsbefehle

 Der Bot lÄdt Einstellungen regelmÄßig aus Supabase (einzige Quelle).

 ## Datenbank

 Migrationen liegen versioniert unter `supabase/migrations/`:

 ```text
 supabase/migrations/20260926190000_bww_dashboard.sql
 ... (chronologisch, inkl. Phase 1-8 Upgrades)
 20261003220000_bww_phase14_platform.sql   # Plattform (Notifications/System/Exports)
 ```

 In Dateinamen-Reihenfolge ausführen (Supabase CLI/Studio: `supabase db push` bzw. SQL-Editor). Seed nur lokal/Test: `supabase/seed/bww_phase2_examples.sql` (keine echten Daten). Hinweis: `bww_dashboard_*`-Tabellen bleiben aus KompatibilitÄt in den Migrationen, werden vom Bot aber nicht mehr für ein Dashboard verwendet (kein Login-Code-Flow mehr).

 ## Start (Bot)

 1. Node.js 22+
 2. `npm install`
 3. `.env.example` [[arr]] `.env` (`DISCORD_TOKEN`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`; optional `AUTO_UPDATE*`, `LOG_WEBHOOK_*` - keine Secrets committen)
 4. Supabase-Migrationen in Reihenfolge ausführen (s. oben)
 5. `npm start` (via `sync.js`) bzw. `npm run bot` (`src/index.js` direkt)

 Ohne `DISCORD_TOKEN` bricht der Bot mit klarer Fehlermeldung ab; ohne Supabase-Keys lÄuft er im Offline-Guard (`databaseConfigured()`).

 ## Tests & Checks

 ```bash
 npm test        # node --test tests/*.test.js (ohne Secrets, Mocks) - grün erforderlich
 npm run check   # node --check alle JS-Dateien
 ```

 Details: `docs/TESTING.md`, final: `docs/RELEASE_CHECKLIST.md`.