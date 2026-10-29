# Modul `honeypot` – Doku (Ist-Stand, Nr. 15 Final-Check)

> ehm. Platzhalter aus Phase 1 – seit Phase 7 implementiert. Verzeichnis entspricht `15_FOLDER_STRUCTURE.md` (`src/modules/honeypot/`).

## Dateien (Ist)

- `index.js` – Einstieg
- `honeypotService.js` / `detectionService.js` / `actionService.js` / `exemptionService.js` – Detection + Actions + Exemptions
- `statsService.js` / `constants.js` / `interactionHandler.js`
- `README.md` – diese Doku

## Prinzip

- Geteilte Services (Supabase/Permissions/Logger/Audit/Notifications/Scheduler); `bww_honeypot_events` als Legacy erhalten (vgl. `docs/LEGACY.md`).
- Event: `messageCreate.js` → Detection; Dashboard: `website/app/honeypot/*`.
