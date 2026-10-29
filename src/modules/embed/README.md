# Modul `embed` – Doku (Ist-Stand, Nr. 15 Final-Check)

> ehm. Platzhalter aus Phase 1 – seit Phase 3/5 implementiert. Verzeichnis entspricht `15_FOLDER_STRUCTURE.md` (`src/modules/embed/`).

## Dateien (Ist)

- `index.js` – Einstieg
- `embedService.js` / `componentService.js` / `buttonService.js` / `selectService.js` – Builder + Components
- `actionService.js` / `sendService.js` / `interactionHandler.js` / `constants.js`
- `README.md` – diese Doku

## Prinzip

- Builder/Preview/Components/Send/Clone; Templates in `bww_embed_templates` (erhalten).
- MessageBuilder (`src/services/messageBuilder.js`) als Hülle um `src/utils/embeds.js` (Legacy kanonisch, schrittweise Migration).
