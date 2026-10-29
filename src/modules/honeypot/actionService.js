// BWW Phase 4 – Action-Service (04_HONEYPOT.md Kap. Aktionen + Sicherheit).
// Aktionen: delete/warn/timeout/kick/ban/notify_staff/log_only.
// VOR Ausführung: Bot-Permissions (ManageMessages/ModerateMembers/Kick/Ban),
// Guild-Kontext, Config + BWW-Berechtigungen validieren. Audit/System-Log schreiben.
// Wirft nie unbehandelt – gibt immer { ok, action, steps, errors } zurück.
// Phase 14: Best-Effort Notification honeypot_triggered (nie werfend).

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { supabaseRequest, isConfigured } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { logAudit } = require('../../services/audit');
const { cleanId, clampText } = require('../../services/validation');

const log = logger.child('honeypot:action');

const PERMS_FOR_ACTION = {
  delete: PermissionFlagsBits.ManageMessages,
  warn: null,
  timeout: PermissionFlagsBits.ModerateMembers,
  kick: PermissionFlagsBits.KickMembers,
  ban: PermissionFlagsBits.BanMembers,
  notify_staff: null,
  log_only: null,
};

function botMember(guild) {
  return guild?.members?.me || null;
}

function hasBotPerm(guild, flag) {
  if (!flag) return true;
  try {
    const me = botMember(guild);
    if (!me) return false;
    return me.permissions?.has?.(flag) === true;
  } catch { return false; }
}

async function writeSystemLog(guildId, level, source, message, details = {}) {
  if (!isConfigured()) return null;
  try {
    const res = await supabaseRequest('bww_system_logs', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        guild_id: String(guildId), level, source: String(source).slice(0, 100),
        message: String(message).slice(0, 2000), details: details && typeof details === 'object' ? details : {},
      }),
    });
    const rows = await res.json().catch(() => []);
    return rows?.[0] || null;
  } catch (err) {
    log.warn('System-Log fehlgeschlagen:', err.message);
    return null;
  }
}

async function sendLogChannel(client, honeypot, { trigger, steps, errors }) {
  const logChannelId = cleanId(honeypot?.log_channel_id || '');
  if (!logChannelId) return false;
  try {
    const guild = client?.guilds?.cache?.get(String(trigger.guild_id)) || await client?.guilds?.fetch(String(trigger.guild_id)).catch(() => null);
    if (!guild) return false;
    const channel = guild.channels.cache.get(logChannelId) || await guild.channels.fetch(logChannelId).catch(() => null);
    if (!channel?.isTextBased()) return false;
    const me = botMember(guild);
    if (me && !channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) return false;
    const userLine = '<@' + trigger.user_id + '> (' + trigger.user_id + ')';
    const potLine = (honeypot?.name || trigger.honeypot_id || '-') + ' (<#' + trigger.channel_id + '>)';
    const embed = new EmbedBuilder()
      .setTitle('Honeypot ausgeloest')
      .addFields(
        { name: 'User', value: userLine.slice(0, 1024), inline: true },
        { name: 'Honeypot', value: potLine.slice(0, 1024), inline: true },
        { name: 'Aktion', value: String(trigger.action || honeypot?.action || 'log_only').slice(0, 100), inline: true },
        { name: 'Schritte', value: (steps.length ? steps.map((s) => '- ' + s).join(chr(10)) : '-').slice(0, 1024), inline: false },
        { name: 'Fehler', value: (errors.length ? errors.map((e) => '- ' + e).join(chr(10)) : '-').slice(0, 1024), inline: false },
        { name: 'Nachricht', value: String(trigger.message_url || trigger.message_id || '-').slice(0, 1024), inline: false },
      )
      .setFooter({ text: 'BWW Honeypot - Phase 4' })
      .setTimestamp();
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    return true;
  } catch (err) {
    log.warn('Log-Channel fehlgeschlagen:', err.message);
    return false;
  }
}

function chr(code) { return String.fromCharCode(code); }

