// BWW Phase 6 - Welcome-Flow (06_WELCOME.md: Ablauf).
// Member Join -> Config laden -> Variablen ersetzen -> Welcome Message
// + optional Embed V2 (getEmbedForWelcome/toV2Data aus src/modules/embed)
// + optional DM + optional Auto Role -> Logging, delete_after.
// Architektur: Welcome->EmbedV2 (01_ARCHITECTURE Kap.5), Services: variables,
// messageBuilder. Nie werfend (Event-Isolation), Bots werden ignoriert.

const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const { logger } = require('../../services/logger');
const { getWelcomeConfig } = require('./welcomeService');
const { listCustomVariables, replaceVariables } = require('./variableService');
const { sendWelcomeDM } = require('./dmService');
const { assignAutoRole } = require('./autoRoleService');
const { logWelcome } = require('./logService');

const log = logger.child('welcome:flow');

async function resolveChannel(guild, channelId) {
  if (!channelId) return null;
  let channel = guild.channels.cache.get(channelId) || null;
  if (!channel) {
    try { channel = await guild.channels.fetch(channelId); } catch { return null; }
  }
  if (!channel?.isTextBased?.()) return null;
  return channel;
}

function canSend(channel) {
  try {
    const me = channel.guild?.members?.me;
    if (!me) return true;
    const perms = channel.permissionsFor?.(me);
    if (!perms) return true;
    return perms.has(PermissionFlagsBits.ViewChannel) && perms.has(PermissionFlagsBits.SendMessages);
  } catch { return true; }
}

async function buildEmbedContainer(guildId, config, context) {
  try {
    const embedMod = require('../embed');
    let full = null;
    if (config.embed_id && typeof embedMod.getFullEmbed === 'function') {
      try { full = await embedMod.getFullEmbed(config.embed_id, guildId); } catch { full = null; }
    }
    if (!full && typeof embedMod.getEmbedForWelcome === 'function') {
      const meta = await embedMod.getEmbedForWelcome(guildId).catch(() => null);
      if (meta && typeof embedMod.getFullEmbed === 'function') {
        try { full = await embedMod.getFullEmbed(meta.id, guildId); } catch { full = null; }
      } else if (meta) {
        full = { embed: meta, components: [], buttons: [], options: [] };
      }
    }
    if (!full) return null;
    if (full.embed?.enabled === false) return null;
    const toV2 = embedMod.toV2Data || require('../embed/sendService').toV2Data;
    const v2 = toV2(full, { user: context.user, member: context.member, guild: context.guild });
    // Welcome-Variablen + custom auch auf V2-Texte anwenden (toV2 kennt nur Basis).
    const { replaceVariables: replace } = require('./variableService');
    if (typeof v2.title === 'string') v2.title = replace(v2.title, context, context.customVars);
    if (typeof v2.description === 'string') v2.description = replace(v2.description, context, context.customVars);
    if (Array.isArray(v2.components)) {
      for (const c of v2.components) {
        if (typeof c.content === 'string') c.content = replace(c.content, context, context.customVars);
        if (Array.isArray(c.texts)) c.texts = c.texts.map((t) => replace(String(t), context, context.customVars));
      }
    }
    const { buildEmbedV2 } = require('../../services/messageBuilder');
    const prepared = await buildEmbedV2(v2);
    return prepared;
  } catch (err) {
    log.warn('Welcome-Embed uebersprungen:', err?.message || err);
    return null;
  }
}

