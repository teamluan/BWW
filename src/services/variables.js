// BWW Phase 1 – Variables-Service (Welcome/Embed/Verification teilen dieselben Platzhalter).
// Unterstützt: {user} {username} {mention} {userid} {server} {membercount} {date}
// Unbekannte Variablen bleiben stehen (kein stilles Löschen).

function applyVariables(text, context = {}) {
  if (text == null) return '';
  let out = String(text);
  const user = context.user || context.member?.user || null;
  const member = context.member || null;
  const guild = context.guild || member?.guild || null;
  const map = {
    '{user}': user ? `<@${user.id}>` : '{user}',
    '{mention}': user ? `<@${user.id}>` : '{mention}',
    '{username}': user?.username || member?.displayName || '{username}',
    '{userid}': user?.id || member?.id || '{userid}',
    '{server}': guild?.name || context.serverName || '{server}',
    '{membercount}': String(guild?.memberCount ?? context.memberCount ?? '{membercount}'),
    '{date}': new Date().toLocaleDateString('de-DE'),
  };
  for (const [key, value] of Object.entries(map)) out = out.split(key).join(String(value));
  return out.slice(0, 4000);
}

module.exports = { applyVariables };
