#!/usr/bin/env node
/**
 * Verschlüsselt einen Discord Webhook für sync.js (AES-256-CBC, Key=sha256(passphrase), IV=0).
 * Kompatibel zu sync.js:18 decryptWebhook().
 *
 * Usage:
 *   node scripts/encrypt-webhook.js <webhookUrl> [passphrase]
 *   npm run encrypt:webhook -- <webhookUrl> [passphrase]
 *   node scripts/encrypt-webhook.js --decrypt <hex> [passphrase]
 *   npm run decrypt:webhook -- <hex> [passphrase]
 *
 * Default passphrase: bww-secure-2025 (muss zu WEBHOOK_PASSPHRASE in sync.js passen)
 */
const crypto = require('crypto');

const DEFAULT_PASSPHRASE = 'bww-secure-2025';

function encrypt(webhook, passphrase) {
  const key = crypto.createHash('sha256').update(String(passphrase)).digest();
  const iv = Buffer.alloc(16, 0);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let enc = cipher.update(String(webhook), 'utf8', 'hex');
  enc += cipher.final('hex');
  return enc;
}
function decrypt(enc, passphrase) {
  const key = crypto.createHash('sha256').update(String(passphrase)).digest();
  const iv = Buffer.alloc(16, 0);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let dec = decipher.update(String(enc), 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

const args = process.argv.slice(2);
if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log(`Usage:
  node scripts/encrypt-webhook.js <webhookUrl> [passphrase]
  node scripts/encrypt-webhook.js --decrypt <hex> [passphrase]

Examples:
  node scripts/encrypt-webhook.js https://discord.com/api/webhooks/123/abc
  node scripts/encrypt-webhook.js https://discord.com/api/webhooks/123/abc mein-passwort
  node scripts/encrypt-webhook.js --decrypt 448d1dcc7ac27f... bww-secure-2025

In sync.js einfügen:
  const WEBHOOK_ENCRYPTED = '<hex>';
  const WEBHOOK_PASSPHRASE = process.env.WEBHOOK_PASSPHRASE || 'bww-secure-2025';
`);
  process.exit(args.length ? 0 : 1);
}

if (args[0] === '--decrypt' || args[0] === '-d') {
  const enc = args[1];
  const pass = args[2] || DEFAULT_PASSPHRASE;
  if (!enc) { console.error('Fehlt: <hex>'); process.exit(1); }
  try {
    const dec = decrypt(enc, pass);
    console.log(dec);
  } catch (e) {
    console.error('Decrypt fehlgeschlagen:', e.message);
    process.exit(1);
  }
  process.exit(0);
}

const webhook = args[0];
const passphrase = args[1] || DEFAULT_PASSPHRASE;
if (!/^https:\/\/discord\.com\/api\/webhooks\//.test(webhook) && !/^https:\/\/discordapp\.com\/api\/webhooks\//.test(webhook)) {
  console.warn('Warnung: sieht nicht wie ein Discord Webhook aus, verschlüssele trotzdem...');
}
const enc = encrypt(webhook, passphrase);
console.log(`WEBHOOK_ENCRYPTED='${enc}'`);
console.log(`WEBHOOK_PASSPHRASE='${passphrase}'`);
console.log('');
console.log('In sync.js:18 ersetzen:');
console.log(`const WEBHOOK_ENCRYPTED = '${enc}';`);
console.log('');
// Verify
try {
  const dec = decrypt(enc, passphrase);
  console.log('verify:', dec === webhook ? 'OK' : 'FAIL');
  if (dec !== webhook) process.exit(1);
} catch (e) {
  console.error('verify FAIL:', e.message);
  process.exit(1);
}