// Führt die konfigurierte Aktion sicher aus. message kann bereits gelöscht sein.
async function executeAction(client, message, honeypot, trigger) {
  const steps = [];
  const errors = [];
  const guildId = String(trigger?.guild_id || message?.guildId || message?.guild?.id || '');
  const userId = String(trigger?.user_id || message?.author?.id || '');
  const reason = 'BWW Honeypot ausgeloest';
  try {
    if (!guildId) throw new Error('Kein Guild-Kontext.');
    if (honeypot && honeypot.enabled === false) throw new Error('Honeypot ist deaktiviert.');
    const guild = message?.guild || client?.guilds?.cache?.get(guildId) || await client?.guilds?.fetch(guildId).catch(() => null);
    if (!guild) throw new Error('Discord-Server nicht verbunden.');
    const member = message?.member || await guild.members.fetch(userId).catch(() => null);
    const mainAction = String(honeypot?.action || trigger?.action || 'log_only');
    const needDelete = Boolean(honeypot?.delete_message) || mainAction === 'delete';
    // 1) Nachricht löschen (falls aktiviert) – braucht ManageMessages
    if (needDelete && message?.deletable) {
      if (!hasBotPerm(guild, PermissionFlagsBits.ManageMessages)) {
        errors.push('Bot braucht ManageMessages zum Loeschen.');
      } else {
        try { await message.delete(); steps.push('Nachricht geloescht'); }
        catch (e) { errors.push('Loeschen fehlgeschlagen: ' + e.message); }
      }
    } else if (needDelete) {
      steps.push('Nachricht bereits entfernt');
    }
    if (!member) {
      errors.push('Mitglied nicht gefunden (evtl. bereits gegangen).');
    } else {
      const runChecked = async (kind, fn) => {
        const flag = PERMS_FOR_ACTION[kind];
        if (flag && !hasBotPerm(guild, flag)) { errors.push('Bot-Recht fehlt fuer ' + kind + '.'); return; }
        try { await fn(); steps.push(kind); }
        catch (e) { errors.push(kind + ': ' + e.message); }
      };
      if (mainAction === 'warn') {
        await runChecked('warn', async () => {
          const text = 'Du hast in <#' + trigger.channel_id + '> eine geschuetzte Zone betreten. Weitere Verstoesse fuehren zu haerteren Massnahmen.';
          try { await member.send({ content: text }); }
          catch { const ch = message?.channel; if (ch?.isTextBased?.()) await ch.send({ content: '<@' + userId + '> ' + text, allowedMentions: { users: [userId] } }).catch(() => {}); }
        });
      } else if (mainAction === 'timeout') {
        const secs = Math.max(60, Math.min(2419200, Number(honeypot?.timeout_duration || 600)));
        await runChecked('timeout', async () => {
          if (!member.moderatable) throw new Error('Mitglied ist fuer den Bot nicht timeoutbar.');
          await member.timeout(secs * 1000, reason);
        });
      } else if (mainAction === 'kick') {
        await runChecked('kick', async () => {
          if (!member.kickable) throw new Error('Mitglied ist fuer den Bot nicht kickbar.');
          await member.kick(reason);
        });
      } else if (mainAction === 'ban') {
        await runChecked('ban', async () => {
          if (!member.bannable) throw new Error('Mitglied ist fuer den Bot nicht bannbar.');
          await member.ban({ reason, deleteMessageSeconds: 0 });
        });
      } else if (mainAction === 'notify_staff' || mainAction === 'log_only' || mainAction === 'delete') {
        steps.push(mainAction === 'delete' ? 'delete (nur Loeschen)' : mainAction);
      } else {
        errors.push('Unbekannte Aktion: ' + mainAction);
      }
      if (honeypot?.timeout_enabled && mainAction !== 'timeout') {
        const secs = Math.max(60, Math.min(2419200, Number(honeypot?.timeout_duration || 600)));
        await runChecked('timeout', async () => {
          if (!member.moderatable) throw new Error('Mitglied ist fuer den Bot nicht timeoutbar.');
          await member.timeout(secs * 1000, reason + ' (Auto-Timeout)');
        });
      }
      if (honeypot?.ban_enabled && mainAction !== 'ban') {
        await runChecked('ban', async () => {
          if (!member.bannable) throw new Error('Mitglied ist fuer den Bot nicht bannbar.');
          await member.ban({ reason: reason + ' (Auto-Ban)', deleteMessageSeconds: 0 });
        });
      }
    }
    await logAudit({ guildId, actorId: client?.user?.id || 'bot', action: 'honeypot.action.' + (trigger?.action || honeypot?.action || 'log_only'), targetId: userId, details: { honeypot_id: trigger?.honeypot_id || null, steps, errors: errors.slice(0, 5) } }).catch(() => {});
    await writeSystemLog(guildId, errors.length && !steps.length ? 'warn' : 'info', 'honeypot', 'Honeypot-Treffer ' + userId + ' (' + (trigger?.action || 'log_only') + '): ' + (steps.join(', ') || 'keine Schritte') + (errors.length ? ' | Fehler: ' + errors.slice(0, 2).join('; ') : ''), { honeypot_id: trigger?.honeypot_id || null, steps, errors }).catch(() => {});
    await sendLogChannel(client, honeypot, { trigger, steps, errors });
    // Phase 14: Best-Effort Notification honeypot_triggered (nie werfend, keine Business-Logik-Aenderung).
    try { const { notifyHoneypotTriggered } = require('../../services/notifications'); notifyHoneypotTriggered(guildId, userId, trigger?.action || honeypot?.action).catch(() => {}); } catch {}
    return { ok: errors.length === 0 || steps.length > 0, action: String(honeypot?.action || 'log_only'), steps, errors };
  } catch (err) {
    const msg = clampText(err.message || 'Aktionsfehler', 500);
    errors.push(msg);
    log.warn('Action-Fehler:', msg);
    try { await logAudit({ guildId, actorId: client?.user?.id || 'bot', action: 'honeypot.action_failed', targetId: userId, details: { error: msg } }); } catch {}
    return { ok: false, action: String(honeypot?.action || 'log_only'), steps, errors };
  }
}

module.exports = { executeAction, writeSystemLog };
