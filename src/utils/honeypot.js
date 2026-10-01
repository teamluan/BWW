const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { recordHoneypotEvent } = require('./database');

const VALID_PUNISHMENTS = new Set(['none', 'kick', 'ban', 'timeout']);
const TRIGGER_COOLDOWN_MS = 15_000;
const triggerCache = new Map();

function normalizeHoneypot(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const punishment = VALID_PUNISHMENTS.has(String(source.punishment)) ? String(source.punishment) : 'none';
  const timeoutMinutes = Math.max(1, Math.min(40320, Number(source.timeoutMinutes) || 10));
  const cleanId = (value) => String(value || '').replace(/\D/g, '');
  const exemptRoleIds = Array.isArray(source.exemptRoleIds)
    ? [...new Set(source.exemptRoleIds.map(cleanId).filter(Boolean))].slice(0, 25)
    : [];

  return {
    enabled: Boolean(source.enabled),
    channelId: cleanId(source.channelId),
    logChannelId: cleanId(source.logChannelId),
    punishment,
    timeoutMinutes,
    deleteMessage: source.deleteMessage !== false,
    ignoreAdmins: source.ignoreAdmins !== false,
    exemptRoleIds
  };
}

function isConfigured(config) {
  return Boolean(config?.honeypot?.enabled && config.honeypot.channelId);
}

function isExempt(message, config) {
  const member = message.member;
  if (!member) return false;
  if (config.ignoreAdmins && member.permissions?.has?.(PermissionFlagsBits.Administrator)) return true;
  return config.exemptRoleIds.some((roleId) => member.roles?.cache?.has?.(roleId));
}

function shouldThrottle(userId, now = Date.now()) {
  const previous = triggerCache.get(userId) || 0;
  if (now - previous < TRIGGER_COOLDOWN_MS) return true;
  triggerCache.set(userId, now);
  if (triggerCache.size > 5000) {
    for (const [id, timestamp] of triggerCache) {
      if (now - timestamp >= TRIGGER_COOLDOWN_MS) triggerCache.delete(id);
    }
  }
  return false;
}

async function applyPunishment(message, config) {
  const punishment = config.punishment;
  if (punishment === 'none') return { success: true, error: null };
  const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member) return { success: false, error: 'Mitglied konnte nicht geladen werden.' };
  const reason = 'BWW Honeypot ausgelöst';
  try {
    if (punishment === 'kick') {
      if (!member.kickable) return { success: false, error: 'Mitglied ist für den Bot nicht kickbar.' };
      await member.kick(reason);
      return { success: true, error: null };
    }
    if (punishment === 'ban') {
      if (!member.bannable) return { success: false, error: 'Mitglied ist für den Bot nicht bannbar.' };
      await member.ban({ reason });
      return { success: true, error: null };
    }
    if (punishment === 'timeout') {
      if (!member.moderatable) return { success: false, error: 'Mitglied ist für den Bot nicht timeoutbar.' };
      const durationMs = Math.min(28 * 24 * 60 * 60 * 1000, config.timeoutMinutes * 60 * 1000);
      await member.timeout(durationMs, reason);
      return { success: true, error: null };
    }
    return { success: false, error: 'Unbekannte Honeypot-Bestrafung.' };
  } catch (error) {
    return { success: false, error: String(error?.message || 'Bestrafung fehlgeschlagen.').slice(0, 500) };
  }
}

async function sendLog(message, config, punishmentResult, deleted) {
  if (!config.logChannelId) return;
  const channel = message.guild.channels.cache.get(config.logChannelId)
    || await message.guild.channels.fetch(config.logChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const punishmentLabel = {
    none: 'Keine',
    kick: 'Kick',
    ban: 'Ban',
    timeout: 'Timeout (' + config.timeoutMinutes + ' Min.)'
  }[config.punishment] || config.punishment;
  const embed = new EmbedBuilder()
    .setTitle('🍯 Honeypot ausgelöst')
    .addFields(
      { name: 'Mitglied', value: '<@' + message.author.id + '>\n`' + message.author.id + '`', inline: true },
      { name: 'Kanal', value: '<#' + message.channel.id + '>', inline: true },
      { name: 'Bestrafung', value: punishmentLabel, inline: true },
      { name: 'Ergebnis', value: punishmentResult.success ? '✅ erfolgreich' : '❌ ' + (punishmentResult.error || 'fehlgeschlagen'), inline: true },
      { name: 'Nachricht gelöscht', value: deleted ? '✅ Ja' : '❌ Nein', inline: true },
      { name: 'Nachricht', value: '[Zur Nachricht](' + message.url + ')', inline: true }
    )
    .setFooter({ text: 'BWW Honeypot' })
    .setTimestamp();
  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
}

async function honeypot(message, configSource) {
  if (!message?.guild || !message.author || message.author.bot || message.webhookId) return;
  const config = normalizeHoneypot(configSource);
  if (!isConfigured({ honeypot: config })) return;
  if (message.channelId !== config.channelId) return;
  if (isExempt(message, config)) return;
  if (shouldThrottle(message.author.id)) return;

  let deleted = false;
  if (config.deleteMessage) {
    try { await message.delete(); deleted = true; } catch {}
  }

  const punishment = await applyPunishment(message, config);
  await recordHoneypotEvent(message.guildId, {
    channelId: message.channelId,
    messageId: message.id,
    userId: message.author.id,
    username: message.author.tag || message.author.username,
    punishment: config.punishment,
    punishmentSuccess: punishment.success,
    messageDeleted: deleted,
    messageUrl: message.url,
    error: punishment.error
  }).catch((error) => console.error('[BWW] Honeypot-Event konnte nicht gespeichert werden:', error.message));
  await sendLog(message, config, punishment, deleted);
  console.warn('[BWW] Honeypot ausgelöst:', message.guildId + '/' + message.channelId + '/' + message.author.id, config.punishment, punishment.success ? 'ok' : punishment.error);
}

module.exports = { normalizeHoneypot, honeypot };