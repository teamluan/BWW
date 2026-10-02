'use client';

import { useEffect, useState } from 'react';
import DashboardShell from '../../components/dashboard-shell';

function formatNumber(value) {
  return new Intl.NumberFormat('de-DE').format(Number(value) || 0);
}

function formatUptime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days) return days + ' T ' + hours + ' Std';
  if (hours) return hours + ' Std ' + minutes + ' Min';
  return minutes + ' Min';
}

function statusMeta(status) {
  if (status === 'online') return { label: 'Online', className: 'online' };
  if (status === 'maintenance') return { label: 'Wartung', className: 'maintenance' };
  return { label: 'Offline', className: 'offline' };
}

function Metric({ label, value, hint, icon, positive }) {
  return (
    <article className="metric-card">
      <div className={'metric-icon ' + (positive ? 'positive' : '')}>{icon}</div>
      <div className="metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  );
}

function Icon({ name }) {
  const paths = {
    server: 'M4 5h16v5H4zM4 14h16v5H4zM7 7.5h.01M7 16.5h.01',
    users: 'M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 18.5V20M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-1a3 3 0 1 0 0-6M17 14h.5A3.5 3.5 0 0 1 21 17.5V20',
    pulse: 'M3 12h4l2-6 4 12 2-6h6',
    clock: 'M12 7v5l3 2M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
    arrow: 'M5 12h14M13 6l6 6-6 6'
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export default function DashboardPage() {
  const [mode, setMode] = useState('loading');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  async function load() {
    const response = await fetch('/api/dashboard/overview', { cache: 'no-store' });
    const json = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.replace('/');
      return;
    }
    if (!response.ok) throw new Error(json.error || 'Dashboard konnte nicht geladen werden.');
    setData(json);
    setUpdatedAt(new Date());
    setMode('ready');
  }

  useEffect(() => {
    load().catch((err) => {
      setError(err.message || 'Dashboard konnte nicht geladen werden.');
      setMode('error');
    });
    const timer = setInterval(() => load().catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, []);

  if (mode === 'loading') return <main className="dashboard-app"><div className="page-loading">Dashboard wird geladen…</div></main>;

  if (mode === 'error') {
    return <main className="dashboard-app"><div className="error-panel"><span className="page-kicker">BWW COMMAND CENTER</span><h1>Dashboard nicht verfügbar</h1><p>{error}</p><button className="button-primary" onClick={() => window.location.reload()}>Erneut versuchen</button></div></main>;
  }

  const status = statusMeta(data.status?.status);
  const ping = Number(data.status?.ping_ms);
  const guilds = data.guilds || [];
  const serverCount = Number(data.status?.guild_count ?? guilds.length) || 0;
  const memberCount = Number(data.status?.member_count) || 0;

  return (
    <DashboardShell active="dashboard" guild={data.server}>
      <div className="page">
        <header className="page-header">
          <div>
            <div className="breadcrumb">BWW <span>/</span> Übersicht</div>
            <h1>Dashboard</h1>
            <p>Ein kompakter Überblick über deinen Bot und deine verbundenen Discord-Server.</p>
          </div>
          <div className="header-meta">
            <div className="live-status"><span className={'status-dot ' + status.className} />{status.label}</div>
            <span className="updated-label">{updatedAt ? 'Aktualisiert ' + updatedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'Live'}</span>
          </div>
        </header>

        <section className="welcome-row">
          <div>
            <span className="section-kicker">SYSTEMÜBERSICHT</span>
            <h2>Alles im Blick.</h2>
            <p>{data.status?.bot_tag || 'BWW Bot'} ist mit deiner Discord-Infrastruktur verbunden.</p>
          </div>
          <div className="welcome-status">
            <span className={'large-status-dot ' + status.className} />
            <div><strong>{status.label}</strong><span>{ping >= 0 && Number.isFinite(ping) ? ping + ' ms Latenz' : 'Keine Latenzdaten'}</span></div>
          </div>
        </section>

        <section className="metric-grid">
          <Metric label="Bot Status" value={status.label} hint="Aktuelle Verbindung" icon={<Icon name="pulse" />} positive={status.className === 'online'} />
          <Metric label="Discord Server" value={formatNumber(serverCount)} hint="Verbundene Guilds" icon={<Icon name="server" />} />
          <Metric label="Mitglieder" value={formatNumber(memberCount)} hint="Über alle Server" icon={<Icon name="users" />} />
          <Metric label="Uptime" value={formatUptime(data.status?.uptime_seconds)} hint="Seit letztem Start" icon={<Icon name="clock" />} />
        </section>

        <section className="content-grid">
          <article className="surface-card server-card" id="servers">
            <div className="card-header">
              <div><span className="section-kicker">DISCORD</span><h3>Verbundene Server</h3></div>
              <span className="soft-badge">{formatNumber(guilds.length)} Server</span>
            </div>
            {guilds.length ? (
              <div className="server-list">
                {guilds.map((guild) => (
                  <div className="server-row" key={guild.guild_id}>
                    {guild.icon_url ? <img src={guild.icon_url} alt="" className="server-icon" width="44" height="44" /> : <span className="server-icon fallback">{(guild.name || '?').slice(0, 1).toUpperCase()}</span>}
                    <div className="server-details"><strong>{guild.name || 'Unbenannter Server'}</strong><span>{formatNumber(guild.member_count)} Mitglieder</span></div>
                    <span className="connected-state"><i />Verbunden</span>
                    <span className="row-arrow"><Icon name="arrow" /></span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state"><strong>Keine Serverdaten</strong><span>Der Bot hat noch keine Guild-Daten übertragen.</span></div>
            )}
          </article>

          <div className="stack">
            <article className="surface-card" id="status">
              <div className="card-header"><div><span className="section-kicker">STATUS</span><h3>Systemstatus</h3></div><span className={'soft-badge badge-' + status.className}>{status.label}</span></div>
              <div className="status-list">
                <div><span>Bot</span><strong>{data.status?.bot_tag || 'BWW'}</strong></div>
                <div><span>WebSocket Ping</span><strong>{ping >= 0 && Number.isFinite(ping) ? ping + ' ms' : '—'}</strong></div>
                <div><span>Uptime</span><strong>{formatUptime(data.status?.uptime_seconds)}</strong></div>
                <div><span>Auto-Update</span><strong>15 Sekunden</strong></div>
              </div>
            </article>

            <article className="surface-card">
              <div className="card-header"><div><span className="section-kicker">SCHNELLZUGRIFF</span><h3>Verwalten</h3></div></div>
              <div className="quick-actions">
                <a href="/embeds"><span><strong>Embeds V2</strong><small>Nachrichten erstellen und senden</small></span><Icon name="arrow" /></a>
                <a href="/honeypot"><span><strong>Honeypot</strong><small>Trap-Channel und Treffer verwalten</small></span><Icon name="arrow" /></a>
                <a href="/giveaways"><span><strong>Giveaways</strong><small>Gewinnspiele erstellen und verwalten</small></span><Icon name="arrow" /></a>
                <a href="/settings"><span><strong>Einstellungen</strong><small>Bot und Server konfigurieren</small></span><Icon name="arrow" /></a>
              </div>
            </article>
          </div>
        </section>

        <footer className="page-footer"><span>BWW Command Center</span><span>Live-Daten aus Supabase</span></footer>
      </div>
    </DashboardShell>
  );
}
