# BWW – Phase 11 Permissions-Matrix (feingranulares Rechtesystem)

Quelle: `11_PERMISSIONS.md` (Rechte + Pruefmodell), `01_ARCHITECTURE.md` (permissions-Service),
`09_COMMANDS.md` (Command-Grundprinzip), `10_DASHBOARD.md` (Permission Check nach Guild-Auswahl).
Stand: Phase 1–10 auf `main`. Phase 11 aendert KEINE Modul-Business-Logik – nur Permissions + Wiring + Doku.

## 1. Vorher-Stand (was uneinheitlich war)

- `src/services/permissions.js`: nur `hasCommandPermission` (Legacy-Mapping
  `settings.permissions.<command> = [roleIds]`, Owner/Admin-Bypass, leer = jeder).
  Keine Rollen, keine Matrix, keine `can()/requirePermission()`-Helper.
- `src/commands/index.js` (`isAllowed`, Legacy-Monolith): nur Administrator-Bypass +
  Rollenliste – anderes Verhalten als `hasCommandPermission` (bleibt als Legacy erhalten).
- Pro Command eigene Sonder-Checks: `/honeypot` + `/welcome` = harter Administrator-Check
  (Manager/Moderator mit Mapping kamen nie durch), `/embed` = `isEmbedManager`
  (nur Owner/Admin + Legacy `embed-create`/`embed-send`), `/verification` = Admin +
  `hasCommandPermission('verification')`, `/ticket` = nur `setup`/`panel` geprueft
  (Rest an `actionsService.isStaff` delegiert), `/giveaway` = Admin/`ManageGuild`-Bypass
  (ohne Guild-Check!), `/setup`/`/config`/`/settings` = Admin-/ManageGuild-Bypass.
- `src/modules/ticket/actionsService.js` (`isStaff`): Typ-/Panel-Staff-Rolle, Admin,
  Legacy-Ticket-Rolle, `hasCommandPermission('ticket')` – ohne Matrix.
- `src/modules/ticket/interactionHandler.js` (Buttons): KEIN eigener Check
  (nur Service-Layer). Ebenso Embed/Giveaway/Verification-Handler.
- `website/lib/permissions.js`: nur `canUseCommand` (isAdmin/isOwner-Bypass + Rollenliste).
- Dashboard-APIs (`website/app/api/dashboard/*`): NUR Session-Check (401), KEIN
  Permission-Check (403-Luecke) – jede gueltige Session durfte alles (inkl. Phase-10-Neue:
  server, logs, system, search, notifications). Zusaetzlich Importpfad-Bug in
  server/logs/system/search/notifications/guilds/home (`../../../../../` statt `../../../../`).
- `bww_guild_roles.role_type`: nur Legacy-Werte
  (`admin/mod/member/bot/custom/verification/ticket/giveaway/honeypot`) – keine
  Phase-11-Rollen, Tabelle praktisch ungenutzt (Rollen-Seite zeigte nur Settings-Stub).
- `docs/COMMANDS.md` + `website/app/commands/`: keine Permissions-Spalte.

## 2. Rollen (8, BWW-Rollen)

| BWW-Rolle | Label | Vergabe |
|---|---|---|
| `owner` | Owner | Guild-Owner (Discord `ownerId`) |
| `administrator` | Administrator | Discord `Administrator` oder Mapping |
| `manager` | Manager | Mapping oder Discord `ManageGuild` |
| `moderator` | Moderator | Mapping oder `ModerateMembers`/`ManageMessages` |
| `support` | Support | Mapping oder Discord `ManageRoles` |
| `giveaway_manager` | Giveaway Manager | NUR via Mapping (kein Discord-Aequivalent) |
| `verification_staff` | Verification Staff | NUR via Mapping (kein Discord-Aequivalent) |
| `viewer` | Viewer | Baseline: jedes Guild-Mitglied ohne weitere Rolle |

Mapping-Quelle: `bww_guild_roles` (`role_id` = Discord-Rollen-ID, `role_type` = BWW-Rolle).
Legacy-`role_type`-Werte werden normalisiert (`admin`→`administrator`, `mod`/`honeypot`→`moderator`,
`member`→`viewer`, `ticket`→`support`, `giveaway`→`giveaway_manager`, `verification`→`verification_staff`).

## 3. Rechte (36, exakt nach Plan)

Tickets (9): `ticket.create/manage/claim/close/reopen/delete/transcript/members/settings` ·
Honeypot (4): `honeypot.view/manage/logs/exemptions` ·
Embed V2 (6): `embed.view/create/edit/delete/send/templates` ·
Welcome (3): `welcome.view/manage/test` ·
Giveaway (5): `giveaway.view/create/manage/end/reroll` ·
Verification (4): `verification.view/manage/reset/logs` ·
System (5): `settings.view/manage`, `logs.view`, `audit.view`, `system.manage`.

Als Konstanten: `PERMISSIONS.*` in `src/services/permissions.js` (Bot) +
`website/lib/permissions.js` (Dashboard-Mirror). Helper: `can(permission)` /
`requirePermission()` (Bot, wirft bei Deny), `requireView/requireManage/requireAny`
(Dashboard-API, `website/lib/guards.js` → 401/403).

## 4. Matrix (Rolle × Recht)

- `owner`/`administrator`: alles (`*`).
- `manager`: alles ausser `system.manage` (35 Rechte).
- `moderator`: Ticket-Staff (create/manage/claim/close/reopen/transcript/members) +
  `honeypot.view/logs`, `embed.view`, `welcome.view`, `giveaway.view`,
  `verification.view/logs`, `settings.view`, `logs.view`.
