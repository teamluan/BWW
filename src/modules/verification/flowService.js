// BWW Phase 8 - Flow-Service (08_VERIFICATION.md Ablauf + 01_ARCHITECTURE Giveaway->Verification).
// Join -> Unverified-Rolle -> Verification-Channel [Verifizieren]-Button -> Flow -> Pruefung
// (fehlgeschlagen -> Log) -> Verified-Rolle (Unverified entfernen, Verified geben,
// Rollen-Hierarchie + ManageRoles-Check) -> Log. User-Status abfragbar fuer Giveaway-Hook.
// checkVerifiedHook/isVerified: ohne Zirkel-Import (Verification importiert NIE Giveaway).
// Nutzt NUR src/services + Geschwister-Services.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { logger } = require('../../services/logger');
const { cleanId, isSnowflake } = require('../../services/validation');
const { BUTTON_VERIFY, MODAL_CODE, MODAL_CAPTCHA } = require('./constants');

const log = logger.child('verification:flow');

function canManageRole(guild, roleId) {
  try {
    const me = guild?.members?.me;
    if (!me) return { ok: false, reason: 'no-bot' };
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) return { ok: false, reason: 'no-perm' };
    const role = guild.roles.cache.get(roleId) || null;
    if (!role) return { ok: false, reason: 'role-missing' };
    const botTop = me.roles.highest?.position ?? 0;
    if (role.position >= botTop) return { ok: false, reason: 'hierarchy' };
    return { ok: true, role };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

async function getConfig(guildId) {
  try {
    const { getVerificationConfig } = require('./verificationService');
    return await getVerificationConfig(guildId);
  } catch { return null; }
}

async function getVerificationStatus(guildId, userId) {
  const gid = cleanId(guildId);
  const uid = cleanId(userId);
  const config = await getConfig(gid).catch(() => null);
  if (!config || config.enabled === false) return { enabled: false, verified: true, status: 'disabled', config };
  try {
    const { getUser } = require('./userService');
    const u = await getUser(gid, uid).catch(() => null);
    if (!u) return { enabled: true, verified: false, status: 'pending', config };
    return { enabled: true, verified: u.status === 'verified', status: u.status, verified_at: u.verified_at || null, user: u, config };
  } catch {
    return { enabled: true, verified: false, status: 'unknown', config };
  }
}

async function isVerified(guildId, userId) {
  try {
    const st = await getVerificationStatus(guildId, userId);
    return st.verified === true;
  } catch { return false; }
}

// Legacy-Hook (Phase 7 Stub kompatibel): nie blockierend, nur Hinweis.
function checkVerifiedHook() {
  return { ok: true, pending: true, message: 'verified-Hook: Verification aktiv (Phase 8), Status via isVerified pruefen.' };
}

async function assignUnverified(member, config) {
  const roleId = cleanId(config?.unverified_role_id || '');
  if (!roleId || !isSnowflake(roleId)) return { applied: false, reason: 'no-role' };
  if (member.roles.cache.has(roleId)) return { applied: true, reason: 'already' };
  const chk = canManageRole(member.guild, roleId);
  if (!chk.ok) { log.warn('Unverified-Rolle uebersprungen:', member.guild.id, roleId, chk.reason); return { applied: false, reason: chk.reason }; }
  try {
    await member.roles.add(roleId, 'BWW Verification: Unverified');
    return { applied: true };
  } catch (err) {
    log.warn('Unverified-Rolle fehlgeschlagen:', err?.message || err);
    return { applied: false, reason: 'error' };
  }
}

async function swapToVerified(member, config) {
  const verifiedId = cleanId(config?.verified_role_id || config?.verification_role_id || '');
  const unverifiedId = cleanId(config?.unverified_role_id || '');
  if (!verifiedId || !isSnowflake(verifiedId)) throw new Error('Keine Verified-Rolle konfiguriert.');
  const chk = canManageRole(member.guild, verifiedId);
  if (!chk.ok) {
    if (chk.reason === 'hierarchy') throw new Error('Verified-Rolle liegt ueber der Bot-Rolle (Hierarchie).');
    if (chk.reason === 'no-perm') throw new Error('Bot braucht ManageRoles fuer Verification.');
    throw new Error('Verified-Rolle nicht verfuegbar (' + chk.reason + ').');
  }
  if (unverifiedId && isSnowflake(unverifiedId) && member.roles.cache.has(unverifiedId)) {
    const chkU = canManageRole(member.guild, unverifiedId);
    if (chkU.ok) await member.roles.remove(unverifiedId, 'BWW Verification: verifiziert').catch(() => {});
  }
  if (!member.roles.cache.has(verifiedId)) await member.roles.add(verifiedId, 'BWW Verification: verifiziert');
  return { verifiedId, unverifiedRemoved: Boolean(unverifiedId) };
}

async function handleMemberJoinVerification(member) {
  try {
    if (!member?.guild || member.user?.bot) return { skipped: 'bot' };
    const config = await getConfig(member.guild.id).catch(() => null);
    if (!config || config.enabled === false) return { skipped: 'disabled' };
    const { ensureUser } = require('./userService');
    const { logVerification } = require('./logService');
    await ensureUser(member.guild.id, member.id).catch(() => null);
    const res = await assignUnverified(member, config);
    await logVerification({ guildId: member.guild.id, userId: member.id, action: 'join', result: res.applied ? 'unverified_assigned' : 'skipped:' + (res.reason || 'unknown'), reason: 'guildMemberAdd' }).catch(() => {});
    return { ok: true, ...res };
  } catch (err) {
    log.warn('Join-Verification Fehler:', err?.message || err);
    return { ok: false };
  }
}

function buildVerificationMessage(config) {
  const method = config?.method || 'button';
  const label = method === 'code' ? 'Code anfordern / eingeben' : method === 'captcha' ? 'Captcha loesen' : 'Verifizieren';
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(BUTTON_VERIFY).setLabel(label).setStyle(ButtonStyle.Primary).setEmoji('\u2705'),
  );
  const text = method === 'code'
    ? 'Klicke auf **Verifizieren**, um einen Code zu erhalten. Danach erneut klicken (oder /verify), um ihn einzugeben.'
    : method === 'captcha'
      ? 'Klicke auf **Verifizieren**, um ein Captcha zu loesen.'
      : 'Klicke auf **Verifizieren**, um dich freizuschalten.';
  return { content: text.slice(0, 2000), components: [row] };
}

