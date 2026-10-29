# Modul `verification` – Doku (Ist-Stand, Nr. 15 Final-Check)

> ehm. Platzhalter aus Phase 1 – seit Phase 8 implementiert. Verzeichnis entspricht `15_FOLDER_STRUCTURE.md` (`src/modules/verification/`).

## Dateien (Ist)

- `index.js` – Einstieg
- `verificationService.js` / `flowService.js` / `codeService.js` – Flow + Codes
- `attemptService.js` / `userService.js` / `logService.js` – Attempts + User + Logs
- `constants.js` / `interactionHandler.js`
- `README.md` – diese Doku

## Prinzip

- Channel/Rollen/Flow/Codes/Attempts/Rate-Limits/Logs; Expires + Cleanup, Replay-Schutz.
- DB `bww_verification` + Users/Attempts/Codes/Logs; Dashboard `website/app/verification/*` (Settings/Users/Logs).
