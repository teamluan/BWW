'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardShell from '../../components/dashboard-shell';

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

function Switch({ active, onClick }) {
  return <button className={'switch ' + (active ? 'active' : '')} onClick={onClick} aria-pressed={active}><span /></button>;
}

function SettingsCard({ kicker, title, description, active, onToggle, children }) {
  return (
    <article className="surface-card settings-card">
      <div className="settings-heading">
        <div><span className="section-kicker">{kicker}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>
        {typeof active === 'boolean' && <Switch active={active} onClick={onToggle} />}
      </div>
      {children}
    </article>
  );
}

export default function SettingsPage() {
  const [mode, setMode] = useState('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [guild, setGuild] = useState(null);
  const [settings, setSettings] = useState(EMPTY);
  const [saved, setSaved] = useState(false);

  const permissionRows = useMemo(() => COMMANDS.map((name) => ({ name, roles: settings.permissions?.[name] || [] })), [settings.permissions]);

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
    setMode('ready');
  }

  useEffect(() => {
    load().catch((err) => {
      setError(err.message || 'Einstellungen konnten nicht geladen werden.');
      setMode('error');
    });
  }, []);

  function patch(section, key, value) {
    setSettings((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
    setSaved(false);
  }

  function setPermission(command, raw) {
    const roles = raw.split(/[,\s]+/).map((id) => id.replace(/\D/g, '')).filter(Boolean).slice(0, 25);
    setSettings((current) => ({ ...current, permissions: { ...current.permissions, [command]: roles } }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setSaved(false);
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
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'loading') return <main className="dashboard-app"><div className="page-loading">Einstellungen werden geladen…</div></main>;
  if (mode === 'error') return <main className="dashboard-app"><div className="error-panel"><span className="page-kicker">BWW COMMAND CENTER</span><h1>Bereich nicht verfügbar</h1><p>{error}</p><a className="button-secondary" href="/dashboard">Zur Übersicht</a></div></main>;

  return (
    <DashboardShell active="settings" guild={guild}>
      <div className="page">
        <header className="page-header">
          <div>
            <div className="breadcrumb">BWW <span>/</span> Einstellungen</div>
            <h1>Einstellungen</h1>
            <p>Konfiguriere deinen Bot zentral. Änderungen werden direkt gespeichert und vom Bot übernommen.</p>
          </div>
          <div className="header-meta"><span className="server-context">{guild?.name || 'BWW Server'}</span></div>
        </header>

        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert success">Änderungen wurden gespeichert.</div>}

        <section className="settings-layout">
          <div className="settings-main">
            <div className="section-title"><div><span className="section-kicker">SERVER</span><h2>Grundkonfiguration</h2></div><span className="section-caption">4 Bereiche</span></div>

            <SettingsCard kicker="WELCOME" title="Willkommensnachricht" description="Begrüße neue Mitglieder automatisch." active={settings.welcome.enabled} onToggle={() => patch('welcome', 'enabled', !settings.welcome.enabled)}>
              <div className="form-grid">
                <label><span>Channel-ID</span><input value={settings.welcome.channelId} onChange={(e) => patch('welcome', 'channelId', e.target.value)} placeholder="Discord Channel-ID" /></label>
                <label><span>Titel</span><input value={settings.welcome.title} onChange={(e) => patch('welcome', 'title', e.target.value)} placeholder="Optionaler Titel" /></label>
              </div>
              <label className="form-field"><span>Nachricht</span><textarea value={settings.welcome.message} onChange={(e) => patch('welcome', 'message', e.target.value)} rows={4} /></label>
              <p className="field-hint"><code>{'{user}'}</code> Ping · <code>{'{username}'}</code> Name · <code>{'{server}'}</code> Server · <code>{'{count}'}</code> Mitglieder</p>
            </SettingsCard>

            <SettingsCard kicker="VERIFY" title="Verifizierung" description="Richte den Verifizierungs-Channel und die Rolle ein." active={settings.verify.enabled} onToggle={() => patch('verify', 'enabled', !settings.verify.enabled)}>
              <div className="form-grid">
                <label><span>Channel-ID</span><input value={settings.verify.channelId} onChange={(e) => patch('verify', 'channelId', e.target.value)} placeholder="Discord Channel-ID" /></label>
                <label><span>Rollen-ID</span><input value={settings.verify.roleId} onChange={(e) => patch('verify', 'roleId', e.target.value)} placeholder="Discord Rollen-ID" /></label>
              </div>
              <label className="form-field"><span>Text</span><textarea value={settings.verify.message} onChange={(e) => patch('verify', 'message', e.target.value)} rows={4} /></label>
            </SettingsCard>

            <SettingsCard kicker="TICKETS" title="Ticket-System" description="Definiere Kategorie und Support-Rolle für neue Tickets." active={settings.ticket.enabled} onToggle={() => patch('ticket', 'enabled', !settings.ticket.enabled)}>
              <div className="form-grid">
                <label><span>Kategorie-ID</span><input value={settings.ticket.categoryId} onChange={(e) => patch('ticket', 'categoryId', e.target.value)} placeholder="Discord Kategorie-ID" /></label>
                <label><span>Support-Rollen-ID</span><input value={settings.ticket.roleId} onChange={(e) => patch('ticket', 'roleId', e.target.value)} placeholder="Discord Rollen-ID" /></label>
              </div>
            </SettingsCard>

            <SettingsCard kicker="STATUS" title="Bot-Status" description="Steuere den zentralen Status-Channel des Bots." active={settings.status.enabled} onToggle={() => patch('status', 'enabled', !settings.status.enabled)}>
              <div className="form-grid">
                <label><span>Channel-ID</span><input value={settings.status.channelId} onChange={(e) => patch('status', 'channelId', e.target.value)} placeholder="Discord Channel-ID" /></label>
                <label><span>Modus</span><select value={settings.status.mode} onChange={(e) => patch('status', 'mode', e.target.value)}><option value="online">Online</option><option value="maintenance">Wartung</option><option value="offline">Offline</option></select></label>
              </div>
              <label className="form-field"><span>Message-ID</span><input value={settings.status.messageId} readOnly /></label>
            </SettingsCard>

            <SettingsCard kicker="BERECHTIGUNGEN" title="Command-Rollen" description="Lege fest, welche Rollen einzelne Commands ausführen dürfen.">
              <div className="permissions-table">
                {permissionRows.map(({ name, roles }) => (
                  <label key={name}><span>/{name}</span><input value={roles.join(', ')} onChange={(e) => setPermission(name, e.target.value)} placeholder="Rollen-ID(s)" /></label>
                ))}
              </div>
            </SettingsCard>
          </div>

          <aside className="settings-aside">
            <div className="surface-card sticky-card">
              <span className="section-kicker">SERVER</span>
              <h3>{guild?.name || 'BWW Server'}</h3>
              <p>Alle Einstellungen gelten für diese Discord-Guild.</p>
              <div className="server-summary">
                <div><span>Server-ID</span><strong>{guild?.guild_id || '—'}</strong></div>
                <div><span>Mitglieder</span><strong>{new Intl.NumberFormat('de-DE').format(Number(guild?.member_count) || 0)}</strong></div>
              </div>
              <div className="aside-divider" />
              <a className="aside-link" href="/honeypot"><span><strong>Honeypot</strong><small>Trap-Channel und Sicherheit verwalten</small></span><span>→</span></a>
              <a className="aside-link" href="/embeds"><span><strong>Embeds V2</strong><small>Nachrichten zentral erstellen</small></span><span>→</span></a>
            </div>
          </aside>
        </section>

        <footer className="save-bar">
          <span>Server-ID: {guild?.guild_id}</span>
          <button className="button-primary" onClick={save} disabled={busy}>{busy ? 'Speichere…' : 'Änderungen speichern'}</button>
        </footer>
      </div>
    </DashboardShell>
  );
}