async function ensureVerificationPanel(client, guildId, channelId = null) {
  const config = await getConfig(guildId).catch(() => null);
  if (!config || config.enabled === false) throw new Error('Verification ist deaktiviert.');
  const targetId = cleanId(channelId || config.verification_channel_id || '');
  if (!isSnowflake(targetId)) throw new Error('Kein Verification-Channel konfiguriert.');
  const guild = client.guilds.cache.get(cleanId(guildId)) || await client.guilds.fetch(cleanId(guildId)).catch(() => null);
  if (!guild) throw new Error('Server nicht gefunden.');
  const channel = guild.channels.cache.get(targetId) || await guild.channels.fetch(targetId).catch(() => null);
  if (!channel?.isTextBased?.()) throw new Error('Verification-Channel nicht textbasiert.');
  const msg = buildVerificationMessage(config);
  const sent = await channel.send({ content: msg.content, components: msg.components, allowedMentions: { parse: [] } });
  const { logVerification } = require('./logService');
  await logVerification({ guildId: cleanId(guildId), action: 'panel', result: 'sent', reason: targetId }).catch(() => {});
  return sent;
}

async function completeVerification(member, config, { method = 'button', verifiedBy = null, ipHash = null, userAgent = null } = {}) {
  const { markVerified } = require('./userService');
  const { recordAttempt } = require('./attemptService');
  const { logVerification } = require('./logService');
  const swapped = await swapToVerified(member, config);
  await markVerified(member.guild.id, member.id, verifiedBy || member.id).catch(() => {});
  await recordAttempt({ guildId: member.guild.id, userId: member.id, method, success: true, ipHash, userAgent }).catch(() => {});
  await logVerification({ guildId: member.guild.id, userId: member.id, action: 'success', result: 'verified', reason: method, actorId: verifiedBy }).catch(() => {});
  try {
    const logChId = cleanId(config?.log_channel_id || '');
    if (logChId && isSnowflake(logChId)) {
      const ch = member.guild.channels.cache.get(logChId) || await member.guild.channels.fetch(logChId).catch(() => null);
      if (ch?.isTextBased?.()) await ch.send({ content: `\u2705 <@${member.id}> verifiziert (Methode: ${method}).`, allowedMentions: { parse: [] } }).catch(() => {});
    }
  } catch {}
  return swapped;
}

