# BWW – Security (Phase 13: Haertung, keine Feature-Logik)

Quelle: `13_SECURITY.md` (XXL-Plan). Stand: Phase 1–12 auf `main`. Diese Datei ist die
kanonische Security-Doku (Supabase/Keys/Isolation/Dashboard/Discord/Verification/Logs/Webhooks/Backups/Audit + Checkliste).

## 0. Vorher-Stand (gezielte Pruefung, kein Full-Audit)

| Bereich | Befund (vor Phase 13) | Fix (Phase 13) |
|---|---|---|
| Keys | Basis ok (`NEXT_PUBLIC_*` nur URL + publishable, Secrets ohne Prefix). Luecke: Code erwartete `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `.env.example` lieferte `PUBLISHABLE_KEY` (Realtime verwirrt). | Beide Keys akzeptiert (`realtime*`-Helper pruefen ANON oder PUBLISHABLE), `.env.example` kommentiert, CI/Build-Leak-Hinweis (kein `console.log` von ENV). |
| Guild-Isolation/IDOR | `:guildId`-Routen prueften `GUILD_MISMATCH` (gut), `:id`-Routen filterten `guild_id=eq.sessionGuild` (gut). Luecken: `GET /api/guilds` + `GET /api/dashboard/guilds` + `getOverviewData` listeten **alle** Guilds (Enumeration); Giveaway-Entries/Winners/Requirements/Rerolls + Embed-Components/Buttons/Options/Actions wurden nur per `*_id` geladen (IDOR bei geratener ID). | Guild-Listing auf Session-Guild scoped; neue Scoped-Loader `getGiveawayScoped` / `getFullEmbedV2Scoped` (Ownership zuerst, dann Sub-Ressourcen); End/Reroll pruefen Ownership + 404 statt Leak. |
| RLS | Phase 2: `ENABLE + REVOKE anon/authenticated + GRANT service_role + SELECT-Isolation` (sicher, Default-Deny). Luecken: Phase-1-Policy `"public can read bww guild directory" USING(true)` blieb aktiv (anon konnte Guilds enumerieren); `bww_dashboard_logins` fehlte in RLS-Abdeckung; keine `USING+WITH CHECK`-Guard-Doku fuer kuenftige UPDATE-Policies; keine View-Guard-Doku. | Migration `20261003210000_bww_phase13_security.sql`: public Guild-Policy gedroppt, `bww_dashboard_logins` (+ `dashboard_actions`-Guard) mit RLS, Schreib-`REVOKE` fuer anon/auth auf allen `bww_*`, `USING+WITH CHECK`-Regel dokumentiert, View-Guard (`security_invoker`, kein Grant), Cleanup-Funktion `bww_purge_expired_codes()`. |
| Auth | Matrix (Phase 11) + Guards (Phase 12) server-seitig (gut). Luecke: `memberRoleIds` sind Client-Hints (spoofbar – Angreifer kann fremde Rollen-IDs behaupten). | `guards.js`: Trust-Hinweis + Viewer-Fallback dokumentiert; Owner via `bww_guilds.owner_id` server-seitig; Discord-Rollen-Sync (Bot verifiziert live) als TODO fuer Nr. 14 (User-OAuth). Kein Vertrauen in frei aenderbare Profilmetadaten. |
| Dashboard | Session-Cookie `httpOnly + SameSite=lax + secure(prod)` + Middleware-Guard (gut); `encodeURIComponent` (kein SQLi via Query-Builder); Guild-Switcher blockt Guild-Wechsel (neuer Code noetig, gut); Dashboard-Codes mit `code_hash + used_at + expires_at` (gut). Luecken: kein Rate-Limit; kein Origin-Check (CSRF); kein zentrales Escaping/Validation; `find+consume` als zwei Schritte (Replay-Race dokumentiert, `consume` ist atomic). | Neu: `lib/rate-limit.js` (Presets: login/test-send/verify/codes/end/reroll), `lib/csrf.js` (Origin/Referer-Check fuer POST/PATCH/DELETE), `lib/escape.js` (HTML-Escaping), `lib/validation.js` (Mirror zu `src/services/validation.js`), Middleware-Security-Header, Login + Giveaway-End/Reroll mit Rate-Limit + CSRF + Validation + IDOR + Replay-Guard. |
| Discord-Aktionen | `src/modules/honeypot/actionService.js`: Bot-Recht + `moderatable/kickable/bannable` + Config + Log (gut). Luecke: keine einheitliche Pre-Check-Doku fuer Dashboard-getriggerte Moderation. | Neu: `website/lib/moderation.js` (`validateModerationInput` + `moderationChecklist`: Bot-Recht + Zielrolle + Hierarchie + Config + Log). Bot prueft live Hierarchie; Dashboard validiert vor Queueing (fail-fast). |
| Verification | `ip_hash` statt Klartext-IP (gut, Phase 6/8); `expires_at` vorhanden (gut). Luecken: keine Cleanup-Funktion, keine `isExpired`-Helper in `lib`, keine aktiven-Codes-Liste. | `lib/verification.js`: `isExpired`/`isCodeUsable`/`listActiveCodesV2`/`cleanupExpiredCodes`; `dashboard.js`: `purgeExpiredDashboardCodes`; DB-Funktion `bww_purge_expired_codes()` (Scheduler/Cron ruft sie via service_role). |
| Logs | Keine Sanitizer (Tokens/Keys konnten in Logs/Audit landen). | Neu: `website/lib/sanitize.js` + Sanitizer in `website/lib/audit.js`, `src/services/logger.js`, `src/services/audit.js`, `src/logger.js` (maskiert `sb_secret_*`, JWT, Webhooks, `token/password/secret/*key*`; kuerzt auf 2000 Zeichen). |
| Webhooks | Keine eingehenden externen Webhooks (nur ausgehender `LOG_WEBHOOK_URL` via ENV, server-seitig). | Doku: keine Signatur-Validierung noetig (keine Inbound-Webhooks); `LOG_WEBHOOK_URL` als secret-aehnlich behandeln (nie loggen, nie an Client). Bei kuenftigen Inbound-Webhooks: Secret + Signatur pruefen (HMAC, Timestamp-Toleranz, Replay-Cache). |
| Backups | Keine Doku. | Siehe §9 (Supabase PITR/Backups-Strategie). |
| Audit | `writeAuditLog` (`bww_audit_logs`: Wer/Was/Alt/Neu/Wann) in kanonischen Mutationen (gut, Best-Effort). Luecke: Details unsanitized; Legacy-Routen teils ohne explizites Audit (nur Queue). | Details sanitized; kanonische Mutationen auditieren weiter; Checkliste unten fuer Legacy-Nachruestung (Nr. 14). |

## 1. Supabase (RLS)

- `ENABLE ROW LEVEL SECURITY` auf allen `bww_*`-Tabellen (idempotent, siehe Phase-2-Migration).
- `REVOKE ALL / REVOKE INSERT,UPDATE,DELETE,TRUNCATE` fuer `anon, authenticated` (Default-Deny).
- `GRANT ... TO service_role` (Bot + Dashboard-Server-Layer umgehen RLS via Bypass).
- Authenticated-Reads nur via `bww_can_access_guild(guild_id)` (`SELECT`-Policy, JWT-`app_metadata.guild_id`).
- **UPDATE-Regel**: Falls je eine `UPDATE`-Policy fuer `authenticated` noetig wird, MUSS sie `USING (...)` **und** `WITH CHECK (...)` mit `bww_can_access_guild(guild_id)` enthalten – sonst Guild-Escape (Daten anderer Guild ueberschreibbar). Aktuell existiert keine solche Policy (Default-Deny ist sicherer).
- Views duerfen nicht ungeschuetzt sein: `WITH (security_invoker = true)`, kein Grant an `anon/authenticated`, RLS der Basis-Tabellen erbt.
- Migration: `supabase/migrations/20261003210000_bww_phase13_security.sql` (idempotent, nur Schutz).

## 2. Keys

- Browser (`NEXT_PUBLIC_*`): nur `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (oder `ANON_KEY`-Alias). **Niemals** `service_role`, `SUPABASE_SECRET_KEY`, `BWW_DASHBOARD_SECRET`, `DISCORD_TOKEN`, `private keys` mit `NEXT_PUBLIC_`-Prefix.
- Server-only: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `BWW_DASHBOARD_SECRET`, `DISCORD_TOKEN`, `LOG_WEBHOOK_URL` – nur in `website/lib/*` (via `dbRequest`) und `src/services/*`, nie an Client, nie `console.log`gen.
- `.env.example` (Root + `website/`): kommentiert Platzhalter, kein echtes Secret committen.
- CI/Build-Leak vermeiden: kein ENV-Echo in Logs/Artifacts, Vercel-Env getrennt (Preview vs. Production), Secrets rotieren bei Leak-Verdacht.

## 3. Guild-Isolation (IDOR/BOLA)

- Jede guild-bezogene Operation prueft `session.guildId` (401 ohne Session, 403 bei Mismatch).
- `:guildId`-Param muss matchen, sonst `GUILD_MISMATCH` (403) – siehe `/api/guilds/:guildId/settings`.
- `:id`-Routen filtern immer `guild_id=eq.sessionGuild` (`tickets/:ticketId`, `honeypots/:id`, `embeds/:id`, `giveaways/:id`) – Guild A sieht nur A-Daten.
- Sub-Ressourcen nur nach Ownership-Check: `getGiveawayScoped` / `getFullEmbedV2Scoped` (erst Guild-Treffer, dann Entries/Winners/Components).
- Guild-Listing ist scoped (keine Enumeration): `GET /api/guilds` + `GET /api/dashboard/guilds` + `getOverviewData` liefern nur Session-Guild.
- Guild-Wechsel erfordert neuen Login-Code (`/dashboard-code` in Discord) – Session ist pro Guild gueltig.

## 4. Auth (kein Vertrauen in Profilmetadaten)

- Berechtigungen server-seitig: `website/lib/guards.js` (`requireView/requireManage/requireAny`) + Matrix `website/lib/permissions.js` (Phase 11) + Bot `src/services/permissions.js`.
- `memberRoleIds` sind Hints (spoofbar) – ohne Mapping/Owner/Admin gilt Viewer (nur Lesen). Leere Config = Setup-Phase (erlauben, wie Bot).
- Owner-Aufloesung server-seitig via `bww_guilds.owner_id`; kein Vertrauen in `user_metadata` oder frei aenderbare Profilfelder.
- Discord-Rollen-Sync-Hinweis (Phase 11, offen): volles User-Binding braucht Bot-seitige Rollen-Verifikation oder User-OAuth – Nr. 14 (`14_IMPLEMENTATION.md` Phase 8–9).

## 5. Dashboard

- **IDOR/BOLA**: siehe §3 (Guild-Scope + Ownership-First).
- **CSRF**: Cookie `httpOnly + SameSite=lax + secure(prod)` + `lib/csrf.js`-Origin/Referer-Check fuer POST/PATCH/PUT/DELETE (`403` bei Fremd-Origin). GET bleibt lesend.
- **XSS**: React escapet per Default; `lib/escape.js` (`escapeHtml/escapeAttr/stripControl/safePreviewText`) fuer Preview/`dangerouslySetInnerHTML`/Titel-Attribute/Logs.
- **SQL-Injection**: kein Raw-SQL vom Client; Supabase-Query-Builder + `encodeURIComponent` + `lib/validation.js` (`cleanId/requireGuildId/clampText/oneOf/toSafeLimit`).
- **Input-Validation**: zentrale `lib/validation.js` (Mirror zu `src/services/validation.js`); Fehler als `VALIDATION_ERROR` (400, deutsch) via `lib/api.js`.
- **Guild-Wechsel**: blockiert (neuer Code noetig) – kein stiller Scope-Wechsel.
- **Replay/abgelaufene Actions**: Dashboard-Codes (`code_hash + used_at IS NULL + expires_at > now`, `consumeDashboardCode` atomic → Doppel-Use 409); Verification-Codes (`isCodeUsable`, `cleanupExpiredCodes`, `bww_purge_expired_codes()`); Giveaway-End idempotent (bereits beendet → 409 statt Doppel-Queue).
- **Rate-Limits**: `lib/rate-limit.js` (In-Memory, best-effort) + Presets (`login/testSend 5/10min`, `verify/codes/end/reroll 10/min`); aktiv auf Login + Giveaway-End/Reroll, Rollout auf `test-send/verify/codes` in Nr. 14.

## 6. Discord-Aktionen (Ban/Kick/Timeout)

- Bot prueft live (`src/modules/honeypot/actionService.js`): Bot-Recht (`ManageMessages/ModerateMembers/Kick/Ban`), `moderatable/kickable/bannable` (Hierarchie), Config (`enabled`, Exemptions), dann Log (Audit + System + Log-Channel).
- Dashboard validiert vor Queueing (`website/lib/moderation.js`): `validateModerationInput` (Aktion/Target/Reason/Dauer) + `moderationChecklist` (Bot-Recht + Zielrolle + Hierarchie + Config + Log).
- Honeypot/Verification/Ticket bereits mit Config + Log; Ban/Kick/Timeout nie ohne Bot-Recht + Hierarchie + Audit.

## 7. Verification (Datensparsamkeit + Ablauf)

- Nur notwendige Daten (`ip_hash` statt Klartext-IP, `code_hash` statt Klartext-Code wo moeglich, `user_agent` nur fuer Missbrauchs-Erkennung).
- Ablaufende Tokens/Codes: `expires_at`-Checks (`isExpired/isCodeUsable`), aktive-Liste (`listActiveCodesV2`), Cleanup (`cleanupExpiredCodes` + `purgeExpiredDashboardCodes` + DB-Funktion `bww_purge_expired_codes()` via Scheduler/Cron).
- Scheduler (`src/services/scheduler.js`): registriert Cleanup-Tasks (z.B. alle 15min), Fehler werden geloggt, Tasks laufen weiter.

## 8. Logs (keine Secrets)

- Sanitizer: `website/lib/sanitize.js` (`sanitizeValue/sanitizeLogArgs/sanitizeAuditDetails`) + Bot-Sanitizer in `src/services/logger.js`, `src/services/audit.js`, `src/logger.js`.
- Maskiert: `sb_secret_*`, `sb_publishable_*`, JWT, Discord-Webhook-URLs, Keys mit `token/password/secret/*key*/bearer/code_hash/session/cookie/webhook`; kuerzt auf 2000 Zeichen.
- Audit-Details sanitized vor `bww_audit_logs`; Logger sanitized vor `console` + Webhook-Forwarding (silent-fail).

## 9. Webhooks

- Stand: **keine eingehenden externen Webhooks** (nur ausgehender `LOG_WEBHOOK_URL` fuer Bot-/Sync-Logs, server-seitig via ENV).
- Daher keine Signatur-Validierung noetig; `LOG_WEBHOOK_URL` als secret-aehnlich behandeln (nie an Client, nie loggen).
- Falls kuenftig Inbound-Webhooks (z.B. Discord Interactions, Stripe, Supabase): Secret + HMAC-Signatur pruefen, Timestamp-Toleranz (±5min), Replay-Cache (einmalige Event-IDs), `401` bei Fehlschlag, Audit-Log.

## 10. Backups (Supabase PITR/Strategie)

- Supabase verwaltet automatische Backups + Point-in-Time-Recovery (PITR) je nach Plan (Free: taegliche Backups 7 Tage; Pro/Team: PITR + laengere Retention – aktuellen Plan in Supabase-Dashboard pruefen).
- Strategie: kritische `bww_*`-Tabellen (Guilds/Settings/Tickets/Giveaways/Verification/Audit) sind via Supabase-Backups abgedeckt; zusaetzlich vor grossen Migrationen manuellen Snapshot/Export (`supabase db dump` oder Dashboard → Database → Backups).
- Restore-Test regelmaessig (Staging-Projekt), RPO/RTO im Team festlegen; Migrationen bleiben idempotent (`IF NOT EXISTS`), damit Re-Runs nach Restore sicher sind.
- Keine Secrets in Backups-Logs; Dump-Files nie committen (`.gitignore`), verschluesselt ablegen.

## 11. Audit (Wer/Was/Alt/Neu/Wann)

- `bww_audit_logs`: `guild_id` (Wo/Wer-Kontext), `actor_id` (Wer), `action` (Was, z.B. `ticket.close`, `giveaway.end`, `verification.update`, `guild.settings.update`), `target_type/target_id` (Worauf), `details` (Alt/Neu, sanitized), `created_at` (Wann).
- Schreiber: `website/lib/audit.js` (`writeAuditLog`, Best-Effort, blockiert nie) + Bot `src/services/audit.js` (`logAudit`, Fallback auf Logger).
- Regel: GET = kein Audit; POST/PATCH/DELETE = Audit (kanonische Mutationen auditieren; Legacy-Routen nachruesten, siehe Checkliste).
- Beispiel: `Wer: <actorId> | Was: Ticket AutoClose | Alt: 24h | Neu: 48h | Wann: <created_at>`.

## 12. Checkliste (Security-Review vor jedem Release)

- [ ] Keine `service_role`/`secret`/`private key` im Browser (`NEXT_PUBLIC_*` nur URL + publishable/anon)?
- [ ] `.env.example` nur Platzhalter, kein echtes Secret committet?
- [ ] Alle `:guildId`-Routen pruefen `GUILD_MISMATCH` (403)?
- [ ] Alle `:id`-Routen filtern `guild_id=eq.sessionGuild` + Ownership-First bei Sub-Ressourcen?
- [ ] Kein Guild-Listing ueber Session-Guild hinaus?
- [ ] `UPDATE`-Policies (falls neu) mit `USING` **und** `WITH CHECK` + `bww_can_access_guild`?
- [ ] Keine Views ohne `security_invoker` + ohne Grant an `anon/authenticated`?
- [ ] Permissions server-seitig (Guards + Matrix), kein Vertrauen in `memberRoleIds`/`user_metadata`?
- [ ] CSRF (SameSite + Origin-Check) auf allen mutierenden Routen?
- [ ] XSS-Escaping in Preview/Seiten (`escapeHtml`)?
- [ ] Input-Validation (`validation.js`, `VALIDATION_ERROR`)?
- [ ] Rate-Limits auf `login/test-send/verify/codes/giveaway-end/reroll`?
- [ ] Replay-Schutz (ablaufende Actions: Codes/Invites/Transcripts mit `expires_at`)?
- [ ] Ban/Kick/Timeout: Bot-Recht + Zielrolle + Hierarchie + Config + Log?
- [ ] Abgelaufene Codes/Tokens geloescht/deaktiviert (Scheduler/Cleanup)?
- [ ] Keine Secrets in Logs/Audit (Sanitizer aktiv)?
- [ ] Webhooks: Secrets/Signaturen validiert (falls Inbound existiert)?
- [ ] Backups/PITR geprueft + Restore getestet?
- [ ] Admin-Aenderungen mit Wer/Was/Alt/Neu/Wann in `bww_audit_logs`?

## 13. Naechstes (Nr. 14 = 14_IMPLEMENTATION.md Phase 8–9 Test & Hardening)

- Discord-Rollen-Sync ans Dashboard + User-OAuth (volles User-Binding statt `memberRoleIds`-Hints).
- Rate-Limit-Rollout auf alle sensitiven Routen (`test-send/verify/codes`) + verteiltes Limit (Redis/Upstash) statt In-Memory.
- Legacy-Routen (`/api/dashboard/*`) auf Audit + CSRF + Rate-Limit nachruesten (kanonisch bereits gehärtet).
- Permission-Deny-Audit + Anomaly-Alerts (viele 403/429 → Warnung).
- E2E-Security-Tests (IDOR/BOLA-Matrix, Replay, Ablauf, Rate-Limit) in Phase 8–9.
