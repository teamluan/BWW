# Commands `welcome/` – Doku (Ist-Stand, Nr. 15 Final-Check)

> ehm. Platzhalter aus Phase 1 – seit Phase 6 implementiert. Verzeichnis entspricht `15_FOLDER_STRUCTURE.md` (`src/commands/welcome/`).

## Dateien (Ist)

- `welcome.js` – unified Welcome-Commands
- `welcome-setup.js` / `welcome-toggle.js` / `welcome-test.js` / `welcome-variables.js` – Config + Test + Variablen
- `README.md` – diese Doku

## Prinzip

- Commands → `src/modules/welcome/*` (welcomeService/welcomeFlow/variableService/dmService/autoRole/logService).
- DB: `bww_welcome`, `bww_welcome_logs`; Variablen via `src/services/variables.js` (`{user} {server} {membercount} …`).
- Event: `guildMemberAdd.js` → `src/events/welcome.js` → `welcomeFlow`; Permissions `welcome.*`.
