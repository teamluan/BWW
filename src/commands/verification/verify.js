// BWW Phase 8 - /verify (Selbst-Verifizierung, 08_VERIFICATION.md).
// Loader-Format: { data, execute, toJSON, name }. Fuer alle (kein Admin noetig).

const { MessageFlags } = require('discord.js');

const data = {
  name: 'verify',
  description: 'Verifiziere dich (Button/Code/Captcha je nach Server-Config).',
  options: [
    { name: 'code', description: 'Code oder Captcha-Antwort (falls Methode code/captcha)', type: 3, required: false },
  ],
};

async function execute(interaction, client) {
  const mod = require('../../modules/verification');
  const config = await mod.getVerificationConfig(interaction.guildId).catch(() => null);
  if (!config || config.enabled === false) {
    await interaction.reply({ content: 'Verification ist derzeit deaktiviert.', flags: MessageFlags.Ephemeral });
    return;
  }
  const member = interaction.member || await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) { await interaction.reply({ content: 'Mitglied nicht gefunden.', flags: MessageFlags.Ephemeral }); return; }
  const st = await mod.getVerificationStatus(interaction.guildId, member.id).catch(() => null);
  if (st?.verified) { await interaction.reply({ content: 'Du bist bereits verifiziert.', flags: MessageFlags.Ephemeral }); return; }
  const rl = await mod.checkRateLimit(interaction.guildId, member.id, { maxAttempts: Number(config.max_attempts) || 5, windowMinutes: Number(config.attempt_window_minutes) || 10 });
  if (!rl.allowed) { await interaction.reply({ content: rl.message, flags: MessageFlags.Ephemeral }); return; }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const method = config.method || 'button';
  const input = interaction.options.getString('code');
  try {
    if ((method === 'code' || method === 'captcha') && input) {
      if (method === 'code') {
        const res = await mod.verifyCode(interaction.guildId, member.id, input);
        if (!res.ok) {
          await mod.failVerification(member, config, { method: 'code', reason: 'slash-mismatch' });
          await interaction.followUp({ content: 'Falscher oder abgelaufener Code.', flags: MessageFlags.Ephemeral });
          return;
        }
        await mod.completeVerification(member, config, { method: 'code' });
        await interaction.followUp({ content: 'Erfolgreich verifiziert. Willkommen!', flags: MessageFlags.Ephemeral });
        return;
      }
      // captcha via /verify: einfache Addition aus Modal-CustomId nicht verfuegbar -> Code-Tabelle als Fallback pruefen
      const res = await mod.verifyCode(interaction.guildId, member.id, input).catch(() => ({ ok: false }));
      if (!res.ok) {
        await mod.failVerification(member, config, { method: 'captcha', reason: 'slash-mismatch' });
        await interaction.followUp({ content: 'Falsche Antwort. Nutze den Verify-Button fuer ein neues Captcha.', flags: MessageFlags.Ephemeral });
        return;
      }
      await mod.completeVerification(member, config, { method: 'captcha' });
      await interaction.followUp({ content: 'Richtig - erfolgreich verifiziert!', flags: MessageFlags.Ephemeral });
      return;
    }
    if (method === 'button') {
      await mod.completeVerification(member, config, { method: 'button' });
      await interaction.followUp({ content: 'Erfolgreich verifiziert. Willkommen!', flags: MessageFlags.Ephemeral });
      return;
    }
    if (method === 'code' && !input) {
      const { code, expires_at } = await mod.generateCode(interaction.guildId, member.id, { validityMinutes: Number(config.code_validity_minutes) || 10, createdBy: member.id });
      await mod.logVerification({ guildId: interaction.guildId, userId: member.id, action: 'code_created', result: 'pending', reason: 'slash' }).catch(() => {});
      try { await member.send({ content: `Dein Verification-Code: **${code}** (gueltig bis <t:${Math.floor(new Date(expires_at).getTime() / 1000)}:R>).` }).catch(() => {}); } catch {}
      await interaction.followUp({ content: `Code erstellt: **${code}** (gueltig ${Number(config.code_validity_minutes) || 10} Min). Wiederhole /verify mit Code.`, flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.followUp({ content: 'Nutze den [Verifizieren]-Button im Verification-Channel.', flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: 'Verifizierung fehlgeschlagen: ' + String(err.message).slice(0, 500), flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
