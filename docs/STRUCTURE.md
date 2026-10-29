# BWW – Struktur (Ist-Stand, Nr. 15 Final-Check)

> **Entfernt 2026-10-15: Abschnitt 2 (website/) ist gelöscht.** Bot (src/) + Supabase (supabase/) bleiben; Vercel-Deploy entfÄllt.

> Quelle Soll: `15_FOLDER_STRUCTURE.md` (empfohlene Projektstruktur) + Prinzip (Module getrennt, teilen DB/Auth/Permissions/Logging/Audit/Variables/MessageBuilder/Scheduler).
> Stand: Phase 1-14 auf main. Diese Datei dokumentiert Ist vs. Soll + bewusste Abweichungen. KEINE Moves (`website/` bleibt, kein `.js` → `.ts` Rewrite).

## 1. Bot – `src/`

| Soll (`15_FOLDER_STRUCTURE`) | Ist auf main | Status |
|---|---|---|
| `src/commands/ticket/` | `ticket.js`, `panel-create.js`, `type-add.js` + `README.md` (Doku, kein Platzhalter) | ✅ |
| `src/commands/honeypot/` | `honeypot.js`, `honeypot-create.js`, `-list`, `-toggle`, `-exempt-add/-remove` + `README.md` | ✅ |
| `src/commands/embed/` | `embed.js`, `embed-create/-list/-send/-clone`, `embed-component-add` + `README.md` | ✅ |
| `src/commands/welcome/` | `welcome.js`, `welcome-setup/-toggle/-test/-variables` + `README.md` | ✅ |
| `src/commands/giveaway/` | `giveaway.js` + `README.md` | ✅ |
| `src/commands/verification/` | `verification.js`, `verify.js`, `verification-setup/-status/-reset` + `README.md` | ✅ |
| — (Extra) | `src/commands/general/` (`config`, `settings`, `setup`, `help`, `ping`) + `README.md` | ✅ bewusst: allgemeine Setup/Admin-Commands, kein eigenes Modul |
| — (Extra) | `src/commands/index.js` (unified Registry, kanonisch) | ✅ bewusst erhalten, vgl. `docs/LEGACY.md` |
| `src/events/ready.js` | vorhanden | ✅ |
| `src/events/interactionCreate.js` | vorhanden (Router, dünn) | ✅ |
| `src/events/guildCreate.js` | vorhanden | ✅ |
| `src/events/guildDelete.js` | vorhanden | ✅ |
| `src/events/guildMemberAdd.js` | vorhanden (→ `welcome.js` → `modules/welcome`) | ✅ |
| `src/events/messageCreate.js` | vorhanden (→ Honeypot-Detection) | ✅ |
| — (Extra) | `src/events/interactions.js` (~47k, Legacy-Router) + `src/events/welcome.js` (Welcome-Handler) | ✅ bewusst erhalten, vgl. `docs/LEGACY.md` |
| `src/modules/ticket/` | `ticketService`, `panelService`, `templateService`, `actionsService`, `controls`, `interactionHandler`, `transcriptService`, `messageLogger`, `autocloseService`, `constants`, `index` + `README.md` | ✅ |
| `src/modules/honeypot/` | `honeypotService`, `detectionService`, `actionService`, `exemptionService`, `statsService`, `constants`, `interactionHandler`, `index` + `README.md` | ✅ |
| `src/modules/embed/` | `embedService`, `componentService`, `buttonService`, `selectService`, `actionService`, `sendService`, `interactionHandler`, `constants`, `index` + `README.md` | ✅ |
| `src/modules/welcome/` | `welcomeService`, `welcomeFlow`, `variableService`, `dmService`, `autoRoleService`, `logService`, `constants`, `interactionHandler`, `index` + `README.md` | ✅ |
| `src/modules/giveaway/` | `giveawayService`, `entryService`, `requirementService`, `endService`, `rerollService`, `schedulerService`, `giveawayMessage`, `constants`, `interactionHandler`, `index` + `README.md` | ✅ |
| `src/modules/verification/` | `verificationService`, `flowService`, `codeService`, `attemptService`, `userService`, `logService`, `constants`, `interactionHandler`, `index` + `README.md` | ✅ |
| `src/services/supabase.js` | vorhanden (`supabaseRequest`, ENV-only) | ✅ |
| `src/services/permissions.js` | vorhanden (Matrix + `BUTTON_PERMISSION_PREFIXES`) | ✅ |
| `src/services/logger.js` | vorhanden (debug/info/warn/error, Webhook silent-fail) | ✅ |
| `src/services/audit.js` | vorhanden (`bww_audit_logs`, nie werfend) | ✅ |
| `src/services/variables.js` | vorhanden (`{user} {server} {membercount} …`) | ✅ |
| `src/services/cache.js` | vorhanden (TTL-Cache, Settings 5s) | ✅ |
| `src/services/scheduler.js` | vorhanden (Registry für Status/Giveaway/Autoclose) | ✅ |
| `src/services/messageBuilder.js` | vorhanden (Hülle um `src/utils/embeds.js`) | ✅ |
| — (Extra) | `src/services/discord.js`, `validation.js`, `notifications.js` (Best-Effort-Trigger), `index.js`, `README.md` | ✅ bewusst dokumentiert: Fetch-Cache, Snowflake-Normalisierung, Notifications |
| `src/utils/` | `database.js`, `tickets.js`, `embeds.js`, `giveaway.js`, `honeypot.js`, `panels.js`, `poll.js`, `status.js` | ✅ bewusst erhalten (Legacy kanonisch, schrittweise Migration, vgl. `docs/LEGACY.md`) |
| `src/index.js` | vorhanden (Client, Loader, Scheduler, Dashboard-Actions, Heartbeat 30s) | ✅ |
| — (Extra) | `src/loaders/commandLoader.js`, `eventLoader.js` + `src/logger.js` (Root-Logger) | ✅ bewusst: Loader-Verdrahtung + Bestand-Logger |

