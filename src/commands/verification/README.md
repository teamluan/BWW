# Commands `verification/` – Doku (Ist-Stand, Nr. 15 Final-Check)

> ehm. Platzhalter aus Phase 1 – seit Phase 8 implementiert. Verzeichnis entspricht `15_FOLDER_STRUCTURE.md` (`src/commands/verification/`).

## Dateien (Ist)

- `verification.js` – unified Verification-Commands
- `verify.js` – Self-Service Verify
- `verification-setup.js` / `verification-status.js` / `verification-reset.js` – Config + Status + Reset
- `README.md` – diese Doku

## Prinzip

- Commands → `src/modules/verification/*` (verification/flow/code/attempt/user/log).
- DB: `bww_verification`, Users/Attempts/Codes/Logs, Expires + Cleanup; Replay-Schutz, Rate-Limits.
- Permissions `verification.*`; Notifications Best-Effort (`notifyVerification`).
