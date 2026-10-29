# BWW – Phase 1 Fundament (XXL-Plan Nr. 1)

Quelle: `01_ARCHITECTURE.md` (Komponente Nr. 1), `14_IMPLEMENTATION.md` Phase 1,
`15_FOLDER_STRUCTURE.md`, Grundregeln aus `README.md` (`bww_`-Prefix, Single Source of Truth).

## Repo-Status vorher (Branch `main`)

- Bot: `src/index.js` (monolithisch), `src/commands/index.js`, `src/events/interactions.js` +
  `welcome.js`, `src/utils/*` (database, embeds, tickets, giveaway, honeypot …), `src/logger.js`
- Dashboard: Next.js in `website/` (`app/`, `components/dashboard-shell.js`, `lib/dashboard.js`)
  – **nicht** `dashboard/` (Vercel Root Directory = `website`, siehe Root-README). Daher wird
  `15_FOLDER_STRUCTURE: dashboard/` als `website/` umgesetzt, `lib/{supabase,discord,permissions,api}`
  als Dateien in `website/lib/`.
- Supabase: `supabase/migrations/*.sql` (`bww_`-Tabellen + RLS), kein `functions/`/`seed/`.
- Es fehlen: `src/services/`, `src/modules/`, Loader, Event-Split
  (`ready/interactionCreate/guildCreate/guildDelete/guildMemberAdd/messageCreate.js`),
  `website/middleware`, `website/lib`-Splits, `website/components/ui`.

## Was Phase 1 hinzufügt (nur Fundament, keine Modul-Logik aus 03–08)

- `src/services/`: `supabase, permissions, logger, audit, variables, cache, scheduler,`
  `messageBuilder` (+ `discord`, `validation` aus 01 Kap. 4) + `index.js`-Barrel + README
- `src/loaders/`: `commandLoader.js`, `eventLoader.js`
- `src/events/`: `ready/interactionCreate/guildCreate/guildDelete/guildMemberAdd/messageCreate.js`
  als dünne Hüllen um Bestand (`interactions.js`, `welcome.js`, `database.js`) – kein Doppel-Handling,
  `src/index.js` bleibt vorerst kanonisch
- `src/modules/{ticket,honeypot,embed,welcome,giveaway,verification}/README.md` (Platzhalter)
- `src/commands/{ticket,honeypot,embed,welcome,giveaway,verification}/README.md` (Platzhalter)
- `supabase/migrations/20261003120000_bww_phase1_fundament.sql` (idempotent: `bww_audit_logs` +
  Sicherstellung `bww_guilds/settings/bot_status` + RLS) + `functions/`- + `seed/`-Platzhalter
- `website/`: `middleware.js` (JS statt `middleware.ts`, Repo ist JS), `lib/{supabase,permissions,discord,api}.js`
  als Hüllen um `lib/dashboard.js`, `components/ui/{button,card}.js` + README

## Datenfluss / Single Source of Truth

```text
Discord Interaction -> BWW Bot -> Service Layer -> Supabase -> PostgreSQL/Realtime/Storage -> Dashboard
Dashboard --\
            > Supabase (bww_-Tabellen)
Commands ---/
```

## Nächster Schritt (Nr. 2)

`02_DATABASE.md` – vollständiges Datenmodell aller `bww_`-Tabellen + RLS + Seeds,
aufbauend auf diesem Fundament (Services + Migration oben bleiben kompatibel).
