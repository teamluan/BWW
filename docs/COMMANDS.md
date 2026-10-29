# BWW – Phase 9 Commands (konsolidiert, XXL-Plan Nr. 9)

> **Entfernt 2026-10-15: Web-Dashboard (website/) gelöscht.** Bot-Commands bleiben; einzige Quelle ist Supabase (ww_*).

Quelle: `09_COMMANDS.md` (Slash-Commands), `11_PERMISSIONS.md` (BWW-Berechtigungen),
`01_ARCHITECTURE.md` (Command Loader, Services), `15_FOLDER_STRUCTURE.md` (`src/commands/*/`, `src/events/interactionCreate.js`).

Stand: Phase 1–8 auf `main` (alle 6 Module: Tickets, Honeypot, Embed V2, Welcome, Giveaways, Verification mit Bot + DB (Dashboard entfernt)).
Phase 9 ändert KEINE Modul-Business-Logik, nur Command-Schicht + Wiring + Doku.
Phase 11 (Permissions-Matrix) ergänzt je Subcommand ein Matrix-Recht – siehe §8.

## 1. Vorher-Stand (was fehlte)

Legacy-Monolith (`src/commands/index.js`): `nachricht`, `embed` (einfach), `setup` (Hilfe),
`verify` (Panel-Send), `ticket`, `ticket-list/close/claim/reopen/add/remove/rename/priority/lock/unlock`,
`giveaway`, `giveaway-end/reroll/cancel/list`, `panel-create/send/delete/list/add-button`, `umfrage`,
`setup-status/welcome/verify/ticket/honeypot/permission`, `wartung`, `restart`, `dashboard-code`,
`kick/ban/unban/timeout/giverole/removerole`.

Modular vorher (`src/commands/*/`):
- `ticket/`: `ticket.js` (11 Subs: claim/unclaim/add/remove/rename/priority/close/reopen/delete/transcript/template), `panel-create.js`, `type-add.js` — fehlten: `setup/panel/create/info` (09 verlangt 13: setup/panel/create/close/reopen/delete/claim/unclaim/add/remove/rename/priority/transcript/info).
- `honeypot/`: `honeypot-create/list/toggle/exempt-add/exempt-remove` — kein unified `/honeypot`, fehlten: `delete/enable/disable/logs`, `whitelist` als Gruppe.
- `embed/`: `embed-create/list/send/clone/component-add` — kein unified `/embed`, fehlten: `edit/delete/preview/template`.
- `welcome/`: `welcome-setup/test/toggle/variables` — kein unified `/welcome`, fehlten: `enable/disable/preview` (toggle vorhanden, aber kein Split).
- `giveaway/`: `giveaway.js` bereits komplett (start/end/cancel/reroll/edit/list/info) — nur prüfen.
- `verification/`: `verify.js` (self), `verification-setup/reset/status` — kein unified `/verify`/`/verification` mit `setup/enable/disable/user/reset/logs`.
- Allgemein: nur legacy `setup`-Hilfe — fehlten modular: `/setup` (Guild-Init), `/config`, `/settings`, `/help`, `/ping`.
- Routing (`src/events/interactionCreate.js`): nur `giveaway` + `verify`-Familie modular geroutet, Rest fiel auf Legacy zurück (modulare `/ticket`, `/honeypot-*`, `/embed-*`, `/welcome-*` teils ohne Routing).

## 2. Nachher (Phase 9)

### Allgemein (`src/commands/general/`, Loader-auto-registriert)
- `/setup` — Guild-Init, zeigt Modul-Status, sichert `bww_guild_settings` (Dashboard-parität).
- `/config view/set` + `/settings view/set` — lesen/schreiben in `bww_guild_settings` (Single Source Supabase, Dashboard nutzt dieselbe Config).
- `/help` — konsolidierte Übersicht (diese Datei + `/commands`-Seite).
- `/ping` — WS-Latenz, Uptime, Supabase-Status.

### Ticket (`src/commands/ticket/ticket.js` erweitert)
`/ticket setup/panel/create/close/reopen/delete/claim/unclaim/add/remove/rename/priority/transcript/info` (+`template` als Extra erhalten).
- `setup`: Wrapper um `saveGuildSettings` (wie legacy `setup-ticket`, selbe `bww_guild_settings`).
- `panel`: Wrapper um `createPanel` + `sendPanelMessage` (wie `ticket-panel-create`).
- `create`: Wrapper um `ticketService.createTicket` (Typ-Auto-Resolve, sonst Hinweis auf `panel`/`type-add`).
- `info`: Wrapper um `getTicket` (ephemeral Details).
- Rest delegiert an `actionsService`/`transcriptService`/`templateService` (unverändert).
- Aliase erhalten: `ticket-panel-create`, `ticket-type-add`, `ticket-list/close/...` (Legacy).

