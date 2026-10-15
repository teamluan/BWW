# BWW Discord Bot

Discord.js-Bot mit zentraler Supabase-Konfiguration. Kein Web-Dashboard: `website/` (Next.js) wurde entfernt, einzige Quellen sind Discord-Commands (`src/`) und Supabase (`supabase/`).

## Architektur

- `src/` → Discord-Bot
- `supabase/migrations/` → versionierte Datenbank-Schemata (in Dateinamen-Reihenfolge ausführen)
- `bww_guild_settings` → zentrale Einstellungen pro Discord-Guild
- `bww_bot_status` → Bot-Status, Ping, Uptime und Mitgliederzahlen
- `bww_guilds` → Guild-Übersicht (wird vom Bot synchronisiert)

## Entfernt: Web-Dashboard

Das Dashboard (`website/`, Next.js) ist gelöscht. Es gibt keinen Vercel-Deploy mehr aus diesem Repository. Der Bot läuft unabhängig davon (eigener Server/Container mit `npm start`).

Der Discord-Befehl `/dashboard-code` antwortet nur noch mit einem Hinweis auf die Entfernung; Einstellungen werden ausschließlich über Discord-Commands geändert.

## Konfiguration

Bot-Einstellungen liegen in Supabase (`bww_guild_settings`), nicht in `config/*.json`.

Administratoren ändern Einstellungen über Discord:

- `/setup-welcome` → Welcome-Channel, Text und Titel
- `/setup-verify` → Verify-Channel, Rolle und Text
- `/setup-ticket` → Ticket-Kategorie und Support-Rolle
- `/setup-status` → Status-Embed einrichten
- `/setup-permission` → Rollenberechtigungen für Commands
- `/wartung` → Online/Wartung umschalten
- `/setup` → Übersicht der verfügbaren Verwaltungsbefehle

Der Bot lädt Einstellungen regelmäßig aus Supabase (einzige Quelle).

## Datenbank

Migrationen liegen versioniert unter `supabase/migrations/` in Dateinamen-Reihenfolge ausführen (`supabase db push` bzw. SQL-Editor). Hinweis: `bww_dashboard_*`-Tabellen bleiben aus Kompatibilität in den Migrationen, werden vom Bot aber nicht mehr für ein Dashboard verwendet (kein Login-Code-Flow mehr, kein `processDashboardActions`-Loop).

## Start (Bot)

1. Node.js 22+
2. `npm install`
3. `.env.example` → `.env` (`DISCORD_TOKEN`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`)
4. Supabase-Migration ausführen
5. `npm start`
