# BWW Discord Bot

Discord.js-Bot mit öffentlichem Dashboard und Supabase-Datenbank.

## Architektur

- `src/` → Discord-Bot
- `website/` → Next.js-Dashboard
- `supabase/migrations/` → versionierte Datenbank-Schemata
- `config/*.json` → lokale Bot-Konfiguration, bis die jeweiligen Systeme vollständig migriert sind
- Supabase speichert Bot-Status und die öffentliche Guild-Übersicht.
- Die Website liest ausschließlich öffentliche, per RLS freigegebene Daten.
- Der Bot verwendet ausschließlich serverseitig `SUPABASE_SECRET_KEY`.

## Website

Die Website liegt direkt in `website/` und verwendet Next.js 16.3.6.

Lokal:

```bash
cd website
npm install
copy .env.example .env.local
npm run dev
```

Für Vercel: Repository importieren und **Root Directory = `website`** setzen.

Benötigte Website-Variablen:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxx
```

Die Supabase Secret Key darf niemals in die Website-Umgebung oder ins Frontend gelangen.

## Datenbank

Die Migration liegt unter:

```
supabase/migrations/20260926190000_bww_dashboard.sql
```

Sie erstellt:

- `bww_bot_status` → Online-/Offline-Status, Ping, Uptime und Mitgliederzahlen
- `bww_guilds` → öffentliche Guild-Übersicht

RLS ist aktiviert. Die Website darf nur lesen; Schreibrechte bleiben beim Bot.

**Hinweis:** Neue Tabellen im öffentlichen Schema werden bei Supabase nicht mehr automatisch über die Data API freigegeben. Die Migration setzt die benötigten Grants explizit. citeturn0search1turn0search5

## Bot-Datenbank-Synchronisierung

Wenn `SUPABASE_URL` und `SUPABASE_SECRET_KEY` gesetzt sind, synchronisiert der Bot:

- beim Start
- alle 30 Sekunden
- beim Betreten/Verlassen eines Guilds

Beim Herunterfahren wird der Status auf `offline` gesetzt.

## Start

1. Node.js 22+
2. `npm install`
3. `.env.example` → `.env`
4. Supabase-Migration ausführen
5. `npm start`

Weitere Bot-Funktionen und Commands stehen weiter unten in dieser Dokumentation.


<!-- mirror-sync-test-2026-09-27 -->