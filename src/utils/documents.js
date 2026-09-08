const fs = require('fs');
const path = require('path');
const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

const DOCUMENTS = [
  { value: 'kasernenplan', label: 'Kasernenplan', emoji: '📁', text: '**Kasernenplan**\n\nDer offizielle Kasernenplan steht hier. Trage hier den tatsächlichen Inhalt ein.' },
  { value: 'formaldienstordnung', label: 'Formaldienstordnung', emoji: '📁', text: '**Formaldienstordnung**\n\nDie offizielle Formaldienstordnung steht hier. Trage hier den tatsächlichen Inhalt ein.' },
  { value: 'rp-begriffe', label: 'RP-Begriffe Glossar', emoji: '📁', text: '**RP-Begriffe Glossar**\n\nDas Glossar der gängigen RP-Begriffe steht hier. Trage hier den tatsächlichen Inhalt ein.' },
  { value: 'fernmeldeausbildung', label: 'Fernmeldeausbildung', emoji: '📁', text: '**Fernmeldeausbildung**\n\nDie Unterlagen zur Fernmeldeausbildung stehen hier. Trage hier den tatsächlichen Inhalt ein.' },
  { value: 'funkcodes', label: 'Funkcodes', emoji: '📁', text: '**Funkcodes**\n\nDie gängigen Funkcodes stehen hier. Trage hier den tatsächlichen Inhalt ein.' },
  { value: 'leitfaden-geiselnahmen', label: 'Leitfaden Geiselnahmen', emoji: '📁', text: '**Leitfaden Geiselnahmen**\n\nDer Leitfaden für Geiselnahmen steht hier. Trage hier den tatsächlichen Inhalt ein.' },
  { value: 'kasernenordnung', label: 'Kasernenordnung', emoji: '📁', text: '**Kasernenordnung**\n\nDie offizielle Kasernenordnung steht hier. Trage hier den tatsächlichen Inhalt ein.' }
];

const BUTTONS_PER_ROW = 5;
const docsFile = path.join(__dirname, '..', '..', 'config', 'documents.json');

function loadDocuments() { try { return JSON.parse(fs.readFileSync(docsFile, 'utf8')); } catch { return {}; } }
function saveDocuments(docs) { const dir = path.dirname(docsFile); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(docsFile, JSON.stringify(docs, null, 2)); return docs; }
function getDocument(id) { const docs = loadDocuments(); return docs[id] || null; }
function setDocument(id, data) { const docs = loadDocuments(); docs[id] = data; saveDocuments(docs); }
function deleteDocument(id) { const docs = loadDocuments(); if (!(id in docs)) return false; delete docs[id]; saveDocuments(docs); return true; }
function listDocuments() { return loadDocuments(); }
function splitText(text, max = 3500) {
  // Split on double newline to keep paragraphs, fallback to hard split
  const pages = [];
  let cur = '';
  for (const para of String(text).split('\n')) {
    const add = cur ? '\n' + para : para;
    if ((cur + add).length > max) {
      if (cur) pages.push(cur);
      cur = para;
      if (cur.length > max) {
        while (cur.length > max) { pages.push(cur.slice(0, max)); cur = cur.slice(max); }
      }
    } else { cur += add; }
  }
  if (cur) pages.push(cur);
  return pages.length ? pages : [''];
}

