# BWW Multi-Dokument & Panel System – Design

**Datum:** 2026-09-08
**Branch:** `development` (basis `main` 3a06f07 + status `270402e`)
**Ziel:** Getrennte Systeme für (B1) mehrere Werdegang-Dokumente (z.B. `Bundeswehr Werdegang.docx` 25k → 7 Pages) und (B2) unbegrenzte Custom-Panels Buttons, beide Components V2, Auswahl via ein Embed.

## 1. Architektur

- **Daten:** `config/documents.json` (`{ [docId]: { title, pages: string[], fileName, createdAt, createdBy } }`) und `config/panels.json` (bestehend, `{ [panelName]: { intro, buttons: [{label, text}], messages[] } }`) – beide in `.gitignore` + `sync.js SKIP_FILES` (`panels.json` bereits, `documents.json` neu)
- **Renderer:** `src/utils/documents.js` (bestehend, `documentContainer`) wird erweitert zu `src/utils/content.js`? Nein, getrennte Utils bleiben: `src/utils/documents.js` für Dokumente (multi-page), `src/utils/panels.js` für Panels (bereits V2). Beide nutzen `ContainerBuilder` + `TextDisplay` (4000) + `ActionRow` (5×5) + `Separator`
- **Auswahl-Embed:** Ein V2 Container `werdegang_selector` in `config/documents.json` meta `{ selector: { channelId, messageId } }` – Buttons `bww_doc_select_<docId>` (max 25, sonst Select-Menü)

## 2. Datenfluss

- **Anlegen Dokument:** `/document-create name:infanterie titel:"Infanterie Werdegang" file:werdegang.docx` (Attachment) → Server extrahiert `word/document.xml` via `scripts/office/unpack.py` oder `mammoth` → plain 25k → split `4000` → `pages[]` → `save` → aktualisiert Auswahl-Embed (zeigt neuen Button)
- **Senden:** `/werdegang-setup channel:#werdegaenge` → erstellt Auswahl-Container mit allen `docId` Buttons in `channel`, speichert `selector`
- **Klick:** `bww_doc_select_<docId>` → ephemeral V2 Seite 1/7 von `docId` + Nav `bww_doc_page_<docId>_<page>` → `msg.edit` Container zu nächster Page (kein Spam)
- **Panel:** Wie bisher `panel-create` (10 Buttons) + `panel-add-button` für >10 (bis 25 Buttons, >25 via `StringSelectMenu` + Pagination Seite 1: 1-25, Seite 2: 26-50)

## 3. Commands

- `/document-create` (Admin, `name`, `titel`, `file` Attachment)
- `/document-delete name`, `/document-list`, `/werdegang-setup channel`
- `panel-create` etc. bleiben (erweitert um `panel-add-button` für unbegrenzt)
- `setup-permission` Choices erweitert um `document-create`/`werdegang-setup`

## 4. Limits & Fehler

- Discord V2: 40 Komponenten/Container, 4000/TextDisplay, 25 Buttons/5 Rows, 4000 Zeichen/Page – 25k → 7 Pages OK, Panels >25 via Select + Pagination
- Auto-Update: `sync.js` ignoriert `documents.json`/`panels.json`/`config.json`, `.deploy-sha` tracked
- Fehler: Upload kein `.docx` → `❌ Nur .docx`, `docId` existiert → `❌ existiert bereits`, kein `werdegang_selector` → `❌ erst /werdegang-setup`

## 5. Testing

- `npm run test:unit` für `content.js` split, `node --check` für alle `src/**/*.js`
- Manuell: `/document-create` mit 25k doc → 7 Seiten Nav, `/werdegang-setup` → Auswahl-Embed → Klick → Page 1/7 → Weiter → 7/7