### Honeypot (`src/commands/honeypot/honeypot.js` neu)
`/honeypot create/delete/list/enable/disable/logs/whitelist` (whitelist als Gruppe `add/remove/list`).
- `create/delete/list/enable/disable`: Wrapper um `honeypotService` (`createHoneypot/deleteHoneypot/listHoneypots/setEnabled`).
- `logs`: Wrapper um `statsService` (`listRecentTriggers` + `getHoneypotStats`).
- `whitelist add/remove/list`: Wrapper um `exemptionService` (= `exempt-add/remove`).
- Aliase erhalten: `honeypot-create/list/toggle/exempt-add/exempt-remove`.

### Embed V2 (`src/commands/embed/embed.js` neu)
`/embed create/edit/delete/list/send/preview/clone/template`.
- `edit/delete/template`: Wrapper um `embedService` (`updateEmbed/deleteEmbed/saveAsTemplate`), `clone` um `cloneEmbed`.
- `preview`: `getFullEmbed`-Summary (ephemeral, kein Send).
- Aliase erhalten: `embed-create/list/send/clone/component-add`.

### Welcome (`src/commands/welcome/welcome.js` neu)
`/welcome setup/enable/disable/preview/test`.
- `setup/enable/disable/test`: Wrapper um `welcomeService.upsert/setEnabled` + `welcomeFlow.sendTestMessage` (selbe `bww_welcome` wie Dashboard).
- `preview`: `getWelcomeConfig` + `variableService.replaceVariables` (ephemeral, ohne Senden).
- Aliase erhalten: `welcome-setup/test/toggle/variables`.

### Giveaway (`src/commands/giveaway/giveaway.js` geprüft)
`start/end/cancel/reroll/edit/list/info` bereits vollständig — keine Änderung, nur Routing-Absicherung + Doku.

### Verification (`src/commands/verification/verification.js` neu + `verify.js` erhalten)
- `/verify` (self, Bestand): Button/Code/Captcha für alle, unverändert.
- `/verification setup/enable/disable/user/reset/logs`: Wrapper um `upsertVerificationConfig/setEnabled/getVerificationStatus/resetVerification/listLogs` (+ `ensureVerificationPanel` bei `setup panel=true`).
- Schreibt dieselben `bww_verification*`-Tabellen wie Dashboard.
- Aliase erhalten: `verification-setup/reset/status`, `verify`.

## 3. Grundprinzip (jeder Command)

1. Guild-Kontext prüfen (`interaction.guildId` + `validation.requireGuildId`).
2. BWW-Berechtigung prüfen (Phase 11: Matrix `permissions.hasPermission/requirePermission` + `bww_guild_roles`-Mapping + `getGuildSettings`, Legacy-Mapping als Fallback – Details `docs/PERMISSIONS.md`).
3. Discord-Permissions prüfen (Phase 11: Fallback-Mapping `Administrator`→Administrator, `ManageGuild`→Manager, `ModerateMembers`/`ManageMessages`→Moderator, `ManageRoles`→Support; davor: `Administrator`/`ManageGuild` oder `isStaff`/`isEmbedManager` – jetzt vereinheitlicht).
4. Input validieren (`validation.cleanId/clampText`, Choices/Limits).
5. DB via Service (nie direkt, Single Source `bww_*`).
6. Ergebnis (ephemeral wo sinnvoll, `deferReply` + `followUp`).
7. Audit/System-Log (`audit.logAudit` + `logger`, nie werfend).

## 4. Loader / Registry / Routing

- `src/loaders/commandLoader.js`: unverändert, auto-registriert `src/commands/**/*` (inkl. neu `general/`, `honeypot.js`, `embed.js`, `welcome.js`, `verification.js`). Dedupe nach Name, modular gewinnt über Monolith.
- `src/events/interactionCreate.js`: zentrale `MODULAR_COMMANDS`-Registry für alle modularen Slash-Commands (Ticket/Honeypot/Embed/Welcome/Giveaway/Verify+Verification/Setup/Config/Settings/Help/Ping + Legacy-Modular-Aliase), vor Legacy, kein Doppel-Handling mit Button/Select-Prefix-Gruppen (`bww_giveaway_*`, `bww_verification_*`, `bww_ticket_*`, `bww_honeypot_*`, `bww_embed_*` geben `true` zurück und returnen früh). Phase 11: zentrales Component-Permission-Gate (Matrix) vor Modul-Routing – ein Prüfpunkt für alle Button-Aktionen.
- Reihenfolge: Component-Gate (Phase 11) → Giveaway → Verification → Priority-Select/Close-Modal → Honeypot → Ticket → Embed V2 → Modulare Slash → Legacy.

