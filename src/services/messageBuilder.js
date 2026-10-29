// BWW Phase 1 – MessageBuilder-Service (01_ARCHITECTURE: message builder).
// Zentrale Stelle fuer Embeds/Components. Delegiert an src/utils/embeds.js
// (prepareEmbedV2), damit kein Doppel-Code entsteht. Module (Ticket/Welcome/
// Giveaway) rufen NUR diesen Service, nie discord.js direkt fuer Standard-Layouts.

const { EmbedBuilder } = require('discord.js');
const { applyVariables } = require('./variables');

function buildSimpleEmbed({ title = '', description = '', color = 0x5865f2, context } = {}) {
  return new EmbedBuilder()
    .setTitle(String(applyVariables(title, context)).slice(0, 256))
    .setDescription(String(applyVariables(description, context)).slice(0, 4096))
    .setColor(color)
    .setTimestamp();
}

// Embed-V2 (ComponentsV2-Container) – duenne Huelle um utils/embeds.prepareEmbedV2.
// utils bleibt kanonisch, bis Phase 3 (05_EMBED_V2) den Builder traeegt.
async function buildEmbedV2(data) {
  const utils = require('../utils/embeds');
  if (typeof utils.prepareEmbedV2 !== 'function') throw new Error('prepareEmbedV2 fehlt in src/utils/embeds.js.');
  return utils.prepareEmbedV2(data || {});
}

module.exports = { buildSimpleEmbed, buildEmbedV2 };
