# BWW – PHASE 14 CHECKLISTE (Plattform + Tests)

> Fertig-Kriterien pro Modul (DB/RLS/Bot/Commands/Dashboard/Logs/Fehler/Permissions/Tests).
> Quelle: `14_IMPLEMENTATION.md` Fertig-Kriterien. Stand: Phase 1-13 auf main, Nr. 14 hiermit umgesetzt.
> Keine neue Modul-Business-Logik – nur Plattform (website/lib + Bot-Scheduler wo fehlend, dünn) + Tests.

## Vorher-Stand (Lücken vor Nr. 14)

- Realtime: Pattern (realtimeConfig + Polling 10s + Badge) auf Dashboard/System vorhanden, aber kein shared Hook; einige Seiten ohne Badge.
- Notifications: `bww_notifications`-Lesen mit derived-Fallback vorhanden, aber Bot schrieb nie echt (kein Trigger aus Modulen).
- Globale Suche: `website/lib/search.js` + `/search` + API vorhanden (User/Ticket/Giveaway/Honeypot/Embed/Logs) – kein Gap, nur Doku.
- Statistiken: Home-Aggregation vorhanden, aber keine zentrale `stats.js` (Counts potentiell inkonsistent je Seite).
- Exporte: LÜCKE – kein `bww-exports` Bucket, keine CSV/JSON-Routen, kein Audit-Log für Exporte.
- Systemmonitoring: Bot/DB/Errors-Seiten live, aber DB ohne Tabellen-Counts; Heartbeat (30s `upsertBotStatus`) vorhanden.
- Error Center: Basis-Liste vorhanden, aber ohne Filter level/module, ohne Resolve/Mark, ohne Sanitizer-Hinweis.
- Tests: LÜCKE – kein `tests/`-Ordner, kein `test`-Script in `package.json` (Root/Website).

## Was Nr. 14 liefert (Dateien)

- `supabase/migrations/20261003220000_bww_phase14_platform.sql` – `bww_notifications` + `bww_system_logs` Resolve-Spalten + Bucket `bww-exports` + RLS-Guards
- `src/services/notifications.js` – Best-Effort-Trigger (nie werfend) + Wire in Ticket/Honeypot/Giveaway
- `website/lib/stats.js` – zentrale Modul-Stats (konsistente Counts)
- `website/lib/exports.js` + `website/app/api/dashboard/exports/route.js` – CSV/JSON-Exporte mit Permission + Audit-Log
- `website/lib/useRealtimeRefresh.js` – shared Realtime-Hook (Pattern Phase 10)
- `website/lib/system.js` (erweitert) – DB-Tabellen-Counts + Latenz live
- `website/app/system/errors/page.js` (erweitert) + `website/app/api/dashboard/system/resolve/route.js` – Error Center mit Filter + Resolve/Mark + Sanitizer
- `tests/*.test.js` + `npm test` + `docs/TESTING.md` – automatisierte Tests ohne Secrets (Mocks)

## Fertig-Kriterien je Modul

### Ticket
- [x] DB vorhanden (`bww_tickets`, Panels/Types/Members/Messages/Actions/Templates)
- [x] RLS/Autorisierung vorhanden (Guild-Isolation, service_role, Matrix `ticket.*`)
- [x] Bot-Funktion funktioniert (Claim/Add/Close/Reopen/Delete/Transcript/Autoclose)
- [x] Slash Commands funktionieren (unified `ticket-*`, Tests grün)
- [x] Dashboard funktioniert (Übersicht/Panels/Transcripts/Stats mit Realtime + Badge)
- [x] Logs vorhanden (`bww_ticket_actions`, Audit, Notifications `ticket_closed`)
- [x] Fehlerbehandlung vorhanden (deutsche Messages, `{success:false,error:{code}}`, Error Center)
- [x] Berechtigungen geprüft (Staff/Matrix/Legacy, Viewer kein manage – Tests grün)
- [x] relevante Tests bestehen (`tests/bot.test.js`, `tests/supabase.test.js`, `tests/dashboard.test.js`, `tests/integration.test.js`)

### Embed V2
- [x] DB vorhanden (`bww_embeds`, Components/Actions/Buttons/Select-Options, Templates)
- [x] RLS/Autorisierung vorhanden (Guild-Scope, `embed.*`)
- [x] Bot-Funktion funktioniert (Builder/Preview/Components/Send/Clone)
- [x] Slash Commands funktionieren (`embed`, `nachricht`, Panel-Commands)
- [x] Dashboard funktioniert (Builder/Templates/Gesendete, Suche findet Embeds)
- [x] Logs vorhanden (Audit, System)
- [x] Fehlerbehandlung vorhanden (Validation deutsch, Error Center)
- [x] Berechtigungen geprüft (`embed.view` vs. `embed.send/delete`)
- [x] relevante Tests bestehen

