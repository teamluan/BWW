// BWW Phase 11 – Permissions-Matrix (11_PERMISSIONS.md + 01_ARCHITECTURE Kap. 4 + 09_COMMANDS Grundprinzip).
// Zentrale Single Source of Truth fuer Bot-Checks (Discord) – Dashboard-Gegenstueck: website/lib/permissions.js.
//
// Rollen (BWW-Rollen, vergeben via bww_guild_roles.role_type, Fallback via Discord-Perms):
//   owner, administrator, manager, moderator, support, giveaway_manager, verification_staff, viewer
// Rechte (36, als Konstanten in PERMISSIONS): ticket.* (9), honeypot.* (4), embed.* (6),
//   welcome.* (3), giveaway.* (5), verification.* (4), system (5).
// Pruefungsmodell: Guild Membership -> Discord Permission -> BWW Permission -> Action.
// Eine BWW-/Dashboard-Rolle allein erlaubt KEINE gefaehrliche Aktion ohne Guild-Membership
// + BWW-Mapping (doppelte Pruefung: member muss auf dem Server sein UND Matrix-Recht haben).
// Viewer (Baseline fuer jedes Mitglied) darf nur lesen (view/logs) – nie manage/delete/system.
//
// Self-Service-Ausnahmen (kein Gate, Service-Layer entscheidet):
// - Ticket-Erstellen (Panel-Button/Type-Select, /ticket create) darf jedes Mitglied.
// - Ticket-Schliessen (Button/Modal, /ticket close) entscheidet der Service
//   (Staff ODER Ersteller bei allowUserClose, siehe actionsService.closeTicket).
//
// Legacy: settings.permissions.<commandName> = [roleId...] (Phase 1) + isAllowed (Legacy-Monolith)
// bleiben erhalten und werden als Fallback geprueft (Setup-Phase: leeres Mapping = jeder darf).
// Neue Checks: hasPermission/can/requirePermission + COMMAND_PERMISSION_MAP pro Subcommand.

const { PermissionsBitField } = require('discord.js');

// ---------------------------------------------------------------------------
// 1. Rollen + Labels (BWW-Rollen, Deutsch laut 11_PERMISSIONS.md Beispielrollen)
// ---------------------------------------------------------------------------
const BWW_ROLES = Object.freeze([
  'owner',
  'administrator',
  'manager',
  'moderator',
  'support',
  'giveaway_manager',
  'verification_staff',
  'viewer',
]);

const BWW_ROLE_LABELS = Object.freeze({
  owner: 'Owner',
  administrator: 'Administrator',
  manager: 'Manager',
  moderator: 'Moderator',
  support: 'Support',
  giveaway_manager: 'Giveaway Manager',
  verification_staff: 'Verification Staff',
  viewer: 'Viewer',
});

