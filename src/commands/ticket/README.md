# Commands `ticket/` – Doku (Ist-Stand, Nr. 15 Final-Check)

> ehm. Platzhalter aus Phase 1 – seit Phase 2/3 implementiert. Verzeichnis entspricht `15_FOLDER_STRUCTURE.md` (`src/commands/ticket/`).

## Dateien (Ist)

- `ticket.js` – unified Ticket-Commands (create/close/reopen/claim/priority/delete/transcript)
- `panel-create.js` – Panel-Erstellung
- `type-add.js` – Ticket-Typen
- `README.md` – diese Doku (kein Platzhalter mehr)

## Prinzip

- Commands sind dünn: Validation (deutsch) → Permission-Check (`ticket.*` via `src/services/permissions.js`) → Modul-Service (`src/modules/ticket/*`) → Antwort.
- Single Source of Truth: `bww_tickets`, `bww_ticket_panels`, `bww_ticket_types`, `bww_ticket_members`, `bww_ticket_messages`, `bww_ticket_actions`.
- Loader: `src/loaders/commandLoader.js` lädt `*.js` mit `{ data }` automatisch; Bestand `src/commands/index.js` bleibt kanonisch (unified Registry, vgl. `docs/LEGACY.md`).
- Logs/Audit: `src/services/audit.js` + `bww_ticket_actions`; Notifications Best-Effort via `src/services/notifications.js`.