### Welcome
- [x] DB vorhanden (`bww_welcome`, Variables, Logs)
- [x] RLS/Autorisierung vorhanden (`welcome.*`)
- [x] Bot-Funktion funktioniert (Join-Event, Variablen, DM, Auto-Role)
- [x] Slash Commands funktionieren (`setup-welcome`)
- [x] Dashboard funktioniert (Settings/Builder/Stats, konsistente Counts via `stats.js`)
- [x] Logs vorhanden (`bww_welcome_logs`, System-Fehler bei Sendefehlern)
- [x] Fehlerbehandlung vorhanden
- [x] Berechtigungen geprüft
- [x] relevante Tests bestehen

### Verification
- [x] DB vorhanden (`bww_verification`, Users/Attempts/Codes/Logs, Expires + Cleanup)
- [x] RLS/Autorisierung vorhanden (`verification.*`, Replay-Schutz)
- [x] Bot-Funktion funktioniert (Channel/Rollen/Flow/Codes/Rate-Limits)
- [x] Slash Commands funktionieren (`verify`, `setup-verify`)
- [x] Dashboard funktioniert (Settings/Users/Logs, Suche findet User)
- [x] Logs vorhanden + Notifications (`verification` via `notifyVerification` Best-Effort)
- [x] Fehlerbehandlung vorhanden
- [x] Berechtigungen geprüft
- [x] relevante Tests bestehen

### Giveaway
- [x] DB vorhanden (`bww_giveaways`, Entries/Winners/Requirements/Rerolls, `winner_count`)
- [x] RLS/Autorisierung vorhanden (`giveaway.*`, Scoped-Loader + Ownership-Guard)
- [x] Bot-Funktion funktioniert (Create/Join/Requirements/Scheduler/End/Winner/Reroll)
- [x] Slash Commands funktionieren (`giveaway`, `giveaway-end/reroll/cancel/list`)
- [x] Dashboard funktioniert (Aktiv/Vergangen/Settings, Teilnehmer-Export)
- [x] Logs vorhanden + Notifications (`giveaway_ended` Best-Effort)
- [x] Fehlerbehandlung vorhanden
- [x] Berechtigungen geprüft
- [x] relevante Tests bestehen

### Honeypot
- [x] DB vorhanden (`bww_honeypots`, Triggers/Exemptions/Events, Stats)
- [x] RLS/Autorisierung vorhanden (`honeypot.*`)
- [x] Bot-Funktion funktioniert (Detection/Exemptions/Actions/Logs)
- [x] Slash Commands funktionieren (`setup-honeypot`)
- [x] Dashboard funktioniert (Übersicht/Hits/Ausnahmen, Suche findet Treffer)
- [x] Logs vorhanden + Notifications (`honeypot_triggered` Best-Effort) + System-Log
- [x] Fehlerbehandlung vorhanden (Bot-Perms geprüft, nie werfend)
- [x] Berechtigungen geprüft
- [x] relevante Tests bestehen

### Plattform (Phase 8)
- [x] Realtime überall (`realtimeConfig` + Polling-Fallback + Badge + `useRealtimeRefresh`)
- [x] Notifications-Center echt (`bww_notifications` + Trigger + gelesen-Markierung)
- [x] globale Suche (User/Ticket/Giveaway/Honeypot/Embed/Logs)
- [x] Statistiken (Startseite + Modul-Seiten, konsistente Counts via `stats.js`)
- [x] Exporte (Bucket `bww-exports`, CSV/JSON, Permission + Audit-Log)
- [x] Systemmonitoring live (Bot uptime/latenz/guilds, DB Erreichbarkeit + Counts + Latenz)
- [x] Error Center (Filter level/module, Resolve/Mark, Sanitizer – keine Secrets)

### Tests (Phase 9)
- [x] Bot: Command/Interaction/Event/Permission (`tests/bot.test.js`)
- [x] Supabase: Schema/Constraint/RLS/Query (`tests/supabase.test.js`)
- [x] Dashboard: Login/Guild/Permissions/Forms/Errors/Mobile (`tests/dashboard.test.js`)
- [x] Integration: Dashboard→DB, Bot→DB, DB→Dashboard Realtime, Commands→DB (`tests/integration.test.js`)
- [x] `npm test` grün ohne Secrets (Mocks), Doku `docs/TESTING.md`

## Nächstes (Nr. 15 = 15_FOLDER_STRUCTURE.md Final-Check)

- Final-Check Ordnerstruktur + Benennung (keine Business-Logik mehr)
- `npm test` muss grün bleiben; bei Struktur-Änderungen Tests/Pfade nachziehen
- Danach: Release/Deploy-Readiness (Env-Beispiel, Build/Lint Smoke)