// ---------------------------------------------------------------------------
// 2. Rechte – exakt nach 11_PERMISSIONS.md (36)
// ---------------------------------------------------------------------------
const PERMISSIONS = Object.freeze({
  // Tickets (9)
  TICKET_CREATE: 'ticket.create',
  TICKET_MANAGE: 'ticket.manage',
  TICKET_CLAIM: 'ticket.claim',
  TICKET_CLOSE: 'ticket.close',
  TICKET_REOPEN: 'ticket.reopen',
  TICKET_DELETE: 'ticket.delete',
  TICKET_TRANSCRIPT: 'ticket.transcript',
  TICKET_MEMBERS: 'ticket.members',
  TICKET_SETTINGS: 'ticket.settings',
  // Honeypot (4)
  HONEYPOT_VIEW: 'honeypot.view',
  HONEYPOT_MANAGE: 'honeypot.manage',
  HONEYPOT_LOGS: 'honeypot.logs',
  HONEYPOT_EXEMPTIONS: 'honeypot.exemptions',
  // Embed V2 (6)
  EMBED_VIEW: 'embed.view',
  EMBED_CREATE: 'embed.create',
  EMBED_EDIT: 'embed.edit',
  EMBED_DELETE: 'embed.delete',
  EMBED_SEND: 'embed.send',
  EMBED_TEMPLATES: 'embed.templates',
  // Welcome (3)
  WELCOME_VIEW: 'welcome.view',
  WELCOME_MANAGE: 'welcome.manage',
  WELCOME_TEST: 'welcome.test',
  // Giveaway (5)
  GIVEAWAY_VIEW: 'giveaway.view',
  GIVEAWAY_CREATE: 'giveaway.create',
  GIVEAWAY_MANAGE: 'giveaway.manage',
  GIVEAWAY_END: 'giveaway.end',
  GIVEAWAY_REROLL: 'giveaway.reroll',
  // Verification (4)
  VERIFICATION_VIEW: 'verification.view',
  VERIFICATION_MANAGE: 'verification.manage',
  VERIFICATION_RESET: 'verification.reset',
  VERIFICATION_LOGS: 'verification.logs',
  // System (5)
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
  LOGS_VIEW: 'logs.view',
  AUDIT_VIEW: 'audit.view',
  SYSTEM_MANAGE: 'system.manage',
});

const PERMISSION_LIST = Object.freeze(Object.values(PERMISSIONS));

function isValidPermission(value) {
  return PERMISSION_LIST.includes(String(value));
}

// ---------------------------------------------------------------------------
// 3. Rollen-Matrix: welche BWW-Rolle hat welche Rechte
// Viewer nur lesen (view + logs.view + settings.view) – nie manage/delete/system.
// Tickets haben bewusst kein ticket.view (Privatsphaere): Lesen braucht ticket.manage
// (oder eine ticket.*-Aktionsberechtigung, z. B. claim/close – siehe hasAnyPermission).
// ---------------------------------------------------------------------------
const TICKET_ALL = [
  PERMISSIONS.TICKET_CREATE, PERMISSIONS.TICKET_MANAGE, PERMISSIONS.TICKET_CLAIM,
  PERMISSIONS.TICKET_CLOSE, PERMISSIONS.TICKET_REOPEN, PERMISSIONS.TICKET_DELETE,
  PERMISSIONS.TICKET_TRANSCRIPT, PERMISSIONS.TICKET_MEMBERS, PERMISSIONS.TICKET_SETTINGS,
];
const HONEYPOT_ALL = [PERMISSIONS.HONEYPOT_VIEW, PERMISSIONS.HONEYPOT_MANAGE, PERMISSIONS.HONEYPOT_LOGS, PERMISSIONS.HONEYPOT_EXEMPTIONS];
const EMBED_ALL = [PERMISSIONS.EMBED_VIEW, PERMISSIONS.EMBED_CREATE, PERMISSIONS.EMBED_EDIT, PERMISSIONS.EMBED_DELETE, PERMISSIONS.EMBED_SEND, PERMISSIONS.EMBED_TEMPLATES];
const WELCOME_ALL = [PERMISSIONS.WELCOME_VIEW, PERMISSIONS.WELCOME_MANAGE, PERMISSIONS.WELCOME_TEST];
const GIVEAWAY_ALL = [PERMISSIONS.GIVEAWAY_VIEW, PERMISSIONS.GIVEAWAY_CREATE, PERMISSIONS.GIVEAWAY_MANAGE, PERMISSIONS.GIVEAWAY_END, PERMISSIONS.GIVEAWAY_REROLL];
const VERIFICATION_ALL = [PERMISSIONS.VERIFICATION_VIEW, PERMISSIONS.VERIFICATION_MANAGE, PERMISSIONS.VERIFICATION_RESET, PERMISSIONS.VERIFICATION_LOGS];