- `support`: Ticket-Staff (7) + `honeypot.view`, `embed.view`, `welcome.view`,
  `giveaway.view`, `verification.view`, `settings.view`.
- `giveaway_manager`: `giveaway.*` (5) + `embed.view`, `settings.view`.
- `verification_staff`: `verification.*` (4) + `ticket.create`, `settings.view`.
- `viewer`: NUR LESEN – `honeypot.view`, `embed.view`, `welcome.view`, `giveaway.view`,
  `verification.view`, `settings.view`, `logs.view` (nie manage/delete/system/reset).

Tickets haben bewusst kein `ticket.view` (Privatsphaere): Lesen braucht `ticket.manage`
oder ein `ticket.*`-Aktionsrecht. `logs.view` vs. `audit.view` sind getrennt
(Viewer sieht System-Logs, keine Audit-Logs).

## 5. Pruefmodell (exakt nach Plan)

```text
Discord User
     |
     v
Guild Membership  (Bot: member+guild vorhanden · Dashboard: gueltige Session)
     |
     v
Discord Permission (Fallback: Administrator/ManageGuild/ModerateMembers/ManageMessages/ManageRoles)
     |
     v
BWW Permission (Matrix via bww_guild_roles-Mapping, ersatzweise Legacy-Mapping)
     |
     v
Action
```

Doppelte Pruefung ueberall: Eine Dashboard-/BWW-Rolle allein erlaubt KEINE gefaehrliche
Aktion ohne Guild-Membership + Mapping/Fallback. Viewer (Baseline) darf nur lesen.
Leere Konfiguration (keine Mappings + keine Legacy-Eintraege) = erlauben (Setup-Phase,
wie Phase 1). Sobald der Admin das erste Mapping anlegt, wird die Matrix scharf.

Self-Service-Ausnahmen (kein Gate, Service-Layer entscheidet): Ticket-Erstellen
(Panel-Button/Type-Select, `/ticket create`), Ticket-Schliessen (Button/Modal,
`/ticket close`: Staff ODER Ersteller bei `allowUserClose`), Giveaway-Teilnehmen,
Verifizieren (`/verify`, Verify-Button), eigener Verification-Status, `/help`, `/ping`,
Notification-Gelesen-Markieren.

## 6. Beispiele

```js
// Bot: Slash-Subcommand gaten (09-Grundprinzip Schritte 1-3)
const { requirePermission, loadGuildRoleMappings } = require('../../services/permissions');
const settings = await getGuildSettings(guildId).catch(() => null);
const guildRoles = await loadGuildRoleMappings(guildId).catch(() => []);
await requirePermission(interaction.member, 'honeypot.manage', { guildId, guildRoles, settings });
// → wirft 'Keine Berechtigung (honeypot.manage).' bei Deny

// Bot: Button-Aktion (zentrales Gate in interactionCreate.js + Service als 2. Schicht)
const { permissionForCustomId } = require('../services/permissions');
permissionForCustomId('bww_ticket_claim_abc'); // 'ticket.claim'
permissionForCustomId('bww_panel_open_default'); // null = Self-Service
```

```js
// Dashboard-API-Route (Matrix: view vs. manage, 403 bei Deny)
import { requireView, requireManage, extractMemberContext } from '../../../../lib/guards';
const gate = await requireView(session, 'honeypot.view', extractMemberContext({}, searchParams));
if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status }); // 403
const wgate = await requireManage(session, 'honeypot.manage', extractMemberContext(body));
```

```sql
-- Rollen-Mapping anlegen (Discord-Rolle -> BWW-Rolle), via API /api/dashboard/roles
insert into bww_guild_roles (guild_id, role_id, role_name, role_type)
values ('<guild>', '<discord-rolle>', 'Support', 'support')
on conflict (guild_id, role_id) do update set role_type = excluded.role_type;
```

## 7. Dateien (Phase 11)

Bot: `src/services/permissions.js` (Matrix + Guards), `src/events/interactionCreate.js`
(Component-Gate), `src/commands/{honeypot,welcome,verification,embed,giveaway,ticket}/` +
`src/commands/general/{setup,config,settings}.js` (Matrix je Subcommand),
`src/modules/ticket/actionsService.js` (`isStaff`-Matrix), `src/modules/embed/actionService.js`
(`isEmbedManager`-Matrix). Legacy (`src/commands/index.js` `isAllowed`, alte Alias-Dateien)
erhalten.
Dashboard: `website/lib/permissions.js` (Mirror), `website/lib/guards.js` (API-Gates),
`website/lib/server.js` (Rollen inkl. `bww_guild_roles`), alle
`website/app/api/dashboard/*`-Routen (view vs. manage, 403), `/api/dashboard/roles`
(CRUD neu), `website/app/server/roles/page.js` (CRUD-UI + 403), `website/components/forbidden.js`,
`website/app/commands/page.js` (Permissions-Spalte).
DB: `supabase/migrations/20261003200000_bww_phase11_permissions.sql`
(`role_type`-Werte + Legacy-Normalisierung, RLS beibehalten).
Doku: diese Datei + `docs/COMMANDS.md` §8.

Bekannte Grenze: Dashboard-Sessions sind guild-scoped (Login-Code-Modell, kein
User-OAuth) – feine User-Aufloesung via `memberRoleIds`-Hints; volles User-Binding
ist Nr. 12 (`12_API.md`). `login`/`logout` bleiben reine Auth-Endpunkte (kein Matrix-Gate).

## 8. Naechstes (Nr. 12 = 12_API.md)

API-Konsolidierung: Discord-Rollen-Sync an das Dashboard (Member-Rollen fuer Gates),
User-scoped Sessions (OAuth), Ratenlimits/Audit fuer Permission-Denies.
