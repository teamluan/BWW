# BWW – Release-Checkliste (Nr. 15 Final-Check, XXL-Plan abgeschlossen)

> **Entfernt 2026-10-15: Dashboard (website/) ist gelöscht.** Bot + Supabase bleiben einzige Quelle; Vercel-Deploy entfällt.

> Fertig-Kriterien aus `14_IMPLEMENTATION.md` (DB/RLS/Bot/Commands/Dashboard/Logs/Fehler/Permissions/Tests) – final abgehakt.
> Quelle Detail-Abhakung pro Modul: `docs/PHASE14_CHECKLISTE.md` (bleibt Referenz, hier Final-Siegel). Stand: main nach Nr. 15.

## 1. Fertig-Kriterien – alle Module ✅

| Kriterium | Ticket | Embed V2 | Welcome | Verification | Giveaway | Honeypot |
|---|---|---|---|---|---|---|
| DB vorhanden | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| RLS/Autorisierung | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bot-Funktion | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Slash Commands | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard (`website/`, entfernt) | - | - | - | - | - | - |
| Logs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Fehlerbehandlung | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Berechtigungen geprüft | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Relevante Tests bestehen | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Details je Modul (Tabellen/Commands/Seiten/Logs): `docs/PHASE14_CHECKLISTE.md` – alle Checkboxen `[x]`.

## 2. Plattform (Phase 8) ✅

> Dashboard-UI (website/) entfernt; Bot-seitige Services (Notifications/Audit/System-Logs in Supabase) bleiben und werden per Discord genutzt.

- [x] Realtime überall (`realtimeConfig` + Polling-Fallback 10s + Badge + `useRealtimeRefresh`)
- [x] Notifications-Center echt (`bww_notifications` + Best-Effort-Trigger + gelesen-Markierung)
- [x] Globale Suche (User/Ticket/Giveaway/Honeypot/Embed/Logs)
- [x] Statistiken (konsistente Counts via `website/lib/stats.js`)
- [x] Exporte (Bucket `bww-exports`, CSV/JSON, Permission + Audit-Log)
- [x] Systemmonitoring live (Bot uptime/latenz/guilds, DB Counts + Latenz)
- [x] Error Center (Filter level/module, Resolve/Mark, Sanitizer – keine Secrets)

## 3. Tests (Phase 9) ✅

- [x] `tests/bot.test.js` – Command/Interaction/Event/Permission
- [ ] `tests/dashboard.test.js` - ENTFERNT mit `website/`
- [x] `tests/supabase.test.js` – Schema/Constraint/RLS/Query
- [x] `tests/integration.test.js` - Bot->DB, Commands->DB, kein website-Import
- [x] `npm test` (`node --test tests/*.test.js`) ohne Secrets (Mocks) – grün erforderlich vor Release
- [x] Doku `docs/TESTING.md`

## 4. Struktur (Nr. 15) ✅

- [x] Ist vs. Soll geprüft (`docs/STRUCTURE.md`): alle 6 Module je `commands`+`modules`, alle 6 Events, alle 8 Services + dokumentierte Extras (`discord`/`validation`/`notifications`), kein `website/` mehr (Dashboard entfernt), `migrations`/`functions`/`seed` vorhanden
- [x] Dashboard entfernt: `website/` gelöscht (155 Dateien), kein Vercel-Deploy, kein `.js` -> `.ts` Rewrite
- [x] Platzhalter-Dokus bereinigt: `src/commands/*/README.md` + `src/modules/*/README.md` + `supabase/functions|seed/README.md` als Ist-Doku (keine "Platzhalter Phase 1" mehr)
- [x] Legacy dokumentiert (`docs/LEGACY.md`), nichts ohne Not gelöscht
- [x] Import-Pfade stabil (keine Moves, keine Pfad-Anpassungen nötig)

## 5. Deploy-Readiness ✅

- [x] `npm test` grün (Root, ohne Secrets)
- [x] Build/Lint-Smoke: `npm run check` (`node --check` alle JS, CI-Job `check`) + `npm test` (CI-Job `test`) - grün erforderlich
- [x] Bot startet ohne Secrets-Crash: `src/index.js` prüft `DISCORD_TOKEN` + `databaseConfigured()`-Guards (ohne Keys: klare Fehlermeldung / Offline-Modus, kein Crash mit Stack-Leak)
- [x] `.env.example` vollständig (Root: `DISCORD_TOKEN`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `AUTO_UPDATE*`, `LOG_WEBHOOK_*` optional; `website/.env.example` entfällt (Dashboard entfernt)) – keine Secrets im Repo
- [x] README Deploy-Hinweise: kein Vercel-Deploy (Dashboard entfernt), Supabase-Migrationen in Dateinamen-Reihenfolge, Discord-Bot-Start (`npm start` / `npm run bot`), Node 22+ (Root-`README.md` + `website/README.md`)

## 6. XXL-Plan – alle 15 Nummern abgeschlossen ✅

- [x] 01 Architektur – `docs/PHASE1_FUNDAMENT.md`, `src/services/*`, `website/lib/*`
- [x] 02 Datenbank – `supabase/migrations/20261003130000_bww_phase2_database.sql` + `bww_`-Prefix + RLS
- [x] 03 Tickets – `src/modules/ticket/*`, `src/commands/ticket/*`, `website/app/tickets/*`
- [x] 04 Honeypot – `src/modules/honeypot/*`, `src/commands/honeypot/*`, `website/app/honeypot/*`
- [x] 05 Embed V2 – `src/modules/embed/*`, `src/commands/embed/*`, `website/app/embeds/*`
- [x] 06 Welcome – `src/modules/welcome/*`, `src/commands/welcome/*`, `website/app/welcome/*`
- [x] 07 Giveaways – `src/modules/giveaway/*`, `src/commands/giveaway/*`, `website/app/giveaways/*`
- [x] 08 Verification – `src/modules/verification/*`, `src/commands/verification/*`, `website/app/verification/*`
- [x] 09 Commands – unified Registry (`src/commands/index.js` + modulare Ordner), Loader, Tests
- [x] 10 Dashboard - ENTFERNT (`website/` gelöscht, s. Commit-Historie)
- [x] 11 Permissions – Matrix (`permissions.js` + `guards.js`), RLS, Tests
- [x] 12 API - ENTFERNT mit `website/` (Bot nutzt Supabase direkt, s. `docs/API.md`)
- [x] 13 Security – `docs/SECURITY.md`, Sanitizer, CSRF, Rate-Limit, keine Secrets im Browser, Audit
- [x] 14 Implementation/Plattform/Tests – `docs/PHASE14_CHECKLISTE.md`, Plattform-Migration, `tests/*`, `docs/TESTING.md`
- [x] 15 Folder-Structure/Final-Check – `docs/STRUCTURE.md`, `docs/LEGACY.md`, diese Checkliste (keine Features, nur Struktur + Deploy-Readiness)

## Release-Freigabe

- Voraussetzungen: `npm test` grün, `npm run check` grün, kein Website-Build (entfernt), Rest grün (CI), `.env` aus `.env.example` befüllt (keine Secrets committen), Migrationen in Reihenfolge ausgeführt.
- Danach: Bot-Start (`npm start`), Smoke (Discord-Commands, Supabase-Daten, Logs).
