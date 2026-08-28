const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'config');
const file = path.join(dir, 'config.json');
const defaults = {
  welcome: { enabled: false, channelId: '', title: '', message: 'Willkommen {user} auf dem Server! 🎉' },
  verify: { enabled: false, channelId: '', message: 'Klicke auf den Button, um dich zu verifizieren.', roleId: '' },
  permissions: {}
};

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(defaults, null, 2));

function load() { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return structuredClone(defaults); } }
function save(config) { fs.writeFileSync(file, JSON.stringify(config, null, 2)); }
module.exports = { load, save };
