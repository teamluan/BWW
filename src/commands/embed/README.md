# Commands `embed/` – Doku (Ist-Stand, Nr. 15 Final-Check)

> ehm. Platzhalter aus Phase 1 – seit Phase 3/5 implementiert. Verzeichnis entspricht `15_FOLDER_STRUCTURE.md` (`src/commands/embed/`).

## Dateien (Ist)

- `embed.js` – unified Embed-Commands
- `embed-create.js` / `embed-list.js` / `embed-send.js` / `embed-clone.js` – CRUD + Send + Clone
- `embed-component-add.js` – Buttons/Selects
- `README.md` – diese Doku

## Prinzip

- Commands → `src/modules/embed/*` (embed/component/button/select/action/send).
- DB: `bww_embeds`, `bww_embed_components`, `bww_embed_actions`, `bww_embed_templates` (Templates erhalten).
- Preview/Send via `src/services/messageBuilder.js` (Hülle um `src/utils/embeds.js`); Permissions `embed.view` vs. `embed.send/delete`.
