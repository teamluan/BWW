// BWW Phase 7 - Giveaway interactionHandler (Button-Router, eigene Prefix-Gruppe zuerst).
// Prefixe: bww_giveaway_join_* (Teilnehmen) zuerst, dann leave/end/reroll/cancel.
// Gibt true zurueck wenn behandelt, sonst false (kein Doppel-Handling mit
// Ticket/Honeypot/Embed: nur bww_giveaway_*, alles andere -> false).

const { MessageFlags } = require('discord.js');
const { logger } = require('../../services/logger');
const { BUTTON_PREFIX_JOIN, BUTTON_PREFIX_LEAVE, BUTTON_PREFIX_END, BUTTON_PREFIX_REROLL, BUTTON_PREFIX_CANCEL, GIVEAWAY_PREFIX } = require('./constants');

const log = logger.child('giveaway:interactions');

async function ephemeral(interaction, content) {
  try {
    const text = String(content).slice(0, 2000);
    if (interaction.deferred || interaction.replied) await interaction.followUp({ content: text, flags: MessageFlags.Ephemeral });
    else await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
  } catch {}
}

async function handleGiveawayInteraction(interaction, client) {
  try {
    if (!interaction.isButton?.()) return false;
    const cid = String(interaction.customId || '');
    if (!cid.startsWith(GIVEAWAY_PREFIX)) return false;
    if (!interaction.guild) { await ephemeral(interaction, 'Nur auf Servern verfuegbar.'); return true; }
    const { getGiveaway } = require('./giveawayService');
    const { joinGiveawayEntry, leaveGiveawayEntry } = require('./entryService');
    const { updateGiveawayMessage } = require('./giveawayMessage');
    if (cid.startsWith(BUTTON_PREFIX_JOIN)) {
      const id = cid.slice(BUTTON_PREFIX_JOIN.length);
      if (!id) { await ephemeral(interaction, 'Ungueltige Giveaway-ID.'); return true; }
      const g = await getGiveaway(id, interaction.guildId).catch(() => null);
      if (!g) { await ephemeral(interaction, 'Giveaway nicht gefunden.'); return true; }
      const member = interaction.member || await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      try {
        const res = await joinGiveawayEntry(g, member);
        await updateGiveawayMessage(client, g).catch(() => {});
        const hint = (res.pending || []).length ? '\nHinweis: ' + res.pending.map((p) => p.message).join(' ') : '';
        await ephemeral(interaction, 'Du bist dabei! Viel Glueck!' + hint.slice(0, 500));
      } catch (e) { await ephemeral(interaction, String(e.message)); }
      return true;
    }
    if (cid.startsWith(BUTTON_PREFIX_LEAVE)) {
      const id = cid.slice(BUTTON_PREFIX_LEAVE.length);
      const g = await getGiveaway(id, interaction.guildId).catch(() => null);
      if (!g) { await ephemeral(interaction, 'Giveaway nicht gefunden.'); return true; }
      try {
        await leaveGiveawayEntry(g, interaction.user.id);
        await updateGiveawayMessage(client, g).catch(() => {});
        await ephemeral(interaction, 'Du nimmst nicht mehr teil.');
      } catch (e) { await ephemeral(interaction, String(e.message)); }
      return true;
    }
    if (cid.startsWith(BUTTON_PREFIX_END) || cid.startsWith(BUTTON_PREFIX_REROLL) || cid.startsWith(BUTTON_PREFIX_CANCEL)) {
      const isEnd = cid.startsWith(BUTTON_PREFIX_END);
      const isReroll = cid.startsWith(BUTTON_PREFIX_REROLL);
      const id = isEnd ? cid.slice(BUTTON_PREFIX_END.length) : isReroll ? cid.slice(BUTTON_PREFIX_REROLL.length) : cid.slice(BUTTON_PREFIX_CANCEL.length);
      try {
        const { getGuildSettings } = require('../../utils/database');
        const { hasCommandPermission } = require('../../services/permissions');
        const settings = await getGuildSettings(interaction.guildId).catch(() => null);
        const { PermissionFlagsBits } = require('discord.js');
        const admin = interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator);
        if (!admin && !hasCommandPermission(interaction.member, 'giveaway', settings)) { await ephemeral(interaction, 'Du darfst Giveaways nicht verwalten.'); return true; }
      } catch {}
      const g = await getGiveaway(id, interaction.guildId).catch(() => null);
      if (!g) { await ephemeral(interaction, 'Giveaway nicht gefunden.'); return true; }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
      try {
        if (isEnd) {
          const { endGiveaway } = require('./endService');
          const winners = await endGiveaway(client, g, { actorId: interaction.user.id });
          await interaction.followUp({ content: winners.length ? 'Beendet. Gewinner: ' + winners.map((w) => '<@' + w + '>').join(', ') : 'Beendet. Keine Teilnehmer.', flags: MessageFlags.Ephemeral });
        } else if (isReroll) {
          const { rerollGiveaway } = require('./rerollService');
          const res = await rerollGiveaway(client, g, { actorId: interaction.user.id });
          await interaction.followUp({ content: res.newWinnerIds.length ? 'Neue Gewinner: ' + res.newWinnerIds.map((w) => '<@' + w + '>').join(', ') : 'Keine weiteren Teilnehmer.', flags: MessageFlags.Ephemeral });
        } else {
          const { cancelGiveaway } = require('./giveawayService');
          await cancelGiveaway(g.id, g.guild_id, interaction.user.id);
          await updateGiveawayMessage(client, { ...g, status: 'cancelled' }).catch(() => {});
          await interaction.followUp({ content: 'Giveaway abgebrochen.', flags: MessageFlags.Ephemeral });
        }
      } catch (e) { await interaction.followUp({ content: String(e.message), flags: MessageFlags.Ephemeral }).catch(() => ephemeral(interaction, String(e.message))); }
      return true;
    }
    return false;
  } catch (e) {
    log.warn('Giveaway-Interaction fehlgeschlagen:', e.message);
    return false;
  }
}

module.exports = { handleGiveawayInteraction };
