# BWW - API (entfernt: Web-Dashboard)

 > Stand 2026-10-15: `website/` (Next.js-Dashboard inkl. `website/app/api/*` und `website/lib/*`) ist gelöscht. Diese Datei bleibt als Marker; es gibt keine HTTP-API mehr in diesem Repository.

 ## Einzige Quellen

 - Discord-Commands in `src/commands/*` (vgl. `docs/COMMANDS.md`)
 - Supabase-Tabellen `bww_*` direkt via `src/services/*` und `src/utils/database.js` (`supabaseRequest` mit `SUPABASE_URL` + `SUPABASE_SECRET_KEY`, Single Source `bww_guild_settings`)
 - Audit: `src/services/audit.js` [[arr]] `bww_audit_logs` (Best-Effort, nie werfend)
 - Notifications: `src/services/notifications.js` [[arr]] `bww_notifications` (Best-Effort-Trigger)

 ## Fehler-/Erfolgsformat (Bot)

 Deutsche Validierung in `src/services/validation.js`; Fehler werden als Discord-Antworten (ephemeral) und Logs (`bww_system_logs`) ausgegeben - kein HTTP-Fehlerformat mehr.

 ## Weiterführend

 - Commands: `docs/COMMANDS.md`
 - Permissions-Matrix: `docs/PERMISSIONS.md`
 - Struktur: `docs/STRUCTURE.md`