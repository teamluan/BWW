# Modul `welcome` – Doku (Ist-Stand, Nr. 15 Final-Check)

> ehm. Platzhalter aus Phase 1 – seit Phase 6 implementiert. Verzeichnis entspricht `15_FOLDER_STRUCTURE.md` (`src/modules/welcome/`).

## Dateien (Ist)

- `index.js` – Einstieg
- `welcomeService.js` / `welcomeFlow.js` / `variableService.js` – Config + Flow + Variablen
- `dmService.js` / `autoRoleService.js` / `logService.js` – DM + Auto-Role + Logs
- `constants.js` / `interactionHandler.js`
- `README.md` – diese Doku

## Prinzip

- Join-Event (`guildMemberAdd`) → `welcomeFlow` mit Variablen (`src/services/variables.js`) + Embed-Integration + DM + Auto-Role.
- DB `bww_welcome` + `bww_welcome_logs`; Dashboard `website/app/welcome/*` (Settings/Builder/Stats).
