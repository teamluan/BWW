# BWW – TESTING (Phase 14: Test & Hardening)

> **Entfernt 2026-10-15: Dashboard-Tests (	ests/dashboard.test.js) sind mit website/ gelöscht.** Bot-Tests (ot, supabase, integration) bleiben ohne Secrets/Mocks.

> Wie laufen, was abgedeckt, Fertig-Kriterien-Checkliste pro Modul.
> Ohne Secrets: alle Tests nutzen Mocks/Datei-Checks, kein Discord-Login, kein Netzwerk.

## Laufen

```bash
# alle Tests (Root)
npm test
# entspricht: node --test tests/*.test.js
# einzeln:
node --test tests/bot.test.js
node --test tests/supabase.test.js
node --test tests/integration.test.js
```

Voraussetzungen: Node >= 22 (siehe Root-`package.json`). Keine `.env`, keine Supabase/Discord-Keys nötig.

## Was abgedeckt ist

### Bot (`tests/bot.test.js`)
- Command Tests: alle unified Commands (Guild/BWW/Discord/Validation/Ergebnis) – `src/commands/*` + `COMMAND_PERMISSION_MAP`
- Interaction Tests: Button/Select/Modal-Prefixe (`BUTTON_PERMISSION_PREFIXES`) ohne Doppel-Handling (eindeutig, Self-Service `null` vs. Gate)
- Event Tests: `messageCreate`/`guildMemberAdd`/`interactionCreate`-Reihenfolge in `src/index.js`
- Permission Tests: Matrix (`src/services/permissions.js`) – Viewer darf nicht managen, gefährliche Aktion ohne Discord-Perm blockiert

### Supabase (`tests/supabase.test.js`)
- Schema Checks: alle `bww_*`-Tabellen + Spalten aus 02-08 + Plattform (`bww_notifications`, `bww_system_logs`, Bucket `bww-exports`)
- Constraint Checks: Status-CHECKs, `winner_count`, UNIQUE (`code_hash` u.a.)
- RLS Checks: Guild-Isolation (`bww_can_access_guild`), anon/authenticated denied ohne Grant, service_role ok
- (Entfernt) Scoped-Loader-Checks entfielen mit `website/`.

### Dashboard (entfernt)

	ests/dashboard.test.js ist mit website/ gelöscht; Bot-Tests (ot, supabase, integration) bleiben.

### Integration (`tests/integration.test.js`)
- (Entfernt) Dashboard-Checks entfielen mit `website/`; neu: Bot ohne `website/`-Import (Guard-Test).
- Bot→DB: Services schreiben `bww_*` (`database.js`, `notifications.js`, `system_logs`)
- (Entfernt) Realtime-Checks entfielen mit `website/` (Polling-Fallback war Dashboard-UI).
- Commands→DB: Slash schreibt gleiche Tabellen (`ticketService`, `giveawayService`)

## Plattform (Phase 8) – wo zu prüfen

> Dashboard-UI entfernt; Bot-seitige Services (Supabase) bleiben und werden per Discord genutzt.

- Realtime: `website/lib/realtime.js` + `useRealtimeRefresh.js` + `RealtimeBadge` auf Dashboard/System-Seiten (Polling 10s Fallback)
- Notifications: `bww_notifications` echt (`src/services/notifications.js` Best-Effort aus Ticket/Honeypot/Giveaway/Verification/System) + Center mit gelesen-Markierung (`/api/dashboard/notifications` PATCH)
- Globale Suche: User/Ticket/Giveaway/Honeypot/Embed/Logs (`website/lib/search.js`, `/search`, `/api/dashboard/search`)
- Statistiken: konsistente Counts (`website/lib/stats.js`, Startseite + Modul-Seiten)
- Exporte: CSV/JSON für Tickets/Logs/Transcripts/Giveaway-Teilnehmer (Bucket `bww-exports`, `/api/dashboard/exports` mit `logs.view`/`audit.view` + Audit-Log)
- Systemmonitoring: Bot-Status (uptime/latenz/guilds aus Heartbeat `src/index.js` → `bww_bot_status`), DB-Status (Erreichbarkeit + Tabellen-Counts + Latenz), live auf `system/bot|database`
- Error Center: `bww_system_logs` mit Filter level/module, Resolve/Mark (`/api/dashboard/system/resolve`, `system.manage`), keine Secrets (Sanitizer Phase 13)

## Fertig-Kriterien pro Modul (Checkliste)

Ein Modul gilt erst als fertig, wenn (siehe `docs/PHASE14_CHECKLISTE.md`):

- [ ] DB vorhanden
- [ ] RLS/Autorisierung vorhanden
- [ ] Bot-Funktion funktioniert
- [ ] Slash Commands funktionieren
- [ ] ~~Dashboard~~ (entfernt, `website/` gelöscht)
- [ ] Logs vorhanden sind
- [ ] Fehlerbehandlung vorhanden ist
- [ ] Berechtigungen geprüft werden
- [ ] relevante Tests bestehen (`npm test` grün)

Siehe Details + Abhakung pro Modul in `docs/PHASE14_CHECKLISTE.md`.
