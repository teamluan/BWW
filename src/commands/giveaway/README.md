# Commands `giveaway/` – Doku (Ist-Stand, Nr. 15 Final-Check)

> ehm. Platzhalter aus Phase 1 – seit Phase 7 implementiert. Verzeichnis entspricht `15_FOLDER_STRUCTURE.md` (`src/commands/giveaway/`).

## Dateien (Ist)

- `giveaway.js` – unified Giveaway-Commands (create/join/end/reroll/cancel/list)
- `README.md` – diese Doku

## Prinzip

- Commands → `src/modules/giveaway/*` (giveaway/entry/requirement/end/reroll/scheduler/giveawayMessage).
- DB: `bww_giveaways`, Entries/Winners/Requirements/Rerolls, `winner_count`.
- Scheduler: `src/services/scheduler.js` Registry + `schedulerService.js` + `startGiveawayLoop` in `src/index.js`; Permissions `giveaway.*`.