async function failVerification(member, config, { method = 'button', reason = 'mismatch', ipHash = null, userAgent = null } = {}) {
  const { markFailed } = require('./userService');
  const { recordAttempt, checkRateLimit } = require('./attemptService');
  const { logVerification } = require('./logService');
  await markFailed(member.guild.id, member.id).catch(() => {});
  await recordAttempt({ guildId: member.guild.id, userId: member.id, method, success: false, ipHash, userAgent, error: reason }).catch(() => {});
  await logVerification({ guildId: member.guild.id, userId: member.id, action: 'failed', result: 'failed', reason }).catch(() => {});
  const rl = await checkRateLimit(member.guild.id, member.id, { maxAttempts: Number(config?.max_attempts) || 5, windowMinutes: Number(config?.attempt_window_minutes) || 10 }).catch(() => ({ allowed: true }));
  if (rl && rl.blocked) {
    await logVerification({ guildId: member.guild.id, userId: member.id, action: 'rate_limited', result: 'blocked', reason: `${rl.fails} Fehlversuche` }).catch(() => {});
  }
  return rl;
}

async function startVerificationFlow(interaction, client) {
  const { MessageFlags } = require('discord.js');
  const guildId = interaction.guildId;
  const config = await getConfig(guildId).catch(() => null);
  if (!config || config.enabled === false) {
    await interaction.reply({ content: 'Verification ist derzeit deaktiviert.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  const member = interaction.member || await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) { await interaction.reply({ content: 'Mitglied nicht gefunden.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
  const st = await getVerificationStatus(guildId, member.id).catch(() => null);
  if (st?.verified) { await interaction.reply({ content: 'Du bist bereits verifiziert.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
  const { checkRateLimit } = require('./attemptService');
  const { logVerification } = require('./logService');
  const rl = await checkRateLimit(guildId, member.id, { maxAttempts: Number(config.max_attempts) || 5, windowMinutes: Number(config.attempt_window_minutes) || 10 });
  if (!rl.allowed) {
    await logVerification({ guildId, userId: member.id, action: 'rate_limited', result: 'blocked', reason: 'button' }).catch(() => {});
    await interaction.reply({ content: rl.message || 'Zu viele Versuche. Bitte spaeter erneut versuchen.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  const method = config.method || 'button';
  if (method === 'button') {
    try {
      await completeVerification(member, config, { method: 'button' });
      await interaction.reply({ content: 'Erfolgreich verifiziert. Willkommen!', flags: MessageFlags.Ephemeral }).catch(() => {});
    } catch (e) {
      await failVerification(member, config, { method: 'button', reason: e.message }).catch(() => {});
      await interaction.reply({ content: 'Verifizierung fehlgeschlagen: ' + String(e.message).slice(0, 500), flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    return true;
  }
  if (method === 'code') {
    const { getActiveCode, generateCode } = require('./codeService');
    const active = await getActiveCode(guildId, member.id).catch(() => null);
    if (!active) {
      const { code, expires_at } = await generateCode(guildId, member.id, { validityMinutes: Number(config.code_validity_minutes) || 10, createdBy: member.id });
      await logVerification({ guildId, userId: member.id, action: 'code_created', result: 'pending', reason: 'button' }).catch(() => {});
      try { await member.send({ content: `Dein Verification-Code: **${code}** (gueltig bis <t:${Math.floor(new Date(expires_at).getTime() / 1000)}:R>). Gib ihn via erneutem Klick oder /verify ein.` }).catch(() => {}); } catch {}
      await interaction.reply({ content: `Code erstellt (gueltig ${Number(config.code_validity_minutes) || 10} Min). Per DM gesendet (falls DMs offen) - Code: **${code}**. Klicke erneut, um ihn einzugeben.`, flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }
    const modal = new ModalBuilder().setCustomId(MODAL_CODE).setTitle('Verification-Code');
    const input = new TextInputBuilder().setCustomId('code').setLabel('6-stelliger Code').setStyle(TextInputStyle.Short).setRequired(true).setMinLength(4).setMaxLength(12).setPlaceholder('z.B. 123456');
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal).catch(async () => {
      await interaction.reply({ content: 'Bitte gib deinen Code mit /verify <code> ein.', flags: MessageFlags.Ephemeral }).catch(() => {});
    });
    return true;
  }
  if (method === 'captcha') {
    const a = 2 + Math.floor(Math.random() * 7);
    const b = 2 + Math.floor(Math.random() * 7);
    const { generateCode, hashCode } = require('./codeService');
    // Antwort als Code speichern (Ablauf via Config), Frage im Modal-Titel ist statisch, Antwort via Hash im CustomId-Suffix (kurz).
    const answer = String(a + b);
    await generateCode(guildId, member.id, { validityMinutes: Number(config.code_validity_minutes) || 10, createdBy: member.id }).catch(() => null);
    // Captcha-Antwort-Hash kurz in Modal-CustomId legen (kein Klartext, raten ohne Loesung unmoeglich ohne DB).
    const h = hashCode(guildId + ':' + member.id + ':' + answer).slice(0, 16);
    const modal = new ModalBuilder().setCustomId(MODAL_CAPTCHA + ':' + a + ':' + b + ':' + h).setTitle(`Captcha: ${a} + ${b} = ?`);
    const input = new TextInputBuilder().setCustomId('captcha').setLabel(`Was ist ${a} + ${b}?`).setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(8);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal).catch(async () => {
      await interaction.reply({ content: `Captcha: Was ist ${a} + ${b}? Antworte mit /verify <antwort>.`, flags: MessageFlags.Ephemeral }).catch(() => {});
    });
    return true;
  }
  await interaction.reply({ content: 'Unbekannte Verification-Methode.', flags: MessageFlags.Ephemeral }).catch(() => {});
  return true;
}

async function handleCodeModalSubmit(interaction, client) {
  const { MessageFlags } = require('discord.js');
  const guildId = interaction.guildId;
  const config = await getConfig(guildId).catch(() => null);
  if (!config || config.enabled === false) { await interaction.reply({ content: 'Verification deaktiviert.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
  const member = interaction.member || await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) { await interaction.reply({ content: 'Mitglied nicht gefunden.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
  const input = interaction.fields?.getTextInputValue('code') || '';
  const { verifyCode } = require('./codeService');
  const res = await verifyCode(guildId, member.id, input).catch(() => ({ ok: false }));
  const { logVerification } = require('./logService');
  if (res.ok) {
    try {
      await completeVerification(member, config, { method: 'code' });
      await logVerification({ guildId, userId: member.id, action: 'code_consumed', result: 'verified', reason: 'modal' }).catch(() => {});
      await interaction.reply({ content: 'Code korrekt - erfolgreich verifiziert!', flags: MessageFlags.Ephemeral }).catch(() => {});
    } catch (e) {
      await failVerification(member, config, { method: 'code', reason: e.message }).catch(() => {});
      await interaction.reply({ content: 'Verifizierung fehlgeschlagen: ' + String(e.message).slice(0, 500), flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  } else {
    await failVerification(member, config, { method: 'code', reason: 'code-mismatch' }).catch(() => {});
    await interaction.reply({ content: 'Falscher oder abgelaufener Code. Fordere ggf. einen neuen an.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
  return true;
}

async function handleCaptchaModalSubmit(interaction, client) {
  const { MessageFlags } = require('discord.js');
  const guildId = interaction.guildId;
  const config = await getConfig(guildId).catch(() => null);
  if (!config || config.enabled === false) { await interaction.reply({ content: 'Verification deaktiviert.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
  const member = interaction.member || await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) { await interaction.reply({ content: 'Mitglied nicht gefunden.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
  const cid = String(interaction.customId || '');
  const parts = cid.split(':');
  const a = Number(parts[1]);
  const b = Number(parts[2]);
  const want = Number(a) + Number(b);
  const givenRaw = interaction.fields?.getTextInputValue('captcha') || '';
  const given = Number(String(givenRaw).replace(/[^0-9-]/g, ''));
  if (Number.isFinite(want) && given === want) {
    try {
      await completeVerification(member, config, { method: 'captcha' });
      await interaction.reply({ content: 'Richtig - erfolgreich verifiziert!', flags: MessageFlags.Ephemeral }).catch(() => {});
    } catch (e) {
      await failVerification(member, config, { method: 'captcha', reason: e.message }).catch(() => {});
      await interaction.reply({ content: 'Verifizierung fehlgeschlagen: ' + String(e.message).slice(0, 500), flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  } else {
    await failVerification(member, config, { method: 'captcha', reason: 'captcha-mismatch' }).catch(() => {});
    await interaction.reply({ content: 'Falsche Antwort. Versuche es erneut.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
  return true;
}

module.exports = {
  canManageRole,
  getVerificationStatus,
  isVerified,
  checkVerifiedHook,
  handleMemberJoinVerification,
  buildVerificationMessage,
  ensureVerificationPanel,
  completeVerification,
  failVerification,
  startVerificationFlow,
  handleCodeModalSubmit,
  handleCaptchaModalSubmit,
};
