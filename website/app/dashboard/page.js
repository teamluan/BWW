'use client';

import { useEffect, useState } from 'react';

function formatNumber(value) {
  return new Intl.NumberFormat('de-DE').format(Number(value) || 0);
}

function formatUptime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days) return days + 'T ' + hours + 'Std';
  if (hours) return hours + 'Std ' + minutes + 'Min';
  return minutes + 'Min';
}

function statusMeta(status) {
  if (status === 'online') return { label: 'Online', className: 'online' };
  if (status === 'maintenance') return { label: 'Wartung', className: 'maintenance' };
  return { label: 'Offline', className: 'offline' };
}

function Icon({ name }) {
  const paths = {
    grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    server: 'M4 5h16v5H4zM4 14h16v5H4zM7 7.5h.01M7 16.5h.01',
    settings: 'M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm0-5v2.1m0 13.4v2.1M3.6 12H1.5m21 0h-2.1M5.9 5.9l1.5 1.5m9.2 9.2 1.5 1.5M18.1 5.9l-1.5 1.5m-9.2 9.2-1.5 1.5',
    shield: 'M12 3 5 6v5c0 4.6 2.9 8.7 7 10 4.1-1.3 7-5.4 7-10V6l-7-3Zm-3 8 2 2 4-4',
    logout: 'M10 4H5v16h5M14 8l4 4-4 4M8 12h10',
    pulse: 'M3 12h4l2-6 4 12 2-6h6'
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export default function DashboardPage() {
  const [mode, setMode] = useState('loading');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const response = await fetch('/api/dashboard/overview', { cache: 'no-store' });
    const json = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.replace('/');
      return;
    }
    if (!response.ok) throw new Error(json.error || 'Dashboard konnte nicht geladen werden.');
    setData(json);
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

  async function logout() {
    await fetch('/api/dashboard/logout', { method: 'POST' });
    window.location.replace('/');
  }

  if (mode === 'loading') return <main className="dashboard-app"><div className="page-loading"><span className="brand-icon">B</span><span>Dashboard wird geladen…</span></div></main>;

  if (mode === 'error') {
    return <main className="dashboard-app"><div className="error-panel"><span className="eyebrow">BWW COMMAND CENTER</span><h1>Dashboard nicht verfügbar</h1><p>{error}</p><button className="button-primary" onClick={() => window.location.reload()}>Erneut versuchen</button></div></main>;
  }

  const status = statusMeta(data.status?.status);
  const ping = Number(data.status?.ping_ms);
  const guilds = data.guilds || [];
  const serverCount = Number(data.status?.guild_count ?? guilds.length) || 0;
  const memberCount = Number(data.status?.member_count) || 0;

  return (
    <main className="dashboard-app">
      <div className="dashboard-frame">
        <aside className="sidebar">
          <a className="sidebar-brand" href="/dashboard"><span className="brand-icon">B</span><span><strong>BWW</strong><small>COMMAND CENTER</small></span></a>
          <nav className="sidebar-nav" aria-label="Dashboard">
            <span className="nav-group-label">ÜBERSICHT</span>
            <a className="sidebar-link active" href="/dashboard"><Icon name="grid" /><span>Dashboard</span></a>
            <a className="sidebar-link" href="/settings"><Icon name="settings" /><span>Einstellungen</span></a>
            <span className="nav-group-label spaced">SYSTEM</span>
            <a className="sidebar-link" href="#servers"><Icon name="server" /><span>Server</span></a>
            <a className="sidebar-link" href="#status"><Icon name="pulse" /><span>Bot-Status</span></a>
          </nav>
          <div className="sidebar-bottom">
            <div className="access-chip"><span className="status-indicator online" /><div><strong>Admin Session</strong><small>Geschützt aktiv</small></div></div>
            <button className="sidebar-logout" onClick={logout}><Icon name="logout" /><span>Abmelden</span></button>
          </div>
        </aside>

        <section className="dashboard-main">
          <header className="dashboard-topbar">
            <div><span className="eyebrow">BWW / COMMAND CENTER</span><h1>Dashboard</h1></div>
            <div className="top-actions"><span className="live-pill"><i className={'status-dot ' + status.className} />{status.label}</span><a className="button-secondary" href="/settings">Einstellungen</a><button className="avatar-button" aria-label="Abmelden" onClick={logout}>B</button></div>
          </header>

          <section className="dashboard-hero">
            <div><div className="hero-label"><i /> SYSTEM OVERVIEW</div><h2>Guten Tag.</h2><p>Hier siehst du den aktuellen Zustand deiner BWW-Infrastruktur.</p></div>
            <div className="hero-status"><span className={'status-orb ' + status.className} /><div><strong>{status.label}</strong><small>{data.status?.bot_tag || 'BWW Bot'}</small></div></div>
          </section>

          <section className="stat-grid" id="status">
            <article className="stat-card accent"><span className="stat-icon"><Icon name="pulse" /></span><div><span className="stat-label">Bot Status</span><strong>{status.label}</strong><small>Live-Verbindung</small></div></article>
            <article className="stat-card"><span className="stat-icon"><Icon name="server" /></span><div><span className="stat-label">Discord Server</span><strong>{formatNumber(serverCount)}</strong><small>Verbundene Guilds</small></div></article>
            <article className="stat-card"><span className="stat-icon"><Icon name="shield" /></span><div><span className="stat-label">Mitglieder</span><strong>{formatNumber(memberCount)}</strong><small>Gesamtzahl</small></div></article>
            <article className="stat-card"><span className="stat-icon"><Icon name="pulse" /></span><div><span className="stat-label">Ping</span><strong>{Number.isFinite(ping) && ping >= 0 ? ping + 'ms' : '—'}</strong><small>WebSocket Latenz</small></div></article>
          </section>

          <section className="dashboard-columns">
            <article className="panel" id="servers">
              <div className="panel-head"><div><span className="eyebrow">DISCORD NETWORK</span><h3>Verbundene Server</h3></div><span className="count-pill">{formatNumber(guilds.length)} Server</span></div>
              {guilds.length ? (
                <div className="server-table">
                  {guilds.map((guild, index) => (
                    <div className="server-item" key={guild.guild_id}>
                      <span className="server-index">{String(index + 1).padStart(2, '0')}</span>
                      {guild.icon_url ? <img src={guild.icon_url} alt="" className="server-avatar" width="48" height="48" /> : <span className="server-avatar fallback">{(guild.name || '?').slice(0, 1).toUpperCase()}</span>}
                      <div className="server-copy"><strong>{guild.name || 'Unbenannter Server'}</strong><small>{formatNumber(guild.member_count)} Mitglieder</small></div>
                      <span className="connected"><i />Verbunden</span><span className="row-arrow">→</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-panel"><span>◎</span><strong>Noch keine Serverdaten</strong><p>Der Bot hat noch keine Guild-Daten übertragen.</p></div>
              )}
            </article>

            <div className="side-panels">
              <article className="panel compact-panel"><div className="panel-head"><div><span className="eyebrow">SYSTEM</span><h3>Uptime</h3></div><span className="panel-mini">◷</span></div><strong className="uptime-big">{formatUptime(data.status?.uptime_seconds)}</strong><div className="progress"><i /></div><p>Seit dem letzten erfolgreichen Bot-Start.</p></article>
              <article className="panel compact-panel"><div className="panel-head"><div><span className="eyebrow">SERVER</span><h3>{data.server?.name || 'BWW Server'}</h3></div><span className="server-badge">{formatNumber(data.server?.member_count)} Mitglieder</span></div><div className="mini-stats"><div><span>Status</span><strong>{status.label}</strong></div><div><span>Bot</span><strong>{data.status?.bot_tag || 'BWW'}</strong></div><div><span>Aktualisierung</span><strong>15 Sek.</strong></div></div></article>
            </div>
          </section>

          <footer className="dashboard-footer"><span>BWW Command Center</span><span>Live-Daten aus Supabase · automatische Aktualisierung</span><span>{new Date().getFullYear()}</span></footer>
        </section>
      </div>
    </main>
  );
}
