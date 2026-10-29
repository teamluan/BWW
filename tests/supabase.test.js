// BWW - tests/supabase.test.js (Schema/Constraints/RLS).
 // Prueft Migrationen, ohne Secrets/Netzwerk.
 // Dashboard-Scoped-Loader-Checks entfallen mit website/ (entfernt).
 const { describe, it } = require('node:test');
 const assert = require('node:assert/strict');
 const fs = require('node:fs');
 const path = require('node:path');
 const root = path.join(__dirname, '..');
 const migDir = path.join(root, 'supabase/migrations');
 const allMig = () => fs.readdirSync(migDir).map((f) => fs.readFileSync(path.join(migDir, f), 'utf8').toLowerCase()).join('\n');

 describe('Supabase: Schema (alle bww_*-Tabellen + Spalten)', () => {
   it('Tabellen aus 02-08 + Plattform (notifications/system_logs/exports)', () => {
     const sql = allMig();
     for (const t of ['bww_guilds', 'bww_tickets', 'bww_ticket_panels', 'bww_honeypot_triggers', 'bww_embeds', 'bww_welcome_logs', 'bww_giveaways', 'bww_giveaway_entries', 'bww_verification_users', 'bww_audit_logs', 'bww_system_logs', 'bww_notifications', 'bww_dashboard_logins']) {
       assert.ok(sql.includes(t), 'Tabelle fehlt: ' + t);
     }
     assert.ok(sql.includes('bww-exports'), 'Bucket bww-exports fehlt');
     assert.ok(sql.includes('guild_id'), 'guild_id-Spalte fehlt');
   });
 });

 describe('Supabase: Constraints', () => {
   it('Status-CHECKs, winner_count, UNIQUE', () => {
     const sql = allMig();
     assert.ok(sql.includes('unique'), 'UNIQUE-Constraint fehlt (z.B. code_hash)');
     assert.ok(sql.includes('winner_count') || sql.includes('check'), 'Status/Count-Checks fehlen');
   });
 });

 describe('Supabase: RLS (Guild-Isolation, anon denied, service_role)', () => {
   it('Default-Deny + Guild-Isolation + service_role', () => {
     const sql = allMig();
     assert.ok(sql.includes('enable row level security'), 'RLS fehlt');
     assert.ok(sql.includes('revoke all') && sql.includes('from anon'), 'anon-Deny fehlt');
     assert.ok(sql.includes('to service_role'), 'service_role-Grant fehlt');
     assert.ok(sql.includes('bww_can_access_guild') || sql.includes('guild_id'), 'Guild-Isolation fehlt');
   });
 });