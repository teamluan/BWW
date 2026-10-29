// BWW Phase 1 – Validation-Service (01_ARCHITECTURE Kap. 4: validation).
// Alle User-/Channel-/Rollen-IDs werden hier normalisiert, bevor sie nach Supabase gehen.
// Verhindert PostgREST-400er durch unsaubere Discord-Mentions wie '<#123>'.

function cleanId(value) {
  return String(value || '').replace(/\D/g, '');
}

function isSnowflake(value) {
  const id = cleanId(value);
  return /^\d{5,25}$/.test(id);
}

function requireGuildId(guildId) {
  const id = cleanId(guildId);
  if (!isSnowflake(id)) throw new Error('Ungueltige Guild-ID.');
  return id;
}

function clampText(value, max = 1000) {
  return String(value ?? '').slice(0, Math.max(1, max));
}

module.exports = { cleanId, isSnowflake, requireGuildId, clampText };
