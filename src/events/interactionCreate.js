// BWW Phase 9 - events/interactionCreate.js (konsolidiertes Slash-Routing).
// Reihenfolge: Giveaway -> Verification (eigene Prefix-Gruppe bww_verification_*, kein Doppel-Handling)
// -> Ticket-Priority/Close-Modal -> Honeypot -> Ticket -> Embed V2 -> Modulare Slash (Phase 9) -> Legacy.
// Phase 9: zentrale Registry fuer alle modularen Slash-Commands (ticket/honeypot/embed/welcome/giveaway/
// verify+verification/setup/config/settings/help/ping). Kein Doppel-Handling mit Button/Select-Prefix-Gruppen.
// Phase 11: zentrales Button-/Select-/Modal-Gate (Matrix) VOR Modul-Routing – ein Pruefpunkt fuer alle
// Button-Aktionen (keine Sonder-Checks mehr in den Handlern noetig). Self-Service-Aktionen
// (Ticket erstellen, Giveaway teilnehmen, Verifizieren) brauchen keinen Check (Modul-/Service-Layer
// entscheidet, z. B. Ticket-Ersteller-Regeln). Modul-Handler behalten ihre Checks als zweite Schicht.
const { MessageFlags } = require('discord.js');
const legacy = require('./interactions');

// Phase 11 – zentrales Component-Gate (11_PERMISSIONS Pruefmodell: Membership -> Discord -> BWW -> Action).
// Gibt true zurueck wenn weitergeroutet werden darf (oder Antwort bereits gesendet und return noetig ist
// via return false). Nie werfend (Fail-open NUR bei Gate-Fehler – Handler/Service pruefen erneut).
async function gateComponentPermission(interaction) {
  try {
    const cid = interaction.customId || '';
    if (!cid) return true;
    const isComponent = interaction.isButton?.() || interaction.isStringSelectMenu?.() || interaction.isModalSubmit?.();
    if (!isComponent) return true;
    if (interaction.isChatInputCommand?.()) return true;
    const { permissionForCustomId, hasPermission, loadGuildRoleMappings } = require('../services/permissions');
    const perm = permissionForCustomId(cid);
    if (!perm) return true; // Self-Service / unbekannt (Service-Layer entscheidet, z. B. Ersteller-Regeln)
    if (!interaction.guildId || !interaction.guild || !interaction.member) {
      try {
        if (interaction.deferred || interaction.replied) await interaction.followUp({ content: 'Nur auf Servern.', flags: MessageFlags.Ephemeral });
        else await interaction.reply({ content: 'Nur auf Servern.', flags: MessageFlags.Ephemeral });
      } catch {}
      return false;
    }
    const { getGuildSettings } = require('../utils/database');
    const [settings, guildRoles] = await Promise.all([
      getGuildSettings(interaction.guildId).catch(() => null),
      loadGuildRoleMappings(interaction.guildId).catch(() => []),
    ]);
    const ok = await hasPermission(interaction.member, perm, { guildId: interaction.guildId, guildRoles, settings }).catch(() => false);
    if (!ok) {
      const msg = 'Keine Berechtigung (' + perm + ').';
      try {
        if (interaction.deferred || interaction.replied) await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
        else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      } catch {}
      return false;
    }
    return true;
  } catch { return true; }
}

