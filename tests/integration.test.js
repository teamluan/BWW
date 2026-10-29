// BWW - tests/integration.test.js (Bot+Supabase, ohne Dashboard).
 // Ohne Secrets/Netzwerk: Bot-Services schreiben direkt in Supabase (bww_*).
 // Dashboard-Checks entfallen mit website/ (entfernt).
 const { describe, it } = require('node:test');
 const assert = require('node:assert/strict');
 const path = require('node:path');
 const root = path.join(__dirname, '..');
 const read = (p) => require('node:fs').readFileSync(path.join(root, p), 'utf8');

 describe('Integration: Bot->DB (Services schreiben bww_*)', () => {
   it('Bot schreibt Tickets/Giveaways/Notifications/SystemLogs', () => {
     const db = read('src/utils/database.js');
     assert.ok(db.includes('bww_tickets') && db.includes('bww_giveaways'));
     const n = read('src/services/notifications.js');
     assert.ok(n.includes('bww_notifications'));
     const honey = read('src/modules/honeypot/actionService.js');
     assert.ok(honey.includes('bww_system_logs') || honey.includes('writeSystemLog'));
   });
 });

 describe('Integration: Commands->DB (Slash schreibt gleiche Tabellen)', () => {
   it('Ticket/Giveaway-Services nutzen bww_*-Tabellen', () => {
     const ts = read('src/modules/ticket/ticketService.js');
     const gs = read('src/modules/giveaway/giveawayService.js');
     assert.ok(ts.includes('bww_tickets'));
     assert.ok(gs.includes('bww_giveaways'));
   });
 });

 describe('Integration: Bot ohne website/ (kein Dashboard-Import)', () => {
   it('src/index.js referenziert kein website/ und keine Dashboard-Queue', () => {
     const index = read('src/index.js');
     assert.ok(!index.includes('website/'), 'src/index.js darf website/ nicht referenzieren');
     assert.ok(!index.includes('processDashboardActions'), 'Dashboard-Queue-Loop muss entfernt sein');
   });
 });