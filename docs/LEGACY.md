# BWW – Legacy (bewusst erhalten, Nr. 15 Final-Check)

> NICHT löschen ohne Not – Kompatibilität. Diese Datei dokumentiert verwaiste/ältere Dateien, die aus Kompatibilität erhalten bleiben. Kein Cleanup in Nr. 15 (nur Doku, keine Features, keine Moves).

## Bot – `src/`

| Datei | Warum erhalten | Umgang |
|---|---|---|
| `src/utils/database.js` (~20k) | Kanonische DB-Schicht (Guild-Settings, Bot-Status, Dashboard-Actions); `src/services/supabase.js` migriert schrittweise (vgl. `src/services/README.md`) | Behalten; neue Module nutzen `src/services/*`, Bestand bleibt bis Migration abgeschlossen |
| `src/utils/tickets.js` (~28k) | Legacy Ticket-Logik (Fallback in `src/index.js` `runTicketDashboardAction`, Lock/Claim-Pfade) | Behalten; `src/modules/ticket/*` ist primär, Fallback nur bei Modul-Fehler |
| `src/utils/embeds.js` (~15k) | Kanonisch für EmbedV2-Prepare (`prepareEmbedV2` in `src/index.js`); `messageBuilder.js` ist Hülle darum | Behalten |
| `src/utils/giveaway.js` (~13k) | Legacy Giveaway-Loop (`startGiveawayLoop`, `finalizeGiveaway` in `src/index.js`) parallel zu `src/modules/giveaway/*` | Behalten; Scheduler-Registry + Modul-Scheduler ergänzen, ersetzen nicht abrupt |
| `src/utils/honeypot.js` (~6k) | Legacy Detection (`honeypot` in `src/index.js`) parallel zu `detectionService.js` | Behalten |
| `src/utils/status.js` | Status-Embed (`updateStatusMessage`, `ensureStatusMessage` in `src/index.js`) | Behalten |
| `src/utils/panels.js`, `poll.js` | Panel-/Poll-Helfer (ältere Dashboard-/Bot-Pfade) | Behalten, keine neuen Imports darauf |
| `src/logger.js` | Root-Logger (Bestand); `src/services/logger.js` ist zentrale Weiterentwicklung | Behalten; schrittweise auf Services-Logger migrieren, nichts brechen |
| `src/commands/index.js` (~15k) | Unified Command-Registry (kanonisch, von Tests geprüft: `ticket-close`, `giveaway-end`); Loader lädt modulare `*.js` zusätzlich | Behalten; modulare Commands ergänzen, Registry bleibt Source of Truth für Deploy |
| `src/events/interactions.js` (~47k) | Legacy Interaction-Router (von Tests auf Größe geprüft); `interactionCreate.js` ist dünner Router davor | Behalten; kein Doppel-Handling (Prefix-Matrix in `permissions.js` garantiert Eindeutigkeit, Tests grün) |
| `src/events/welcome.js` | Separater Welcome-Handler (von `src/index.js` + `guildMemberAdd.js` genutzt) | Behalten; `modules/welcome/welcomeFlow` ist Logik, Event-File bleibt Verdrahtung |
| `src/loaders/` | Extra zu Soll (bewusst): `commandLoader.js`, `eventLoader.js` stabilisieren modulare Commands/Events | Behalten (kein Legacy, sondern Struktur-Ergänzung) |

## Dashboard – `website/`

| Datei | Warum erhalten | Umgang |
|---|---|---|
| `website/components/dashboard-shell.js` | Kanonisches Layout (Drawer + Topbar, Mobile-Smoke in Tests) | Behalten; neue UI nach `components/ui/` |
| `website/app/globals.css` | Kanonisches Dark-Theme (CSS-Variablen, keine Hex-Farben in Komponenten) | Behalten |
| `website/middleware.js` (statt `.ts`) | Repo ist JS (Next.js); Soll nennt `middleware.ts` | Behalten; bei TS-Umstellung 1:1 kopieren (Header im File) |

## Supabase

| Objekt | Warum erhalten | Umgang |
|---|---|---|
| `bw_*`-Tabellen (ältere Dashboard-Tabellen) | Nur noch Kompatibilität (Root-README, Migration `20260928112110_remove_legacy_bw_dashboard_tables.sql`) | Nicht neu bespielen; lesend dulden, schreibend nur `bww_*` |
| `bww_honeypot_events`, `bww_embed_templates`, `bww_ticket_events` | Aus Kompatibilität erhalten (Events/Templates/Transkripte laufen darauf) | Behalten; RLS/Guards in Migrationen, keine Löschung ohne Daten-Migration |
| `supabase/functions/` (nur README) | Reserviert per Soll, keine Functions nötig | Behalten als Doku, kein Dead Code |

## Regel

- Legacy NICHT löschen ohne Daten-/Import-Migration + Tests grün (`npm test`, `npm run check`, Website-Build).
- Neue Logik gehört in `src/modules/*` / `src/services/*` / `website/lib/*` / `website/app/*`; Legacy nur als Fallback/Brücke.
