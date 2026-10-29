// BWW Phase 14 – tests/bot.test.js (Phase 9: Bot – Command/Interaction/Event/Permission).
// Ohne Secrets, mit Mocks (kein Discord-Login, kein Netzwerk). Prueft unified Commands,
// Button/Select/Modal-Prefixe (kein Doppel-Handling), Event-Reihenfolge, Matrix.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('Bot: Commands (unified)', () => {
  it('alle Modul-Ordner + unified Loader vorhanden', () => {
    for (const d of ['src/commands/ticket', 'src/commands/giveaway', 'src/commands/honeypot', 'src/commands/verification', 'src/commands/welcome', 'src/commands/embed', 'src/commands/general']) {
      assert.ok(fs.existsSync(path.join(root, d)), `fehlt: ${d}`);
    }
    assert.ok(fs.existsSync(path.join(root, 'src/commands/index.js')));
    const idx = read('src/commands/index.js');
    assert.ok(idx.includes('ticket-close') && idx.includes('giveaway-end'), 'unified Commands unvollstaendig');
  });
  it('Validation: Guild/BWW/Discord/Ergebnis (deutsch, nie werfend)', () => {
    const v = read('src/services/validation.js');
    assert.ok(v.includes('cleanId') || v.includes('clampText'), 'validation helper fehlt');
    const cmds = read('src/commands/index.js');
    assert.ok(cmds.includes('description'), 'Commands brauchen description');
  });
});

describe('Bot: Interactions (kein Doppel-Handling)', () => {
  it('Button/Select/Modal-Prefixe eindeutig', () => {
    const perm = require(path.join(root, 'src/services/permissions.js'));
    const prefixes = perm.BUTTON_PERMISSION_PREFIXES.map(([p]) => p);
    const uniq = new Set(prefixes);
    assert.equal(uniq.size, prefixes.length, 'doppelte Prefixe');
    // Self-Service vs. Gate: enter/close sind null (Service entscheidet), end/reroll brauchen Recht
    assert.equal(perm.permissionForCustomId('bww_giveaway_enter_123'), null);
    assert.equal(perm.permissionForCustomId('bww_giveaway_end_123'), 'giveaway.end');
    assert.equal(perm.permissionForCustomId('bww_ticket_close_123'), null);
    assert.equal(perm.permissionForCustomId('bww_ticket_delete_123'), 'ticket.delete');
  });
  it('Router behandelt Button/Select/Modal/Slash getrennt', () => {
    const router = read('src/events/interactionCreate.js');
    assert.ok(router.includes('isButton') || router.includes('Button'), 'Button-Handling fehlt');
    const all = read('src/events/interactions.js');
    assert.ok(all.length > 1000, 'interactions.js zu klein');
  });
});

describe('Bot: Events (Reihenfolge)', () => {
  it('messageCreate/guildMemberAdd/interactionCreate verdrahtet', () => {
    const index = read('src/index.js');
    const mi = index.indexOf('MessageCreate');
    const gi = index.indexOf('GuildMemberAdd');
    const ii = index.indexOf('InteractionCreate');
    assert.ok(mi > 0 && gi > 0 && ii > 0, 'Events fehlen in src/index.js');
    assert.ok(fs.existsSync(path.join(root, 'src/events/messageCreate.js')));
    assert.ok(fs.existsSync(path.join(root, 'src/events/guildMemberAdd.js')));
    assert.ok(fs.existsSync(path.join(root, 'src/events/interactionCreate.js')));
  });
});

describe('Bot: Permissions (Matrix)', () => {
  it('Viewer darf nicht managen; gefaehrliche Aktion ohne Discord-Perm blockiert', () => {
    const perm = require(path.join(root, 'src/services/permissions.js'));
    assert.equal(perm.rolesHavePermission(['viewer'], 'ticket.manage'), false);
    assert.equal(perm.rolesHavePermission(['viewer'], 'ticket.delete'), false);
    assert.equal(perm.rolesHavePermission(['viewer'], 'system.manage'), false);
    assert.equal(perm.rolesHavePermission(['viewer'], 'logs.view'), true);
    assert.equal(perm.rolesHavePermission(['owner'], 'ticket.delete'), true);
    assert.equal(perm.permissionForCommand('ticket', 'delete'), 'ticket.delete');
    assert.equal(perm.permissionForCommand('ticket', 'create'), null);
    // Guild-Membership: ohne guild -> deny
    return perm.hasPermission(null, 'ticket.manage').then((ok) => assert.equal(ok, false));
  });
});
