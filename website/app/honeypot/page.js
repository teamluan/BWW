'use client';

import { useEffect, useState } from 'react';
import DashboardShell from '../../components/dashboard-shell';

function Switch({ active, onClick }) {
  return <button type="button" className={'switch ' + (active ? 'active' : '')} onClick={onClick} aria-pressed={active}><span /></button>;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

const EMPTY = {
  enabled: false,
  channelId: '',
  logChannelId: '',
  punishment: 'none',
  timeoutMinutes: 10,
  deleteMessage: true,
  ignoreAdmins: true,
  exemptRoleIds: []
};

export default function HoneypotPage() {
  const [mode, setMode] = useState('loading');
  const [guild, setGuild] = useState(null);
  const [settings, setSettings] = useState(EMPTY);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load(showLoading = false) {
    if (showLoading) setMode('loading');
    const response = await fetch('/api/dashboard/honeypot', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.replace('/');
      return;
    }
    if (!response.ok) throw new Error(data.error || 'Honeypot konnte nicht geladen werden.');
    setGuild(data.guild);
    setSettings({ ...EMPTY, ...(data.settings || {}) });
    setEvents(Array.isArray(data.events) ? data.events : []);
    setMode('ready');
  }

  useEffect(() => {
    load(true).catch((err) => {
      setError(err.message || 'Honeypot konnte nicht geladen werden.');
      setMode('error');
    });
    const timer = setInterval(() => load(false).catch(() => {}), 10000);
    return () => clearInterval(timer);
  }, []);

  function patch(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function setRoles(raw) {
    const roles = raw
      .split(/[,s]+/)
      .map((id) => id.replace(/D/g, ''))
      .filter(Boolean)
      .slice(0, 25);
    patch('exemptRoleIds', roles);
  }

  async function save() {
    setBusy(true);
    setSaved(false);
    setError('');
    try {
      const response = await fetch('/api/dashboard/honeypot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ honeypot: settings })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Speichern fehlgeschlagen.');
      setSettings({ ...EMPTY, ...(data.settings || {}) });
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'loading') return <main className="dashboard-app"><div className="page-loading">Honeypot wird geladen…</div></main>;
  if (mode === 'error') return <main className="dashboard-app"><div className="error-panel"><span className="page-kicker">BWW SECURITY</span><h1>Honeypot nicht verfügbar</h1><p>{error}</p><a className="button-secondary" href="/dashboard">Zur Übersicht</a></div></main>;

  const hitCount = events.length;

  return (
    <DashboardShell active="honeypot" guild={guild}>
      <div className="page">
        <header className="page-header">
          <div>
            <div className="breadcrumb">BWW <span>/</span> Honeypot</div>
            <h1>Honeypot</h1>
            <p>Ein unauffälliger Trap-Channel, der unerwünschte Interaktionen erkennt und automatisch protokolliert.</p>
          </div>
          <div className="header-meta"><span className="server-context">{guild?.name || 'BWW Server'}</span></div>
        </header>

        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert success">Honeypot-Konfiguration gespeichert.</div>}

        <section className="settings-layout">
          <div className="settings-main">
            <article className="surface-card settings-card">
              <div className="settings-heading">
                <div>
                  <span className="section-kicker">SECURITY</span>
                  <h2>Honeypot-Schutz</h2>
                  <p>Der Bot reagiert nur auf echte Benutzer-Nachrichten im gewählten Trap-Channel.</p>
                </div>
                <Switch active={settings.enabled} onClick={() => patch('enabled', !settings.enabled)} />
              </div>

              <div className="form-grid">
                <label>
                  <span>Honeypot-Channel-ID</span>
                  <input value={settings.channelId} onChange={(e) => patch('channelId', e.target.value.replace(/D/g, ''))} placeholder="z. B. 123456789012345678" inputMode="numeric" />
                </label>
                <label>
                  <span>Log-Channel-ID</span>
                  <input value={settings.logChannelId} onChange={(e) => patch('logChannelId', e.target.value.replace(/D/g, ''))} placeholder="Optional" inputMode="numeric" />
                </label>
              </div>

              <div className="form-grid">
                <label>
                  <span>Bestrafung</span>
                  <select value={settings.punishment} onChange={(e) => patch('punishment', e.target.value)}>
                    <option value="none">Nur protokollieren</option>
                    <option value="kick">Kick</option>
                    <option value="ban">Ban</option>
                    <option value="timeout">Timeout</option>
                  </select>
                </label>
                <label>
                  <span>Timeout in Minuten</span>
                  <input type="number" min="1" max="40320" value={settings.timeoutMinutes} disabled={settings.punishment !== 'timeout'} onChange={(e) => patch('timeoutMinutes', Math.max(1, Math.min(40320, Number(e.target.value) || 10)))} />
                </label>
              </div>

              <div className="form-grid">
                <label className="check-option"><input type="checkbox" checked={settings.deleteMessage} onChange={(e) => patch('deleteMessage', e.target.checked)} /><span>Getriggerte Nachricht löschen</span></label>
                <label className="check-option"><input type="checkbox" checked={settings.ignoreAdmins} onChange={(e) => patch('ignoreAdmins', e.target.checked)} /><span>Administratoren ignorieren</span></label>
              </div>

              <label className="form-field">
                <span>Ausnahmerollen</span>
                <input value={(settings.exemptRoleIds || []).join(', ')} onChange={(e) => setRoles(e.target.value)} placeholder="Rollen-IDs, getrennt durch Komma" />
              </label>
              <p className="field-hint">Bots und Webhooks werden immer ignoriert. Ein Treffer enthält keine Nachrichteninhalte in der Datenbank, sondern nur Metadaten und den Nachrichten-Link.</p>
            </article>

            <article className="surface-card settings-card">
              <div className="card-header">
                <div><span className="section-kicker">HISTORY</span><h3>Letzte Honeypot-Treffer</h3></div>
                <span className="soft-badge">{hitCount} geladen</span>
              </div>

              {events.length ? (
                <div className="server-list">
                  {events.map((event) => (
                    <div className="server-row" key={event.id}>
                      <span className="server-icon fallback">🍯</span>
                      <div className="server-details">
                        <strong>{event.username || event.user_id}</strong>
                        <span>{formatDate(event.created_at)} · <code>{event.user_id}</code></span>
                      </div>
                      <div className="server-details">
                        <strong>{event.punishment === 'none' ? 'Nur Log' : event.punishment}</strong>
                        <span>{event.punishment_success ? 'erfolgreich' : event.error || 'nicht ausgeführt'}</span>
                      </div>
                      {event.message_url ? <a className="row-arrow" href={event.message_url} target="_blank" rel="noreferrer">→</a> : <span className="row-arrow">—</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state"><strong>Noch keine Treffer</strong><span>Der Honeypot hat bisher keine Treffer erkannt.</span></div>
              )}
            </article>
          </div>

          <aside className="settings-aside">
            <div className="surface-card sticky-card">
              <span className="section-kicker">STATUS</span>
              <h3>{settings.enabled ? 'Aktiv' : 'Deaktiviert'}</h3>
              <p>Der Trap-Channel bleibt im Hintergrund. Nur Aktionen von nicht ausgenommenen Benutzern werden verarbeitet.</p>
              <div className="server-summary">
                <div><span>Trap-Channel</span><strong>{settings.channelId || '—'}</strong></div>
                <div><span>Log-Channel</span><strong>{settings.logChannelId || 'Keiner'}</strong></div>
                <div><span>Bestrafung</span><strong>{settings.punishment}</strong></div>
              </div>
              <div className="aside-divider" />
              <a className="aside-link" href="/settings"><span><strong>Weitere Einstellungen</strong><small>Welcome, Verify, Tickets und Status</small></span><span>→</span></a>
            </div>
          </aside>
        </section>

        <footer className="save-bar">
          <span>Server-ID: {guild?.guild_id}</span>
          <button className="button-primary" onClick={save} disabled={busy}>{busy ? 'Speichere…' : 'Honeypot speichern'}</button>
        </footer>
      </div>
    </DashboardShell>
  );
}
