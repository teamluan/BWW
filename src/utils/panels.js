const fs = require('fs');
const path = require('path');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const file = path.join(__dirname, '..', '..', 'config', 'panels.json');

function loadPanels() {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}
function savePanels(panels) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(panels, null, 2));
  return panels;
}
function getPanel(name) {
  const panels = loadPanels();
  return panels[name] || null;
}
function setPanel(name, data) {
  const panels = loadPanels();
  panels[name] = data;
  savePanels(panels);
}
function deletePanel(name) {
  const panels = loadPanels();
  if (!(name in panels)) return false;
  delete panels[name];
  savePanels(panels);
  return true;
}
function panelContainer(panel, panelName) {
  const container = new ContainerBuilder().setAccentColor(0x2F3136);
  const intro = panel.intro || `Panel: ${panelName}`;
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${intro}`));
  if (panel.buttons && panel.buttons.length) {
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  }
  for (let i = 0; i < panel.buttons.length; i += 5) {
    const chunk = panel.buttons.slice(i, i + 5);
    const row = new ActionRowBuilder().addComponents(chunk.map((b, idx) => {
      const globalIdx = i + idx;
      return new ButtonBuilder().setCustomId(`bww_panel_${panelName}_${globalIdx}`).setLabel(String(b.label).slice(0, 80)).setStyle(ButtonStyle.Secondary);
    }));
    container.addActionRowComponents(row);
  }
  return container;
}
function buttonResponseContainer(panelName, button) {
  const container = new ContainerBuilder().setAccentColor(0x2F3136);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(String(button.text)));
  return container;
}

module.exports = { loadPanels, savePanels, getPanel, setPanel, deletePanel, panelContainer, buttonResponseContainer, file };
