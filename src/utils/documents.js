const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const DOCUMENTS = [
  {
    value: 'kasernenplan',
    label: 'Kasernenplan',
    emoji: '📁',
    text: '**Kasernenplan**\n\nDer offizielle Kasernenplan steht hier. Trage hier den tatsächlichen Inhalt ein.'
  },
  {
    value: 'formaldienstordnung',
    label: 'Formaldienstordnung',
    emoji: '📁',
    text: '**Formaldienstordnung**\n\nDie offizielle Formaldienstordnung steht hier. Trage hier den tatsächlichen Inhalt ein.'
  },
  {
    value: 'rp-begriffe',
    label: 'RP-Begriffe Glossar',
    emoji: '📁',
    text: '**RP-Begriffe Glossar**\n\nDas Glossar der gängigen RP-Begriffe steht hier. Trage hier den tatsächlichen Inhalt ein.'
  },
  {
    value: 'fernmeldeausbildung',
    label: 'Fernmeldeausbildung',
    emoji: '📁',
    text: '**Fernmeldeausbildung**\n\nDie Unterlagen zur Fernmeldeausbildung stehen hier. Trage hier den tatsächlichen Inhalt ein.'
  },
  {
    value: 'funkcodes',
    label: 'Funkcodes',
    emoji: '📁',
    text: '**Funkcodes**\n\nDie gängigen Funkcodes stehen hier. Trage hier den tatsächlichen Inhalt ein.'
  },
  {
    value: 'leitfaden-geiselnahmen',
    label: 'Leitfaden Geiselnahmen',
    emoji: '📁',
    text: '**Leitfaden Geiselnahmen**\n\nDer Leitfaden für Geiselnahmen steht hier. Trage hier den tatsächlichen Inhalt ein.'
  },
  {
    value: 'kasernenordnung',
    label: 'Kasernenordnung',
    emoji: '📁',
    text: '**Kasernenordnung**\n\nDie offizielle Kasernenordnung steht hier. Trage hier den tatsächlichen Inhalt ein.'
  }
];

// Discord erlaubt maximal 5 Buttons pro ActionRow.
const BUTTONS_PER_ROW = 5;

// Erzeugt das Panel mit Buttons (statt Select-Menü). Optionaler Einleitungstext
// wird am Anfang des Embeds angezeigt.
function documentMenu(introText) {
  const descriptionParts = [];
  if (introText) descriptionParts.push(introText + '\n\n');
  descriptionParts.push(
    'Drücke auf den Button des Dokuments, das du anzeigen möchtest.\n\n' +
    '**Verfügbare Dokumente:**\n' +
    DOCUMENTS.map(d => `${d.emoji} ${d.label}`).join('\n')
  );

  const embed = new EmbedBuilder()
    .setTitle('🗂️ Allgemeine-Dokumente')
    .setColor(0x2f3136)
    .setDescription(descriptionParts.join(''))
    .setTimestamp();

  const rows = [];
  for (let i = 0; i < DOCUMENTS.length; i += BUTTONS_PER_ROW) {
    const chunk = DOCUMENTS.slice(i, i + BUTTONS_PER_ROW);
    const row = new ActionRowBuilder().addComponents(
      chunk.map(d =>
        new ButtonBuilder()
          .setCustomId(`bww_doc_${d.value}`)
          .setLabel(d.label)
          .setEmoji(d.emoji)
          .setStyle(ButtonStyle.Secondary)
      )
    );
    rows.push(row);
  }

  return { embeds: [embed], components: rows };
}

function documentForValue(value) {
  return DOCUMENTS.find(d => d.value === value);
}

module.exports = { documentMenu, documentForValue, DOCUMENTS };
