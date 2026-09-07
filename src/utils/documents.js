const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

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

module.exports = { documentMenu, documentContainer, documentForValue, DOCUMENTS };