const ROLE_PERMISSIONS = Object.freeze({
  owner: Object.freeze(['*']),
  administrator: Object.freeze(['*']),
  manager: Object.freeze([
    ...TICKET_ALL, ...HONEYPOT_ALL, ...EMBED_ALL, ...WELCOME_ALL, ...GIVEAWAY_ALL, ...VERIFICATION_ALL,
    PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.LOGS_VIEW, PERMISSIONS.AUDIT_VIEW,
  ]),
  moderator: Object.freeze([
    PERMISSIONS.TICKET_CREATE, PERMISSIONS.TICKET_MANAGE, PERMISSIONS.TICKET_CLAIM,
    PERMISSIONS.TICKET_CLOSE, PERMISSIONS.TICKET_REOPEN, PERMISSIONS.TICKET_TRANSCRIPT, PERMISSIONS.TICKET_MEMBERS,
    PERMISSIONS.HONEYPOT_VIEW, PERMISSIONS.HONEYPOT_LOGS,
    PERMISSIONS.EMBED_VIEW, PERMISSIONS.WELCOME_VIEW, PERMISSIONS.GIVEAWAY_VIEW,
    PERMISSIONS.VERIFICATION_VIEW, PERMISSIONS.VERIFICATION_LOGS,
    PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.LOGS_VIEW,
  ]),
  support: Object.freeze([
    PERMISSIONS.TICKET_CREATE, PERMISSIONS.TICKET_MANAGE, PERMISSIONS.TICKET_CLAIM,
    PERMISSIONS.TICKET_CLOSE, PERMISSIONS.TICKET_REOPEN, PERMISSIONS.TICKET_TRANSCRIPT, PERMISSIONS.TICKET_MEMBERS,
    PERMISSIONS.HONEYPOT_VIEW, PERMISSIONS.EMBED_VIEW, PERMISSIONS.WELCOME_VIEW,
    PERMISSIONS.GIVEAWAY_VIEW, PERMISSIONS.VERIFICATION_VIEW, PERMISSIONS.SETTINGS_VIEW,
  ]),
  giveaway_manager: Object.freeze([
    PERMISSIONS.GIVEAWAY_VIEW, PERMISSIONS.GIVEAWAY_CREATE, PERMISSIONS.GIVEAWAY_MANAGE,
    PERMISSIONS.GIVEAWAY_END, PERMISSIONS.GIVEAWAY_REROLL,
    PERMISSIONS.EMBED_VIEW, PERMISSIONS.SETTINGS_VIEW,
  ]),
  verification_staff: Object.freeze([
    PERMISSIONS.VERIFICATION_VIEW, PERMISSIONS.VERIFICATION_MANAGE,
    PERMISSIONS.VERIFICATION_RESET, PERMISSIONS.VERIFICATION_LOGS,
    PERMISSIONS.TICKET_CREATE, PERMISSIONS.SETTINGS_VIEW,
  ]),
  viewer: Object.freeze([
    PERMISSIONS.HONEYPOT_VIEW, PERMISSIONS.EMBED_VIEW, PERMISSIONS.WELCOME_VIEW,
    PERMISSIONS.GIVEAWAY_VIEW, PERMISSIONS.VERIFICATION_VIEW,
    PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.LOGS_VIEW,
  ]),
});

function roleHasPermission(bwwRole, permission) {
  const perms = ROLE_PERMISSIONS[String(bwwRole)];
  if (!perms) return false;
  if (perms.includes('*')) return true;
  return perms.includes(String(permission));
}

function rolesHavePermission(bwwRoles, permission) {
  const list = Array.isArray(bwwRoles) ? bwwRoles : [bwwRoles];
  return list.some((r) => roleHasPermission(r, permission));
}

function hasAnyPermission(bwwRoles, permissions) {
  const list = Array.isArray(permissions) ? permissions : [permissions];
  return list.some((p) => rolesHavePermission(bwwRoles, p));
}