async function handleMemberJoin(member, opts = {}) {
  const guild = member?.guild;
  if (!guild) return { skipped: 'no-guild' };
  try {
    if (member.user?.bot && opts.ignoreBots !== false) return { skipped: 'bot' };
    const config = await getWelcomeConfig(guild.id).catch(() => null);
    if (!config || config.enabled === false) return { skipped: 'disabled' };
    const customVars = await listCustomVariables(guild.id, { onlyEnabled: true }).catch(() => []);
    // Kanal aufloesen (fuer {channel}-Variablen schon vor Send noetig).
    const channel = await resolveChannel(guild, config.channel_id);
    const context = { member, user: member.user, guild, channel, customVars };
    const resolved = replaceVariables(config.message || '', context, customVars);
    // Parallele Nebenlaeufe (DM + Rolle) - Fehler isoliert.
    const dmP = sendWelcomeDM(member, { ...config, dm_message: replaceVariables(config.dm_message || '', context, customVars) }, []).catch(() => ({ sent: false }));
    const roleP = assignAutoRole(member, config).catch(() => ({ applied: false }));
    let sent = null;
    let channelId = channel?.id || null;
    if (channel && canSend(channel)) {
      try {
        const prepared = await buildEmbedContainer(guild.id, config, context);
        if (prepared?.container) {
          sent = await channel.send({
            content: resolved?.trim() ? resolved.slice(0, 2000) : undefined,
            components: [prepared.container],
            files: prepared.attachments || [],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: ['users'] },
          });
        } else if (resolved?.trim()) {
          sent = await channel.send({ content: resolved.slice(0, 2000), allowedMentions: { parse: ['users'] } });
        }
        if (sent && Number(config.delete_after) > 0) {
          const ms = Math.min(86400, Number(config.delete_after)) * 1000;
          setTimeout(() => { sent.delete().catch(() => {}); }, ms);
        }
      } catch (err) {
        log.warn('Welcome-Send fehlgeschlagen:', guild.id, '-', err?.message || err);
        await logWelcome({ guildId: guild.id, userId: member.id, channelId, messageId: null, sentSuccess: false, error: err?.message || 'send-failed' });
      }
    }
    if (sent) {
      await logWelcome({ guildId: guild.id, userId: member.id, channelId: sent.channelId || channelId, messageId: sent.id, sentSuccess: true });
    } else if (channelId && !sent) {
      // Kein Send (keine Rechte/kein Text) trotzdem Audit-Spur, aber nur wenn Kanal existiert.
      await logWelcome({ guildId: guild.id, userId: member.id, channelId, messageId: null, sentSuccess: false, error: 'skipped' });
    }
    const [dm, role] = await Promise.all([dmP, roleP]);
    return { ok: true, messageId: sent?.id || null, dm, role };
  } catch (err) {
    log.warn('Welcome-Flow Fehler:', guild?.id, '-', err?.message || err);
    return { ok: false, error: String(err?.message || err).slice(0, 300) };
  }
}

// Vorschau/Test ohne Join-Event (fuer /welcome-test + Dashboard test-send).
async function sendTestMessage(guild, actorMember, channelId = null) {
  const config = await getWelcomeConfig(guild.id);
  if (!config) throw new Error('Kein Welcome konfiguriert.');
  const customVars = await listCustomVariables(guild.id, { onlyEnabled: true }).catch(() => []);
  const channel = await resolveChannel(guild, channelId || config.channel_id);
  if (!channel) throw new Error('Welcome-Channel nicht gefunden.');
  if (!canSend(channel)) throw new Error('Bot darf hier nicht schreiben.');
  const context = { member: actorMember, user: actorMember?.user || null, guild, channel, customVars };
  const resolved = replaceVariables(config.message || 'Willkommen {user}!', context, customVars);
  const prepared = await buildEmbedContainer(guild.id, config, context);
  let sent;
  if (prepared?.container) {
    sent = await channel.send({
      content: resolved?.trim() ? resolved.slice(0, 2000) : undefined,
      components: [prepared.container],
      files: prepared.attachments || [],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: ['users'] },
    });
  } else {
    sent = await channel.send({ content: resolved.slice(0, 2000) || 'Willkommen!', allowedMentions: { parse: ['users'] } });
  }
  if (sent && Number(config.delete_after) > 0) {
    const ms = Math.min(86400, Number(config.delete_after)) * 1000;
    setTimeout(() => { sent.delete().catch(() => {}); }, ms);
  }
  await logWelcome({ guildId: guild.id, userId: actorMember?.id || 'test', channelId: channel.id, messageId: sent.id, sentSuccess: true });
  return sent;
}

module.exports = { handleMemberJoin, sendTestMessage };
