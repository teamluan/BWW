// BWW Phase 8 - events/guildMemberAdd.js (Ziel-Struktur).
// Reihenfolge: 1) Verification (Unverified-Rolle falls aktiv) -> 2) Welcome-Flow wie bisher.
// Kein Doppel-Handling (Legacy welcome.js bleibt deaktiviert), nie werfend, Bots ignoriert.

async function execute(member) {
  try {
    if (!member?.guild) return;
    if (member.user?.bot) return;
    try {
      const { handleMemberJoinVerification } = require('../modules/verification/flowService');
      await handleMemberJoinVerification(member);
    } catch (err) {
      console.error('Verification-Join Fehler:', err?.message || err);
    }
    const { handleMemberJoin } = require('../modules/welcome/welcomeFlow');
    await handleMemberJoin(member);
  } catch (err) {
    console.error('Welcome Fehler:', err?.message || err);
  }
}

module.exports = execute;
module.exports.execute = execute;
