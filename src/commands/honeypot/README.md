# Commands `honeypot/` – Doku (Ist-Stand, Nr. 15 Final-Check)

> ehm. Platzhalter aus Phase 1 – seit Phase 7 implementiert. Verzeichnis entspricht `15_FOLDER_STRUCTURE.md` (`src/commands/honeypot/`).

## Dateien (Ist)

- `honeypot.js` – unified Honeypot-Commands
- `honeypot-create.js` / `honeypot-list.js` / `honeypot-toggle.js` – CRUD + Toggle
- `honeypot-exempt-add.js` / `honeypot-exempt-remove.js` – Exemptions
- `README.md` – diese Doku

## Prinzip

- Dünne Commands → `src/modules/honeypot/*` (detection/exemption/action/stats).
- DB: `bww_honeypots`, `bww_honeypot_triggers`, `bww_honeypot_exemptions`, `bww_honeypot_events` (Legacy-Tabelle erhalten, vgl. `docs/LEGACY.md`).
- Permissions: `honeypot.*`; Bot-Perms geprüft, nie werfend.