// ---------------------------------------------------------------------------
// 4. Mapping: Discord-Rolle (bww_guild_roles.role_type) -> BWW-Rolle
// Phase-11-Werte + Legacy-Werte (02_DATABASE/Phase 2) werden normalisiert.
// ---------------------------------------------------------------------------
const LEGACY_ROLE_MAP = Object.freeze({
  owner: 'owner',
  admin: 'administrator',
  administrator: 'administrator',
  manager: 'manager',
  mod: 'moderator',
  moderator: 'moderator',
  member: 'viewer',
  support: 'support',
  ticket: 'support',
  giveaway: 'giveaway_manager',
  giveaway_manager: 'giveaway_manager',
  verification: 'verification_staff',
  verification_staff: 'verification_staff',
  honeypot: 'moderator',
  viewer: 'viewer',
  custom: null,
  bot: null,
});

function normalizeBwwRole(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!key || !(key in LEGACY_ROLE_MAP)) return null;
  return LEGACY_ROLE_MAP[key];
}

// Fallback Discord-Perms -> BWW-Rolle (wenn kein bww_guild_roles-Mapping greift).
// Giveaway Manager + Verification Staff haben kein natives Discord-Aequivalent
// und kommen NUR ueber explizites bww_guild_roles-Mapping.
function fallbackBwwRoleFromDiscordPerms(member) {
  try {
    if (!member) return null;
    if (member.id && member.guild?.ownerId && member.id === member.guild.ownerId) return 'owner';
    const has = (flag) => { try { return member.permissions?.has?.(flag) === true; } catch { return false; } };
    if (has(PermissionsBitField.Flags.Administrator)) return 'administrator';
    if (has(PermissionsBitField.Flags.ManageGuild)) return 'manager';
    if (has(PermissionsBitField.Flags.ModerateMembers)) return 'moderator';
    if (has(PermissionsBitField.Flags.ManageMessages)) return 'moderator';
    if (has(PermissionsBitField.Flags.ManageRoles)) return 'support';
  } catch { return null; }
  return null;
}

// BWW-Rollen eines Members aufloesen:
// 1) explizite Mappings (bww_guild_roles-Zeilen: { role_id, role_type }),
// 2) Fallback ueber Discord-Perms, 3) sonst viewer-Baseline (gilt nur fuer Member).
// guildRoles: Array aus loadGuildRoleMappings(guildId) oder [] (reiner Fallback-Modus).
function resolveBwwRoles(member, guildRoles = []) {
  if (!member) return [];
  const out = new Set();
  try {
    if (member.id && member.guild?.ownerId && member.id === member.guild.ownerId) return ['owner'];
  } catch { /* weiter */ }
  try {
    const owned = new Set();
    try {
      const keys = member.roles?.cache?.keys?.() ? [...member.roles.cache.keys()] : [];
      for (const id of keys) owned.add(String(id));
    } catch { /* keine Rollen lesbar */ }
    for (const row of Array.isArray(guildRoles) ? guildRoles : []) {
      const rid = String(row?.role_id || row?.roleId || '').replace(/\D/g, '');
      if (!rid || !owned.has(rid)) continue;
      const mapped = normalizeBwwRole(row?.role_type || row?.roleType);
      if (mapped) out.add(mapped);
    }
  } catch { /* weiter */ }
  const fallback = fallbackBwwRoleFromDiscordPerms(member);
  if (fallback) out.add(fallback);
  if (out.size === 0) out.add('viewer');
  return [...out];
}

// bww_guild_roles-Mappings einer Guild laden (enabled only). Nie werfend (=> []).
async function loadGuildRoleMappings(guildId) {
  try {
    const { supabaseRequest, isConfigured } = require('./supabase');
    if (!isConfigured()) return [];
    const res = await supabaseRequest(
      `bww_guild_roles?select=role_id,role_type,role_name,enabled&guild_id=eq.${encodeURIComponent(String(guildId))}&enabled=eq.true&limit=200`,
      { headers: { Prefer: 'return=representation' } }
    );
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// 5. Legacy (Phase 1) – erhalten als Fallback (Setup-Phase + alte Mappings)
// ---------------------------------------------------------------------------
function normalizeRoles(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => String(id).replace(/\D/g, '')).filter(Boolean))].slice(0, 25);
}

