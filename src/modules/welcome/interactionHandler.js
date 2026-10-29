// BWW Phase 6 - Welcome interactionHandler (Router-Pattern wie Honeypot/Embed).
// Welcome hat keine Button/Select-Interaktionen - gibt immer false zurueck
// (kein Doppel-Handling, Legacy bleibt unberuehrt). Export fuer Barrel/Router.

async function handleWelcomeInteraction(interaction, client) {
  return false;
}

module.exports = { handleWelcomeInteraction };