## 2. Dashboard - website/ (entfernt)

- Kein Vercel-Deploy mehr (Dashboard entfernt; Vercel-Projekt in der UI pausieren oder löschen).

## 3. Supabase – `supabase/`

| Soll | Ist | Status |
|---|---|---|
| `migrations/` | 20 Dateien, chronologisch (`20260926…` → `20261003220000_bww_phase14_platform.sql`), alle `bww_`-Prefix, RLS-Guards, `remove_legacy_bw_dashboard_tables` für `bw_*`-Kompatibilität | ✅ |
| `functions/` | nur `README.md` (reserviert, keine Edge Functions nötig – Bot + Next.js API-Routen decken ab) | ✅ bewusst, kein Dead Code |
| `seed/` | `README.md` + `bww_phase2_examples.sql` (Beispiele, keine echten Daten) | ✅ |

## 4. Prinzip-Einhaltung

- Module getrennt (`src/modules/*`), teilen: Datenbank (`bww_*` in Supabase), Auth (Supabase Auth), Permissions (`src/services/permissions.js` ↔ `guards.js`), Logging (`logger.js` + `bww_system_logs`), Audit (`audit.js` + `bww_audit_logs`), Variables (`variables.js` ↔ `variableService`), MessageBuilder (`messageBuilder.js` um `utils/embeds.js`), Scheduler (`scheduler.js` + Modul-Scheduler + Heartbeat).
- Commands nutzen dieselben Supabase-Daten (`bww_guild_settings` zentral, keine Doppel-Configs).
- Import-Pfade: keine Moves in Nr. 15, daher keine Pfad-Anpassungen nötig; Loader (`commandLoader`) + `src/index.js`-Verdrahtung stabil.

## 5. Deploy-Relevanz (Kurz)

- Vercel Root Directory = `website` (nicht Repo-Root, nicht `dashboard/`).
- Migrationen in Dateinamen-Reihenfolge ausführen (Supabase CLI/Studio), Seed nur lokal/Test.
- Bot-Start: `npm start` (via `sync.js`) bzw. `npm run bot` (`src/index.js`); Env via Root-`.env` (Details `README.md`, `docs/RELEASE_CHECKLIST.md`).