function getRequiredRoles(settings, commandName) {
  const perms = settings?.permissions && typeof settings.permissions === 'object' ? settings.permissions : {};
  return normalizeRoles(perms[commandName]);
}

function isPrivileged(member) {
  if (!member) return false;
  try {
    if (member.id && member.guild?.ownerId && member.id === member.guild.ownerId) return true;
    if (member.permissions?.has?.(PermissionsBitField.Flags.Administrator)) return true;
  } catch {
    return false;
  }
  return false;
}

// Legacy-Check (Phase 1): Administrator/Owner immer; leeres Mapping = jeder (Setup).
function hasCommandPermission(member, commandName, settings) {
  if (isPrivileged(member)) return true;
  const required = getRequiredRoles(settings, commandName);
  if (required.length === 0) return true;
  try {
    const memberRoles = new Set((member.roles?.cache?.keys?.() ? [...member.roles.cache.keys()] : []) || []);
    return required.some((id) => memberRoles.has(id));
  } catch {
    return false;
  }
}

// Legacy-Alias-Tabelle: neue Matrix-Permission -> alte settings.permissions-Keys,
// die ersatzweise geprueft werden (Uebergang, bis Admins auf Rollen-Mapping umstellen).
const LEGACY_COMMAND_KEYS = Object.freeze({
  'ticket.create': ['ticket', 'ticket-list'],
  'ticket.manage': ['ticket'],
  'ticket.claim': ['ticket', 'ticket-claim'],
  'ticket.close': ['ticket', 'ticket-close'],
  'ticket.reopen': ['ticket', 'ticket-reopen'],
  'ticket.delete': ['ticket'],
  'ticket.transcript': ['ticket'],
  'ticket.members': ['ticket', 'ticket-add'],
  'ticket.settings': ['ticket', 'setup-ticket'],
  'honeypot.view': ['honeypot', 'honeypot-list'],
  'honeypot.manage': ['honeypot', 'honeypot-create'],
  'honeypot.logs': ['honeypot'],
  'honeypot.exemptions': ['honeypot'],
  'embed.view': ['embed', 'embed-list'],
  'embed.create': ['embed', 'embed-create'],
  'embed.edit': ['embed'],
  'embed.delete': ['embed'],
  'embed.send': ['embed', 'embed-send'],
  'embed.templates': ['embed'],
  'welcome.view': ['welcome', 'welcome-setup'],
  'welcome.manage': ['welcome', 'welcome-setup'],
  'welcome.test': ['welcome', 'welcome-test'],
  'giveaway.view': ['giveaway', 'giveaway-list'],
  'giveaway.create': ['giveaway'],
  'giveaway.manage': ['giveaway'],
  'giveaway.end': ['giveaway', 'giveaway-end'],
  'giveaway.reroll': ['giveaway', 'giveaway-reroll'],
  'verification.view': ['verify', 'verification', 'verification-status'],
  'verification.manage': ['verification', 'verification-setup'],
  'verification.reset': ['verification', 'verification-reset'],
  'verification.logs': ['verification'],
  'settings.view': ['setup', 'config', 'settings'],
  'settings.manage': ['setup', 'config', 'settings', 'setup-permission'],
  'logs.view': ['setup'],
  'audit.view': ['setup'],
  'system.manage': ['setup', 'restart', 'wartung'],
});

function legacyGrantsPermission(member, permission, settings) {
  if (!settings) return false;
  const keys = LEGACY_COMMAND_KEYS[String(permission)] || [];
  return keys.some((k) => {
    try { return hasCommandPermission(member, k, settings) && getRequiredRoles(settings, k).length > 0; }
    catch { return false; }
  });
}