## 5. Dashboard-ParitÄt entfÄllt (Dashboard entfernt)

FrÜher schrieben /ticket setup, /welcome setup, /verification setup, /honeypot create, /embed create, /config//settings in dieselben ww_*-Tabellen wie das Dashboard. Das Dashboard (website/) ist gelöscht; die Commands schreiben weiterhin direkt in Supabase (Single Source ww_guild_settings, ww_ticket_panels/types/tickets, ww_honeypots, ww_embeds, ww_welcome, ww_verification*, ww_giveaways*).

## 6. Dateien (Phase 9)

Neu:
- `src/commands/general/setup.js`, `config.js`, `settings.js`, `help.js`, `ping.js`
- `src/commands/honeypot/honeypot.js`
- `src/commands/embed/embed.js`
- `src/commands/welcome/welcome.js`
- `src/commands/verification/verification.js`
- `docs/COMMANDS.md` (diese Datei)
- (entfernt) website/app/commands/page.js (Dashboard-Command-Übersicht entfÄllt mit website/)

Geändert:
- `src/commands/ticket/ticket.js` (setup/panel/create/info ergänzt, Rest unverändert)
- `src/events/interactionCreate.js` (MODULAR_COMMANDS-Registry)

Unverändert (nur geprüft, Aliase erhalten):
- `src/commands/giveaway/giveaway.js`, alle `*-create/list/toggle/*`-Aliase, `src/commands/index.js` (Legacy), alle `src/modules/*` (Business-Logik).

## 7. Dashboard-Konsolidierung (entfernt)

website/ ist gelöscht; keine Dashboard-Arbeit mehr offen.

## 8. Phase 11 – Permissions-Matrix je Command (XXL-Plan Nr. 11)

Jeder Subcommand prüft exakt EIN Matrix-Recht (Rollen: Owner/Administrator/Manager/Moderator/Support/Giveaway Manager/Verification Staff/Viewer – Details + Matrix: `docs/PERMISSIONS.md`). `frei` = Self-Service (jedes Mitglied; Service-Layer entscheidet, z. B. Ersteller-Regeln). Viewer nur lesen.

| Command | Subcommand → Permission |
|---|---|
| `/setup` | → `settings.manage` |
| `/config` | `view` → `settings.view`, `set` → `settings.manage` |
| `/settings` | `view` → `settings.view`, `set` → `settings.manage` |
| `/help`, `/ping` | frei |
| `/ticket` | `setup` → `ticket.settings`, `panel` → `ticket.manage`, `create` → frei (Service), `claim/unclaim/add/remove/rename/priority/close` → Service (Matrix-`isStaff` + Ersteller-Regeln), `reopen` → `ticket.reopen`, `delete` → `ticket.delete`, `transcript` → `ticket.transcript`, `info/template` → `ticket.manage` |
| `/honeypot` | `create/delete/enable/disable` → `honeypot.manage`, `list` → `honeypot.view`, `logs` → `honeypot.logs`, `whitelist add/remove` → `honeypot.exemptions`, `whitelist list` → `honeypot.view` |
| `/embed` | `create/clone` → `embed.create`, `edit` → `embed.edit`, `delete` → `embed.delete`, `list/preview` → `embed.view`, `send` → `embed.send`, `template` → `embed.templates` |
| `/welcome` | `setup/enable/disable` → `welcome.manage`, `preview` → `welcome.view`, `test` → `welcome.test` |
| `/giveaway` | `start` → `giveaway.create`, `end` → `giveaway.end`, `cancel/edit` → `giveaway.manage`, `reroll` → `giveaway.reroll`, `list/info` → `giveaway.view` (Teilnehmen-Button: frei) |
| `/verify` + `/verification` | `/verify` + Verify-Button → frei; `setup/enable/disable` → `verification.manage`, `user` (fremd) → `verification.view` (eigener Status: frei), `reset` → `verification.reset`, `logs` → `verification.logs` |
| Ticket-Buttons | `claim` → `ticket.claim`, `reopen` → `ticket.reopen`, `delete` → `ticket.delete`, `transcript` → `ticket.transcript`, `priority` → `ticket.manage`, `close`/Modal + Panel/Type-Select → frei (Service) |
| Legacy (`kick/ban/timeout/…`, `restart`, …) | unverändert (`isAllowed`, Administrator/Mapping) – erhalten, siehe `docs/PERMISSIONS.md` §1 |

Nächstes (Nr. 12 = `12_API.md`): API-Konsolidierung (Discord-Rollen-Sync, User-Sessions, Ratenlimits).
