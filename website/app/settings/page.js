'use client';

import { useEffect, useMemo, useState } from 'react';

const COMMANDS = [
  'nachricht', 'embed', 'setup', 'verify', 'ticket', 'giveaway',
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

export default function SettingsPage() {
  const [mode, setMode] = useState('loading');
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
    const response = await fetch('/api/dashboard/settings', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.replace('/');
      return;
    }
    if (!response.ok) throw new Error(data.error || 'Einstellungen konnten nicht geladen werden.');
    setGuild(data.guild);
    setSettings(data.settings || EMPTY);
    setMode('settings');
  }

  useEffect(() => {
    load().catch((err) => {
      setError(err.message || 'Einstellungen konnten nicht geladen werden.');
      setMode('error');
    });
  }, []);

  function patch(section, key, value) {
    setSettings((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value }
    }));
    setSaved('');
  }

  function setPermission(command, raw) {
    const roles = raw.split(/[,\s]+/).map((id) => id.replace(/\D/g, '')).filter(Boolean).slice(0, 25);
    setSettings((current) => ({
      ...current,
      permissions: { ...current.permissions, [command]: roles }
    }));
    setSaved('');
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
      setSaved('Änderungen gespeichert.');
    } catch (err) {
      setError(err.message || 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/dashboard/logout', { method: 'POST' });
    window.location.replace('/');
  }

  if (mode === 'loading') {
    return <main className="dashboard-app"><div className="page-loading"><span className="brand-icon">B</span><span>Einstellungen werden geladen…</span></div></main>;
  }

  if (mode === 'error') {
    return <main className="dashboard-app"><div className="error-panel"><span className="eyebrow">BWW COMMAND CENTER</span><h1>Bereich nicht verfügbar</h1><p>{error}</p><a className="button-secondary" href="/dashboard">Zur Übersicht</a></div></main>;
  }

  return (
    <main className="dashboard-app">
      <div className="dashboard-frame">
        <aside className="sidebar">
          <a className="sidebar-brand" href="/dashboard"><span className="brand-icon">B</span><span><strong>BWW</strong><small>COMMAND CENTER</small></span></a>
          <nav className="sidebar-nav" aria-label="Dashboard">
            <span className="nav-group-label">ÜBERSICHT</span>
            <a className="sidebar-link" href="/dashboard">▦<span>Dashboard</span></a>
            <a className="sidebar-link" href="/embeds">▣<span>Embeds V2</span></a>
            <a className="sidebar-link active" href="/settings">⚙<span>Einstellungen</span></a>
            <span className="nav-group-label spaced">SERVER</span>
            <a className="sidebar-link" href="#welcome">◈<span>Welcome</span></a>
            <a className="sidebar-link" href="#verify">✓<span>Verifizierung</span></a>
            <a className="sidebar-link" href="#ticket">□<span>Tickets</span></a>
          </nav>
          <div className="sidebar-bottom">
            <div className="access-chip"><span className="status-indicator online" /><div><strong>Admin Session</strong><small>{guild?.name || 'Geschützt aktiv'}</small></div></div>
            <button className="sidebar-logout" onClick={logout}>↪<span>Abmelden</span></button>
          </div>
        </aside>

        <section className="dashboard-main">
          <header className="dashboard-topbar settings-topbar">
            <div>
              <span className="eyebrow">BWW / SERVER-KONFIGURATION</span>
              <h1>Einstellungen</h1>
              <p>Konfiguriere deinen Bot zentral. Die Änderungen werden direkt in Supabase gespeichert.</p>
            </div>
            <div className="top-actions"><span className="secure-pill">ADMIN · {guild?.name || 'BWW'}</span><a className="button-secondary" href="/dashboard">Übersicht</a></div>
          </header>

          {error && <div className="form-alert error">{error}</div>}
          {saved && <div className="form-alert success">{saved}</div>}

          <section className="settings-grid">
            <article className="settings-card" id="welcome">
              <div className="settings-card-heading"><div><span className="eyebrow">WELCOME</span><h2>Willkommensnachricht</h2></div><button className={'toggle-button ' + (settings.welcome.enabled ? 'active' : '')} onClick={() => patch('welcome', 'enabled', !settings.welcome.enabled)}>{settings.welcome.enabled ? 'AN' : 'AUS'}</button></div>
              <label><span>Channel-ID</span><input value={settings.welcome.channelId} onChange={(e) => patch('welcome', 'channelId', e.target.value)} placeholder="Discord Channel-ID" /></label>
              <label><span>Titel</span><input value={settings.welcome.title} onChange={(e) => patch('welcome', 'title', e.target.value)} placeholder="Optionaler Titel" /></label>
              <label><span>Nachricht</span><textarea value={settings.welcome.message} onChange={(e) => patch('welcome', 'message', e.target.value)} rows={5} /></label>
              <p className="hint"><code>{'{user}'}</code> Ping · <code>{'{username}'}</code> Name · <code>{'{server}'}</code> Server · <code>{'{count}'}</code> Mitglieder</p>
            </article>

            <article className="settings-card" id="verify">
              <div className="settings-card-heading"><div><span className="eyebrow">VERIFY</span><h2>Verifizierung</h2></div><button className={'toggle-button ' + (settings.verify.enabled ? 'active' : '')} onClick={() => patch('verify', 'enabled', !settings.verify.enabled)}>{settings.verify.enabled ? 'AN' : 'AUS'}</button></div>
              <label><span>Channel-ID</span><input value={settings.verify.channelId} onChange={(e) => patch('verify', 'channelId', e.target.value)} placeholder="Discord Channel-ID" /></label>
              <label><span>Rollen-ID</span><input value={settings.verify.roleId} onChange={(e) => patch('verify', 'roleId', e.target.value)} placeholder="Discord Rollen-ID" /></label>
              <label><span>Text</span><textarea value={settings.verify.message} onChange={(e) => patch('verify', 'message', e.target.value)} rows={5} /></label>
            </article>

            <article className="settings-card" id="ticket">
              <div className="settings-card-heading"><div><span className="eyebrow">TICKETS</span><h2>Ticket-System</h2></div><button className={'toggle-button ' + (settings.ticket.enabled ? 'active' : '')} onClick={() => patch('ticket', 'enabled', !settings.ticket.enabled)}>{settings.ticket.enabled ? 'AN' : 'AUS'}</button></div>
              <label><span>Kategorie-ID</span><input value={settings.ticket.categoryId} onChange={(e) => patch('ticket', 'categoryId', e.target.value)} placeholder="Discord Kategorie-ID" /></label>
              <label><span>Support-Rollen-ID</span><input value={settings.ticket.roleId} onChange={(e) => patch('ticket', 'roleId', e.target.value)} placeholder="Discord Rollen-ID" /></label>
              <p className="hint">Kategorie und Support-Rolle werden beim Erstellen neuer Tickets verwendet.</p>
            </article>

            <article className="settings-card">
              <div className="settings-card-heading"><div><span className="eyebrow">STATUS</span><h2>Status-Embed</h2></div><button className={'toggle-button ' + (settings.status.enabled ? 'active' : '')} onClick={() => patch('status', 'enabled', !settings.status.enabled)}>{settings.status.enabled ? 'AN' : 'AUS'}</button></div>
              <label><span>Channel-ID</span><input value={settings.status.channelId} onChange={(e) => patch('status', 'channelId', e.target.value)} placeholder="Discord Channel-ID" /></label>
              <label><span>Modus</span><select value={settings.status.mode} onChange={(e) => patch('status', 'mode', e.target.value)}><option value="online">Online</option><option value="maintenance">Wartung</option><option value="offline">Offline</option></select></label>
              <label><span>Message-ID</span><input value={settings.status.messageId} readOnly /></label>
              <p className="hint">Beim Wechsel des Channels kann der Bot das Status-Embed automatisch neu anlegen.</p>
            </article>

            <article className="settings-card settings-wide">
              <div className="settings-card-heading"><div><span className="eyebrow">BERECHTIGUNGEN</span><h2>Command-Rollen</h2></div></div>
              <p className="hint">Mehrere Rollen-IDs mit Komma oder Leerzeichen trennen. Discord-Administratoren haben weiterhin Zugriff.</p>
              <div className="permission-list">
                {permissionRows.map(({ name, roles }) => (
                  <label key={name} className="permission-row"><span>/{name}</span><input value={roles.join(', ')} onChange={(e) => setPermission(name, e.target.value)} placeholder="Rollen-ID(s)" /></label>
                ))}
              </div>
            </article>
          </section>

          <footer className="settings-footer"><span>Server-ID: {guild?.guild_id}</span><button className="button-primary" onClick={save} disabled={busy}>{busy ? 'Speichere…' : 'Änderungen speichern'}</button></footer>
        </section>
      </div>
    </main>
  );
}