// ---------------------------------------------------------------------------
// 6. Neue Checks: hasPermission / can / requirePermission (Matrix + Legacy)
// Pruefmodell: 1) Guild-Membership (member+guild vorhanden), 2) Discord-Fallback
// oder Mapping-Rolle, 3) Matrix-Recht, 4) ersatzweise Legacy-Mapping (explicit).
// Leere Konfiguration (keine Mappings + keine Legacy-Eintraege) = erlauben (Setup).
// ---------------------------------------------------------------------------
async function hasPermission(member, permission, { guildId = null, guildRoles = null, settings = null } = {}) {
  if (!isValidPermission(permission)) return false;
  if (!member || !member.guild) return false; // 1) Guild Membership
  if (isPrivileged(member)) return true;
  let mappings = guildRoles;
  if (mappings == null && guildId) mappings = await loadGuildRoleMappings(guildId).catch(() => []);
  if (mappings == null) mappings = [];
  const roles = resolveBwwRoles(member, mappings);
  if (rolesHavePermission(roles, permission)) return true; // 2)+3) Matrix
  if (settings && legacyGrantsPermission(member, permission, settings)) return true; // 4) Legacy
  // Setup-Phase: gar nichts konfiguriert -> erlauben (wie Phase 1: leeres Mapping)
  try {
    const legacyKeys = LEGACY_COMMAND_KEYS[String(permission)] || [];
    const anyLegacy = legacyKeys.some((k) => getRequiredRoles(settings, k).length > 0);
    if ((mappings || []).length === 0 && !anyLegacy) return true;
  } catch { /* deny */ }
  return false;
}

async function can(member, permission, ctx) {
  return hasPermission(member, permission, ctx);
}

async function requirePermission(member, permission, ctx) {
  const ok = await hasPermission(member, permission, ctx);
  if (!ok) throw new Error(`Keine Berechtigung (${permission}).`);
  return true;
}

