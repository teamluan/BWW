# Modul `giveaway` – Doku (Ist-Stand, Nr. 15 Final-Check)

> ehm. Platzhalter aus Phase 1 – seit Phase 7 implementiert. Verzeichnis entspricht `15_FOLDER_STRUCTURE.md` (`src/modules/giveaway/`).

## Dateien (Ist)

- `index.js` – Einstieg + `registerGiveawayScheduler`
- `giveawayService.js` / `entryService.js` / `requirementService.js` – CRUD + Join + Requirements
- `endService.js` / `rerollService.js` / `schedulerService.js` / `giveawayMessage.js` – End/Winner/Reroll + Scheduler + Message
- `constants.js` / `interactionHandler.js`
- `README.md` – diese Doku

## Prinzip

- Scheduler-Registry (`src/services/scheduler.js`) + Loop in `src/index.js`; DB `bww_giveaways` + Entries/Winners.
- Dashboard (`website/app/giveaways/*`) teilt dieselben Tabellen (Aktiv/Vergangen/Settings, Teilnehmer-Export).
