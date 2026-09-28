# BWW Discord Bot

Discord.js-Bot mit öffentlichem Dashboard und zentraler Supabase-Konfiguration.

## Architektur

- `src/` → Discord-Bot
- `website/` → Next.js-Dashboard
- `supabase/migrations/` → versionierte Datenbank-Schemata
- `bww_guild_settings` → zentrale Einstellungen pro Discord-Guild
- `bww_dashboard_logins` → temporäre Website-Zugangscodes
- `bww_bot_status` → Bot-Status, Ping, Uptime und Mitgliederzahlen
- `bww_guilds` → öffentliche Guild-Übersicht
- `bw_*` → ältere Dashboard-Tabellen; werden nur noch aus Kompatibilitätsgründen vorgehalten

## Konfiguration

Bot-Einstellungen werden nicht mehr aus `config/*.json` geladen.

Administratoren können die Einstellungen über Discord oder das Web-Dashboard ändern:

- `/setup-welcome` → Welcome-Channel, Text und Titel
- `/setup-verify` → Verify-Channel, Rolle und Text
- `/setup-ticket` → Ticket-Kategorie und Support-Rolle
- `/setup-status` → Status-Embed einrichten
- `/setup-permission` → Rollenberechtigungen für Commands
- `/wartung` → Online/Wartung umschalten
- `/dashboard-code` → 60-Minuten-Zugangscode für das Web-Dashboard
- `/setup` → Übersicht der verfügbaren Verwaltungsbefehle

Die Website unter `/settings` bearbeitet dieselben Werte. Der Bot lädt die Einstellungen regelmäßig aus Supabase, sodass Änderungen aus Discord und Website dieselbe zentrale Quelle verwenden.

## Website

Die Website liegt direkt in `website/` und verwendet Next.js 16.3.6.

Für Vercel: Repository importieren und **Root Directory = `website`** setzen.

Benötigte Website-Variablen:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxx
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxxxxxxx
BWW_DASHBOARD_SECRET=replace-with-a-long-random-secret
```

`SUPABASE_SECRET_KEY` und `BWW_DASHBOARD_SECRET` sind ausschließlich serverseitig zu setzen und dürfen nicht mit `NEXT_PUBLIC_` beginnen.

## Datenbank

Die zentrale Migration liegt unter:

```
supabase/migrations/20260928121000_bww_central_settings.sql
```

Sie legt bzw. pflegt die `bww_`-Tabellen und aktiviert RLS. Die öffentlichen Dashboard-Tabellen dürfen nur gelesen werden; Einstellungen und Dashboard-Codes sind nicht öffentlich erreichbar.

## Start

1. Node.js 22+
2. `npm install`
3. `.env.example` → `.env`
4. Supabase-Migration ausführen
5. `npm start`