function hasPermissionSync(member, permission, { guildRoles = [], settings = null } = {}) {
  if (!isValidPermission(permission)) return false;
  if (!member || !member.guild) return false;
  if (isPrivileged(member)) return true;
  const roles = resolveBwwRoles(member, guildRoles);
  if (rolesHavePermission(roles, permission)) return true;
  if (settings && legacyGrantsPermission(member, permission, settings)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// 7. Command-Mapping: Slash-Command (+Subcommand) -> Matrix-Permission
// null = Self-Service (kein Gate-Check, Service-Layer entscheidet):
// /verify, /help, /ping, /ticket create (jedes Mitglied), /ticket close + Close-Button/
// Close-Modal (Staff ODER Ersteller bei allowUserClose, siehe actionsService.closeTicket).
// ---------------------------------------------------------------------------
const COMMAND_PERMISSION_MAP = Object.freeze({
  ticket: Object.freeze({
    setup: PERMISSIONS.TICKET_SETTINGS, panel: PERMISSIONS.TICKET_MANAGE, create: null,
    claim: PERMISSIONS.TICKET_CLAIM, unclaim: PERMISSIONS.TICKET_CLAIM, add: PERMISSIONS.TICKET_MEMBERS,
    remove: PERMISSIONS.TICKET_MEMBERS, rename: PERMISSIONS.TICKET_MANAGE, priority: PERMISSIONS.TICKET_MANAGE,
    close: null, reopen: PERMISSIONS.TICKET_REOPEN, delete: PERMISSIONS.TICKET_DELETE,
    transcript: PERMISSIONS.TICKET_TRANSCRIPT, info: PERMISSIONS.TICKET_MANAGE, template: PERMISSIONS.TICKET_MANAGE,
  }),
  honeypot: Object.freeze({
    create: PERMISSIONS.HONEYPOT_MANAGE, delete: PERMISSIONS.HONEYPOT_MANAGE, list: PERMISSIONS.HONEYPOT_VIEW,
    enable: PERMISSIONS.HONEYPOT_MANAGE, disable: PERMISSIONS.HONEYPOT_MANAGE, logs: PERMISSIONS.HONEYPOT_LOGS,
    whitelist: PERMISSIONS.HONEYPOT_EXEMPTIONS,
  }),
  embed: Object.freeze({
    create: PERMISSIONS.EMBED_CREATE, edit: PERMISSIONS.EMBED_EDIT, delete: PERMISSIONS.EMBED_DELETE,
    list: PERMISSIONS.EMBED_VIEW, send: PERMISSIONS.EMBED_SEND, preview: PERMISSIONS.EMBED_VIEW,
    clone: PERMISSIONS.EMBED_CREATE, template: PERMISSIONS.EMBED_TEMPLATES,
  }),
  welcome: Object.freeze({
    setup: PERMISSIONS.WELCOME_MANAGE, enable: PERMISSIONS.WELCOME_MANAGE, disable: PERMISSIONS.WELCOME_MANAGE,
    preview: PERMISSIONS.WELCOME_VIEW, test: PERMISSIONS.WELCOME_TEST,
  }),
  giveaway: Object.freeze({
    start: PERMISSIONS.GIVEAWAY_CREATE, end: PERMISSIONS.GIVEAWAY_END, cancel: PERMISSIONS.GIVEAWAY_MANAGE,
    reroll: PERMISSIONS.GIVEAWAY_REROLL, edit: PERMISSIONS.GIVEAWAY_MANAGE,
    list: PERMISSIONS.GIVEAWAY_VIEW, info: PERMISSIONS.GIVEAWAY_VIEW,
  }),
  verification: Object.freeze({
    setup: PERMISSIONS.VERIFICATION_MANAGE, enable: PERMISSIONS.VERIFICATION_MANAGE,
    disable: PERMISSIONS.VERIFICATION_MANAGE, user: PERMISSIONS.VERIFICATION_VIEW,
    reset: PERMISSIONS.VERIFICATION_RESET, logs: PERMISSIONS.VERIFICATION_LOGS,
  }),
  verify: null,
  setup: PERMISSIONS.SETTINGS_MANAGE,
  config: Object.freeze({ view: PERMISSIONS.SETTINGS_VIEW, set: PERMISSIONS.SETTINGS_MANAGE }),
  settings: Object.freeze({ view: PERMISSIONS.SETTINGS_VIEW, set: PERMISSIONS.SETTINGS_MANAGE }),
  help: null,
  ping: null,
});

function permissionForCommand(commandName, subcommand = null, subGroup = null) {
  const entry = COMMAND_PERMISSION_MAP[String(commandName)];
  if (entry == null) return null; // unbekannt/self-service -> kein Matrix-Check (Legacy greift)
  if (typeof entry === 'string') return entry;
  if (subGroup && entry[subGroup]) {
    const g = entry[subGroup];
    if (typeof g === 'string') return g;
    if (subcommand && g[subcommand]) return g[subcommand];
    return null;
  }
  if (subcommand && entry[subcommand]) return entry[subcommand];
  // Feed-Default: manage/view je Modul (konservativ: manage)
  return null;
}

// Einheitlicher Slash-Gate (09 Grundprinzip Schritte 1-3): Guild -> BWW-Matrix -> Discord.
// Gibt { ok:true, permission } oder { ok:false, permission, reason } zurueck (nie werfend).
// context: { guildId, guildRoles, settings } – alles optional (Setup-Fallback inklusive).
async function checkCommandPermission(interaction, commandName, subcommand = null, context = {}) {
  try {
    if (!interaction?.guildId || !interaction?.guild) return { ok: false, permission: null, reason: 'Nur auf Servern.' };
    const permission = permissionForCommand(commandName, subcommand, context.subGroup || null);
    if (!permission) return { ok: true, permission: null }; // self-service/unbekannt
    const ok = await hasPermission(interaction.member, permission, {
      guildId: context.guildId || interaction.guildId,
      guildRoles: context.guildRoles ?? null,
      settings: context.settings ?? null,
    });
    return ok ? { ok: true, permission } : { ok: false, permission, reason: `Keine Berechtigung (${permission}).` };
  } catch (e) {
    return { ok: false, permission: null, reason: e?.message || 'Berechtigungspruefung fehlgeschlagen.' };
  }
}

// Button-/Select-/Modal-Aktionen -> Matrix-Permission (Prefix-Tabelle).
// null = Self-Service (kein Gate-Check, Service-Layer entscheidet, z. B. Ersteller-Regeln).
const BUTTON_PERMISSION_PREFIXES = Object.freeze([
  ['bww_ticket_claim_', PERMISSIONS.TICKET_CLAIM],
  ['bww_ticket_close_', null],
  ['bww_ticket_close_modal_', null],
  ['bww_ticket_reopen_', PERMISSIONS.TICKET_REOPEN],
  ['bww_ticket_delete_', PERMISSIONS.TICKET_DELETE],
  ['bww_ticket_transcript_', PERMISSIONS.TICKET_TRANSCRIPT],
  ['bww_ticket_priority_', PERMISSIONS.TICKET_MANAGE],
  ['bww_panel_open_', null],
  ['bww_ticket_type_select', null],
  ['bww_honeypot_', PERMISSIONS.HONEYPOT_MANAGE],
  ['bww_embed_send_', PERMISSIONS.EMBED_SEND],
  ['bww_embed_edit_', PERMISSIONS.EMBED_EDIT],
  ['bww_embed_delete_', PERMISSIONS.EMBED_DELETE],
  ['bww_giveaway_enter_', null],
  ['bww_giveaway_end_', PERMISSIONS.GIVEAWAY_END],
  ['bww_giveaway_reroll_', PERMISSIONS.GIVEAWAY_REROLL],
  ['bww_giveaway_', PERMISSIONS.GIVEAWAY_MANAGE],
  ['bww_verification_verify_', null],
  ['bww_verification_', PERMISSIONS.VERIFICATION_MANAGE],
]);

function permissionForCustomId(customId) {
  const cid = String(customId || '');
  for (const [prefix, perm] of BUTTON_PERMISSION_PREFIXES) {
    if (cid === prefix || cid.startsWith(prefix)) return perm;
  }
  return null;
}

async function checkButtonPermission(interaction, context = {}) {
  try {
    if (!interaction?.guildId || !interaction?.guild) return { ok: false, permission: null, reason: 'Nur auf Servern.' };
    const permission = permissionForCustomId(interaction.customId || '');
    if (!permission) return { ok: true, permission: null }; // self-service/unbekannt
    const ok = await hasPermission(interaction.member, permission, {
      guildId: context.guildId || interaction.guildId,
      guildRoles: context.guildRoles ?? null,
      settings: context.settings ?? null,
    });
    return ok ? { ok: true, permission } : { ok: false, permission, reason: `Keine Berechtigung (${permission}).` };
  } catch (e) {
    return { ok: false, permission: null, reason: e?.message || 'Berechtigungspruefung fehlgeschlagen.' };
  }
}

module.exports = {
  BWW_ROLES,
  BWW_ROLE_LABELS,
  PERMISSIONS,
  PERMISSION_LIST,
  isValidPermission,
  ROLE_PERMISSIONS,
  roleHasPermission,
  rolesHavePermission,
  hasAnyPermission,
  LEGACY_ROLE_MAP,
  normalizeBwwRole,
  fallbackBwwRoleFromDiscordPerms,
  resolveBwwRoles,
  loadGuildRoleMappings,
  // Legacy (Phase 1) – erhalten
  normalizeRoles,
  getRequiredRoles,
  isPrivileged,
  hasCommandPermission,
  LEGACY_COMMAND_KEYS,
  // Neu (Phase 11)
  hasPermission,
  can,
  requirePermission,
  hasPermissionSync,
  COMMAND_PERMISSION_MAP,
  permissionForCommand,
  checkCommandPermission,
  BUTTON_PERMISSION_PREFIXES,
  permissionForCustomId,
  checkButtonPermission,
};