function documentContainer(introText) {
  const container = new ContainerBuilder().setAccentColor(0x2F3136);
  const parts = [];
  if (introText) parts.push(introText);
  parts.push('Drücke auf den Button des Dokuments, das du anzeigen möchtest.');
  parts.push('**Verfügbare Dokumente:**');
  parts.push(DOCUMENTS.map(d => `${d.emoji} ${d.label}`).join('\n'));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🗂️ Allgemeine-Dokumente\n${parts.join('\n\n')}`));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  for (let i = 0; i < DOCUMENTS.length; i += BUTTONS_PER_ROW) {
    const chunk = DOCUMENTS.slice(i, i + BUTTONS_PER_ROW);
    const row = new ActionRowBuilder().addComponents(chunk.map(d => new ButtonBuilder().setCustomId(`bww_doc_${d.value}`).setLabel(d.label).setEmoji(d.emoji).setStyle(ButtonStyle.Secondary)));
    container.addActionRowComponents(row);
  }
  return container;
}
function documentMenu(introText) { return documentContainer(introText); }
function documentForValue(value) { return DOCUMENTS.find(d => d.value === value); }

function werdegangSelectorContainer() {
  const docs = loadDocuments();
  const ids = Object.keys(docs);
  const container = new ContainerBuilder().setAccentColor(0x17365d);
  if (!ids.length) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 📚 Werdegang auswählen\nNoch keine Werdegang-Dokumente vorhanden.\nNutze `/document-create` zum Anlegen.'));
    return container;
  }
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📚 Werdegang auswählen\nWähle einen Werdegang – originalgetreue Darstellung im Querformat:`));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  if (ids.length <= 25) {
    for (let i = 0; i < ids.length; i += 5) {
      const chunk = ids.slice(i, i + 5);
      const row = new ActionRowBuilder().addComponents(chunk.map(id => new ButtonBuilder().setCustomId(`bww_doc_select_${id}`).setLabel((docs[id].title || id).slice(0, 80)).setStyle(ButtonStyle.Primary)));
      container.addActionRowComponents(row);
    }
  } else {
    const select = new StringSelectMenuBuilder().setCustomId('bww_doc_select_menu').setPlaceholder('Werdegang auswählen').addOptions(ids.slice(0, 25).map(id => new StringSelectMenuOptionBuilder().setLabel((docs[id].title || id).slice(0, 100)).setValue(id)));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
  }
  return container;
}

function documentPageContainer(docId, pageIdx = 0) {
  const doc = getDocument(docId);
  if (!doc) return null;
  const pages = doc.pages || [];
  const text = pages[pageIdx] || '';
  // Width-oriented: Container mit Header Section + Separator + TextDisplay (Code-Block für Tabellen)
  const container = new ContainerBuilder().setAccentColor(0x17365d);
  // Header als Section mit Titel + Seitenzahl, kein Thumbnail (breiter)
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${doc.title || docId} — Seite ${pageIdx + 1}/${pages.length}`));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  // Für Seite 1: zeige Dokumentensteuerung als schmalen Code-Block Tabelle (breiter wirkt)
  // Text als fenced code block mit fixierter Breite simuliert Querformat
  const isFirstPage = pageIdx === 0;
  if (isFirstPage && text.includes('DOKUMENT') && text.includes('AUSGABE')) {
    // Erkenne Tabellen-Header und formatiere als Markdown-Tabelle (Discord rendert als Text, aber breiter)
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('```\n' + text.slice(0, 3500) + '\n```'));
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text.slice(0, 3500)));
  }
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  const row = new ActionRowBuilder();
  if (pageIdx > 0) row.addComponents(new ButtonBuilder().setCustomId(`bww_doc_page_${docId}_${pageIdx - 1}`).setLabel('◀ Zurück').setStyle(ButtonStyle.Secondary));
  if (pageIdx < pages.length - 1) row.addComponents(new ButtonBuilder().setCustomId(`bww_doc_page_${docId}_${pageIdx + 1}`).setLabel('Weiter ▶').setStyle(ButtonStyle.Primary));
  row.addComponents(new ButtonBuilder().setCustomId(`bww_doc_select_back`).setLabel('📚 Auswahl').setStyle(ButtonStyle.Secondary));
  // Falls Buttons >3, splitte (Discord max 5/ActionRow, aber wir haben max 3 hier)
  container.addActionRowComponents(row);
  // Footer mit Dokumentnummer
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${docId} • ${(doc.fileName || '')} • Seite ${pageIdx + 1}/${pages.length}`));
  return container;
}

module.exports = { documentMenu, documentContainer, documentForValue, DOCUMENTS, loadDocuments, saveDocuments, getDocument, setDocument, deleteDocument, listDocuments, splitText, werdegangSelectorContainer, documentPageContainer, docsFile };
