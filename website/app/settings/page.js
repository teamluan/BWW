'use client';

import { useEffect, useMemo, useState } from 'react';

const COMMANDS = [
  'nachricht', 'setup', 'verify', 'ticket', 'giveaway',
  'panel-create', 'panel-send', 'panel-delete', 'panel-list',
  'panel-add-button', 'umfrage', 'setup-status', 'wartung',
  'restart', 'kick', 'ban', 'unban', 'timeout', 'giverole', 'removerole'
];

const EMPTY = {
  welcome: { enabled: false, channelId: '', title: '', message: 'Willkommen {user} auf dem Server! 🎉' },
  verify: { enabled: false, channelId: '', message: 'Klicke auf den Button, um dich zu verifizieren.', roleId: '' },
  ticket: { enabled: false, categoryId: '', roleId: '' },
  status: { enabled: false, channelId: '', messageId: '', mode: 'online' },
  permissions: {}
};

function toggle(value) {
  return value ? 'AN' : 'AUS';
}

export default function SettingsPage() {
  const [mode, setMode] = useState('loading');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [guild, setGuild] = useState(null);
  const [settings, setSettings] = useState(EMPTY);
  const [saved, setSaved] = useState('');

  const permissionRows = useMemo(
    () => COMMANDS.map((name) => ({ name, roles: settings.permissions?.[name] || [] })),
    [settings.permissions]
  );

  async function load() {
    setError('');
    const response = await fetch('/api/dashboard/settings', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      setMode('login');
      return;
    }
    if (!response.ok) {
      setError(data.error || 'Dashboard konnte nicht geladen werden.');
      setMode('login');
      return;
    }
    setGuild(data.guild);
    setSettings(data.settings || EMPTY);
    setMode('settings');
  }

  useEffect(() => {
    load().catch((err) => {
      setError(err.message || 'Dashboard konnte nicht geladen werden.');
      setMode('login');
    });
  }, []);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/dashboard/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Login fehlgeschlagen.');
      setGuild(data.guild);
      setCode('');
      await load();
    } catch (err) {
      setError(err.message || 'Login fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/dashboard/logout', { method: 'POST' });
    setMode('login');
    setGuild(null);
    setSettings(EMPTY);
  }

  function patch(section, key, value) {
    setSettings((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value }
    }));
  }

  function setPermission(command, raw) {
    const roles = raw.split(/[,\s]+/).map((id) => id.replace(/\D/g, '')).filter(Boolean).slice(0, 25);
    setSettings((current) => ({
      ...current,
      permissions: { ...current.permissions, [command]: roles }
    }));
  }

  async function save() {
    setBusy(true);
    setSaved('');
    setError('');
    try {
      const response = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Speichern fehlgeschlagen.');
      setSettings(data.settings);
      setSaved('Gespeichert');
    } catch (err) {
      setError(err.message || 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'loading') {
    return <main className="dashboard-page"><div className="settings-card"><span className="section-label">BWW COMMAND CENTER</span><h1>Dashboard wird geladen…</h1></div></main>;
  }

  if (mode === 'login') {
    return (
      <main className="dashboard-page">
        <section className="settings-card login-card">
          <a className="settings-back" href="/">← Zur Startseite</a>
          <span className="section-label">ADMINISTRATION</span>
          <h1>Dashboard-Zugang</h1>
          <p>Erzeuge im Discord mit <code>/dashboard-code</code> einen temporären Zugangscode.</p>
          <form onSubmit={login} className="settings-form">
            <label>
              <span>Dashboard-Code</span>
              <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="XXXXXXXX" autoComplete="one-time-code" />
            </label>
            {error && <div className="settings-error">{error}</div>}
            <button className="save-button" disabled={busy || !code.trim()}>{busy ? 'Anmelden…' : 'Anmelden'}</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <div className="settings-shell">
        <header className="settings-header">
          <div>
            <a className="settings-back" href="/">← Dashboard</a>
            <span className="section-label">SERVER-KONFIGURATION</span>
            <h1>{guild?.name || 'BWW Server'}</h1>
            <p>Alle botbezogenen Einstellungen werden zentral in Supabase gespeichert.</p>
          </div>
          <div className="settings-header-actions">
            <span className="session-badge">ADMIN SESSION</span>
            <button className="ghost-button" onClick={logout}>Abmelden</button>
          </div>
        </header>

        {error && <div className="settings-error">{error}</div>}
        {saved && <div className="settings-success">{saved} – der Bot übernimmt die Änderung automatisch.</div>}

        <section className="settings-grid">
          <article className="settings-card">
            <div className="settings-card-heading">
              <div><span className="section-label">WELCOME</span><h2>Willkommensnachricht</h2></div>
              <button className={`toggle-button ${settings.welcome.enabled ? 'active' : ''}`} onClick={() => patch('welcome', 'enabled', !settings.welcome.enabled)}>{toggle(settings.welcome.enabled)}</button>
            </div>
            <label><span>Channel-ID</span><input value={settings.welcome.channelId} onChange={(e) => patch('welcome', 'channelId', e.target.value)} placeholder="Discord Channel-ID" /></label>
            <label><span>Titel</span><input value={settings.welcome.title} onChange={(e) => patch('welcome', 'title', e.target.value)} placeholder="Optionaler Titel" /></label>
            <label><span>Nachricht</span><textarea value={settings.welcome.message} onChange={(e) => patch('welcome', 'message', e.target.value)} rows={5} /></label>
            <p className="hint"><code>{'{user}'}</code> Ping · <code>{'{username}'}</code> Name · <code>{'{server}'}</code> Server · <code>{'{count}'}</code> Mitglieder</p>
          </article>

          <article className="settings-card">
            <div className="settings-card-heading">
              <div><span className="section-label">VERIFY</span><h2>Verifizierung</h2></div>
              <button className={`toggle-button ${settings.verify.enabled ? 'active' : ''}`} onClick={() => patch('verify', 'enabled', !settings.verify.enabled)}>{toggle(settings.verify.enabled)}</button>
            </div>
            <label><span>Channel-ID</span><input value={settings.verify.channelId} onChange={(e) => patch('verify', 'channelId', e.target.value)} /></label>
            <label><span>Rollen-ID</span><input value={settings.verify.roleId} onChange={(e) => patch('verify', 'roleId', e.target.value)} /></label>
            <label><span>Text</span><textarea value={settings.verify.message} onChange={(e) => patch('verify', 'message', e.target.value)} rows={5} /></label>
          </article>

          <article className="settings-card">
            <div className="settings-card-heading">
              <div><span className="section-label">TICKETS</span><h2>Ticket-System</h2></div>
              <button className={`toggle-button ${settings.ticket.enabled ? 'active' : ''}`} onClick={() => patch('ticket', 'enabled', !settings.ticket.enabled)}>{toggle(settings.ticket.enabled)}</button>
            </div>
            <label><span>Kategorie-ID</span><input value={settings.ticket.categoryId} onChange={(e) => patch('ticket', 'categoryId', e.target.value)} /></label>
            <label><span>Support-Rollen-ID</span><input value={settings.ticket.roleId} onChange={(e) => patch('ticket', 'roleId', e.target.value)} /></label>
            <p className="hint">Die Ticket-Kategorie und Rolle werden beim Erstellen eines Tickets verwendet.</p>
          </article>

          <article className="settings-card">
            <div className="settings-card-heading">
              <div><span className="section-label">STATUS</span><h2>Status-Embed</h2></div>
              <button className={`toggle-button ${settings.status.enabled ? 'active' : ''}`} onClick={() => patch('status', 'enabled', !settings.status.enabled)}>{toggle(settings.status.enabled)}</button>
            </div>
            <label><span>Channel-ID</span><input value={settings.status.channelId} onChange={(e) => patch('status', 'channelId', e.target.value)} /></label>
            <label><span>Modus</span>
              <select value={settings.status.mode} onChange={(e) => patch('status', 'mode', e.target.value)}>
                <option value="online">Online</option>
                <option value="maintenance">Wartung</option>
                <option value="offline">Offline</option>
              </select>
            </label>
            <label><span>Message-ID</span><input value={settings.status.messageId} readOnly /></label>
            <p className="hint">Beim Aktivieren kann der Bot das Status-Embed automatisch im gewählten Channel anlegen.</p>
          </article>

          <article className="settings-card settings-wide">
            <div className="settings-card-heading">
              <div><span className="section-label">BERECHTIGUNGEN</span><h2>Command-Rollen</h2></div>
            </div>
            <p className="hint">Mehrere Rollen-IDs durch Komma oder Leerzeichen trennen. Administratoren haben immer Zugriff.</p>
            <div className="permission-list">
              {permissionRows.map(({ name, roles }) => (
                <label key={name} className="permission-row">
                  <span>/{name}</span>
                  <input value={roles.join(', ')} onChange={(e) => setPermission(name, e.target.value)} placeholder="Rollen-ID(s)" />
                </label>
              ))}
            </div>
          </article>
        </section>

        <footer className="settings-footer">
          <span>{guild?.guild_id}</span>
          <button className="save-button" onClick={save} disabled={busy}>{busy ? 'Speichere…' : 'Einstellungen speichern'}</button>
        </footer>
      </div>
    </main>
  );
}
