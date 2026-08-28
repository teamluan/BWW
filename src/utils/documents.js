const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');

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

function documentMenu() {
  const embed = new EmbedBuilder()
    .setTitle('🗂️ Allgemeine-Dokumente')
    .setColor(0x2f3136)
    .setDescription(
      'Du suchst ein bestimmtes Dokument?\n\n' +
      'Wähle unten aus, welches Dokument du dir anschauen möchtest.\n\n' +
      '**📄 Dokument auswählen**\n' +
      'Nutze das Auswahlmenü, um ein Dokument auszuwählen.\n' +
      'Anschließend werden dir die entsprechenden Informationen angezeigt.\n\n' +
      '**Verfügbare Dokumente:**\n' +
      DOCUMENTS.map(d => `${d.emoji} ${d.label}`).join('\n') +
      '\n\nWähle unten ein Dokument aus 👇'
    )
    .setTimestamp();

  const select = new StringSelectMenuBuilder()
    .setCustomId('bww_doc_select')
    .setPlaceholder('📄 Dokument auswählen')
    .addOptions(
      DOCUMENTS.map(d =>
        new StringSelectMenuOptionBuilder()
          .setLabel(d.label)
          .setValue(d.value)
          .setEmoji(d.emoji)
          .setDescription(`Zeigt ${d.label} an`)
      )
    );

  const row = new ActionRowBuilder().addComponents(select);
  return { embeds: [embed], components: [row] };
}

function documentForValue(value) {
  return DOCUMENTS.find(d => d.value === value);
}

module.exports = { documentMenu, documentForValue, DOCUMENTS };
