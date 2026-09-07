const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'config');
const file = path.join(dir, 'config.json');
const defaults = {
  welcome: { enabled: false, channelId: '', title: '', message: 'Willkommen {user} auf dem Server! \uD83C\uDF89' },
  verify: { enabled: false, channelId: '', message: 'Klicke auf den Button, um dich zu verifizieren.', roleId: '' },
  ticket: { enabled: false, categoryId: '', roleId: '' },
  permissions: {}
};

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(defaults, null, 2));

function load() {
  try {
    const data = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(data);
    return {
      welcome: { ...defaults.welcome, ...(parsed.welcome || {}) },
      verify: { ...defaults.verify, ...(parsed.verify || {}) },
      ticket: { ...defaults.ticket, ...(parsed.ticket || {}) },
      permissions: parsed.permissions && typeof parsed.permissions === 'object' ? parsed.permissions : {}
    };
  } catch { return structuredClone(defaults); }
}
function save(config) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2));
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error('Config speichern fehlgeschlagen:', err.message);
    throw err;
  }
}
module.exports = { load, save };
