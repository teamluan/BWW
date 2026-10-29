// BWW Phase 8 - Verification interactionHandler (Button + Code/Captcha-Modal, eigene Prefix-Gruppe).
// Prefix: bww_verification_* (zuerst pruefen, kein Doppel-Handling mit Giveaway/Ticket/Honeypot/Embed).
// Gibt true zurueck wenn behandelt, sonst false.

const { MessageFlags } = require('discord.js');
const { logger } = require('../../services/logger');
const { VERIFICATION_PREFIX, BUTTON_VERIFY, MODAL_CODE, MODAL_CAPTCHA } = require('./constants');

const log = logger.child('verification:interactions');

async function ephemeral(interaction, content) {
  try {
    const text = String(content).slice(0, 2000);
    if (interaction.deferred || interaction.replied) await interaction.followUp({ content: text, flags: MessageFlags.Ephemeral });
    else await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
  } catch {}
}

async function handleVerificationInteraction(interaction, client) {
  try {
    const cid = String(interaction.customId || '');
    if (!cid.startsWith(VERIFICATION_PREFIX)) return false;
    if (!interaction.guild) { await ephemeral(interaction, 'Nur auf Servern verfuegbar.'); return true; }
    const { startVerificationFlow, handleCodeModalSubmit, handleCaptchaModalSubmit } = require('./flowService');
    if (interaction.isButton?.() && cid === BUTTON_VERIFY) {
      await startVerificationFlow(interaction, client);
      return true;
    }
    if (interaction.isModalSubmit?.() && cid === MODAL_CODE) {
      await handleCodeModalSubmit(interaction, client);
      return true;
    }
    if (interaction.isModalSubmit?.() && (cid === MODAL_CAPTCHA || cid.startsWith(MODAL_CAPTCHA + ':'))) {
      await handleCaptchaModalSubmit(interaction, client);
      return true;
    }
    return false;
  } catch (e) {
    log.warn('Verification-Interaction fehlgeschlagen:', e.message);
    return false;
  }
}

module.exports = { handleVerificationInteraction };