// Phase 9: zentrale modulare Slash-Registry (duenne Wrapper, keine Business-Logik).
// Legacy-Aliase bleiben erhalten und werden hier vor Legacy geroutet.
const MODULAR_COMMANDS = {
  ticket: '../commands/ticket/ticket',
  'ticket-panel-create': '../commands/ticket/panel-create',
  'ticket-type-add': '../commands/ticket/type-add',
  honeypot: '../commands/honeypot/honeypot',
  'honeypot-create': '../commands/honeypot/honeypot-create',
  'honeypot-list': '../commands/honeypot/honeypot-list',
  'honeypot-toggle': '../commands/honeypot/honeypot-toggle',
  'honeypot-exempt-add': '../commands/honeypot/honeypot-exempt-add',
  'honeypot-exempt-remove': '../commands/honeypot/honeypot-exempt-remove',
  embed: '../commands/embed/embed',
  'embed-create': '../commands/embed/embed-create',
  'embed-list': '../commands/embed/embed-list',
  'embed-send': '../commands/embed/embed-send',
  'embed-clone': '../commands/embed/embed-clone',
  'embed-component-add': '../commands/embed/embed-component-add',
  welcome: '../commands/welcome/welcome',
  'welcome-setup': '../commands/welcome/welcome-setup',
  'welcome-test': '../commands/welcome/welcome-test',
  'welcome-toggle': '../commands/welcome/welcome-toggle',
  'welcome-variables': '../commands/welcome/welcome-variables',
  giveaway: '../commands/giveaway/giveaway',
  verify: '../commands/verification/verify',
  verification: '../commands/verification/verification',
  'verification-setup': '../commands/verification/verification-setup',
  'verification-reset': '../commands/verification/verification-reset',
  'verification-status': '../commands/verification/verification-status',
  setup: '../commands/general/setup',
  config: '../commands/general/config',
  settings: '../commands/general/settings',
  help: '../commands/general/help',
  ping: '../commands/general/ping',
};
async function execute(interaction, client) {
  try {
    // Phase 11: Component-Gate (Matrix) zuerst – ein Pruefpunkt fuer alle Button-Aktionen.
    if (!(await gateComponentPermission(interaction))) return;
    // 0) Giveaway-Modul (Teilnehmen-Button zuerst, eigene Prefix-Gruppe)
    try {
      const { handleGiveawayInteraction } = require('../modules/giveaway/interactionHandler');
      if (await handleGiveawayInteraction(interaction, client)) return;
    } catch (err) {
      console.error('[BWW] Giveaway-Interaction Fehler:', err?.message || err);
    }
    // 0b) Verification-Modul (Verify-Button + Code/Captcha-Modal, eigene Prefix-Gruppe)
    try {
      const { handleVerificationInteraction } = require('../modules/verification/interactionHandler');
      if (await handleVerificationInteraction(interaction, client)) return;
    } catch (err) {
      console.error('[BWW] Verification-Interaction Fehler:', err?.message || err);
    }
    // 0c) Priority-Select (bww_ticket_priority_<id>) + Close-Modal (vor Button-Branch)
    try {
      const cid0 = interaction.customId || '';
      if (interaction.isStringSelectMenu?.() && cid0.startsWith('bww_ticket_priority_')) {
        const ticketId = cid0.replace('bww_ticket_priority_', '');
        const priority = interaction.values?.[0];
        const { setPriority } = require('../modules/ticket/actionsService');
        try {
          await setPriority(client, ticketId, interaction.member, priority);
          await interaction.reply({ content: 'Prioritaet: ' + priority, flags: MessageFlags.Ephemeral });
        } catch (e) {
          await interaction.reply({ content: e.message, flags: MessageFlags.Ephemeral });
        }
        return;
      }
      if (interaction.isModalSubmit?.() && cid0.startsWith('bww_ticket_close_modal_')) {
        const ticketId = cid0.replace('bww_ticket_close_modal_', '');
        const reason = interaction.fields?.getTextInputValue('reason') || 'Kein Grund angegeben';
        const { closeTicket } = require('../modules/ticket/actionsService');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          await closeTicket(client, ticketId, interaction.member, reason);
          await interaction.followUp({ content: 'Ticket geschlossen.', flags: MessageFlags.Ephemeral });
        } catch (e) {
          await interaction.followUp({ content: e.message, flags: MessageFlags.Ephemeral });
        }
        return;
      }
    } catch {}
    // 1) Honeypot-Modul (toggle/delete Buttons, kein Doppel-Handling)
    try {
      const { handleHoneypotInteraction } = require('../modules/honeypot/interactionHandler');
      if (await handleHoneypotInteraction(interaction, client)) return;
    } catch (err) {
      console.error('[BWW] Honeypot-Interaction Fehler:', err?.message || err);
    }
    // 2) Ticket-Modul (Buttons/Selects/Panel)
    try {
      const { handleTicketInteraction } = require('../modules/ticket/interactionHandler');
      if (await handleTicketInteraction(interaction, client)) return;
    } catch (err) {
      console.error('[BWW] Ticket-Interaction Fehler:', err?.message || err);
    }
    // 3) Embed-V2-Modul (eigene Prefixe, keine Ueberschneidung)
    try {
      const { handleEmbedInteraction } = require('../modules/embed/interactionHandler');
      if (await handleEmbedInteraction(interaction, client)) return;
    } catch (err) {
      console.error('[BWW] Embed-Interaction Fehler:', err?.message || err);
    }
    // 4) Modulare Slash-Commands (Phase 9: konsolidiert, vor Legacy, kein Doppel-Handling)
    // Phase 11: Slash-Permission prueft jeder Command selbst (Matrix je Subcommand,
    // 09-Grundprinzip Schritte 1-3) – keine zentrale Sonder-Logik noetig.
    try {
      if (interaction.isChatInputCommand?.()) {
        const name = interaction.commandName;
        const target = MODULAR_COMMANDS[name];
        if (target) {
          const cmd = require(target);
          await cmd.execute(interaction, client);
          return;
        }
      }
    } catch (err) {
      console.error('[BWW] Modular-Command Fehler:', err?.message || err);
    }
    // 5) Legacy (Panels alt, Giveaways alt, Modals alt, Slash-Commands alt)
    await legacy(interaction, client);
  } catch (err) {
    console.error('Interaction Fehler:', err?.stack || err?.message || err);
    if (interaction?.isRepliable?.() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Unerwarteter Fehler.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
}
module.exports = execute;
module.exports.execute = execute;
module.exports.MODULAR_COMMANDS = MODULAR_COMMANDS;
