# Modul `ticket` – Doku (Ist-Stand, Nr. 15 Final-Check)

> ehm. Platzhalter aus Phase 1 – seit Phase 2/3 implementiert. Verzeichnis entspricht `15_FOLDER_STRUCTURE.md` (`src/modules/ticket/`).

## Dateien (Ist)

- `index.js` – Modul-Einstieg + `registerTicketAutoclose`
- `ticketService.js` / `panelService.js` / `templateService.js` / `constants.js` – CRUD + Panels + Templates
- `actionsService.js` / `controls.js` / `interactionHandler.js` – Claim/Close/Reopen/Delete/Priority/Pending/Lock + Buttons
- `transcriptService.js` / `messageLogger.js` – Transkripte + Message-Log
- `autocloseService.js` – Autoclose via Scheduler
- `README.md` – diese Doku

## Prinzip

- Module bleiben getrennt, teilen DB/Auth/Permissions/Logging/Audit/Variables/MessageBuilder/Scheduler.
- Single Source of Truth: `bww_tickets` + Panel/Type/Member/Message/Action/Template-Tabellen (Supabase).
- Dashboard (`website/app/tickets/*`) und Commands nutzen dieselben Services/Tabellen – keine Doppel-Configs.
