'use client';

import Link from 'next/link';

function Icon({ name }) {
  const paths = {
    overview: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    embed: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm0 5h10M7 13h6M7 17h4',
    settings: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.42 1.42M16.94 16.94l1.42 1.42M18.36 5.64l-1.42 1.42M7.06 16.94l-1.42 1.42M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    server: 'M4 5h16v5H4zM4 14h16v5H4zM7 7.5h.01M7 16.5h.01',
    pulse: 'M3 12h4l2-6 4 12 2-6h6',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    logout: 'M10 4H5v16h5M14 8l4 4-4 4M8 12h10'
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export default function DashboardShell({ active, guild, children }) {
  async function logout() {
    await fetch('/api/dashboard/logout', { method: 'POST' });
    window.location.replace('/');
  }

  const guildName = guild?.name || 'BWW Server';
  const initial = guildName.slice(0, 1).toUpperCase();

  return (
    <main className="dashboard-app">
      <div className="app-shell">
        <aside className="app-sidebar">
          <Link className="app-brand" href="/dashboard">
            <span className="brand-mark">B</span>
            <span className="brand-wordmark"><strong>BWW</strong><small>COMMAND CENTER</small></span>
          </Link>

          <div className="sidebar-section">
            <span className="sidebar-label">Workspace</span>
            <nav className="sidebar-nav" aria-label="Hauptnavigation">
              <Link className={'nav-link ' + (active === 'dashboard' ? 'active' : '')} href="/dashboard"><Icon name="overview" /><span>Übersicht</span></Link>
              <Link className={'nav-link ' + (active === 'embeds' ? 'active' : '')} href="/embeds"><Icon name="embed" /><span>Embeds V2</span></Link>
              <Link className={'nav-link ' + (active === 'settings' ? 'active' : '')} href="/settings"><Icon name="settings" /><span>Einstellungen</span></Link>
            </nav>
          </div>

          <div className="sidebar-section sidebar-secondary">
            <span className="sidebar-label">System</span>
            <nav className="sidebar-nav">
              <Link className="nav-link" href="/dashboard#servers"><Icon name="server" /><span>Server</span></Link>
              <Link className="nav-link" href="/dashboard#status"><Icon name="pulse" /><span>Bot-Status</span></Link>
            </nav>
          </div>

          <div className="sidebar-spacer" />

          <div className="workspace-card">
            <span className="workspace-avatar">{initial}</span>
            <div><strong>{guildName}</strong><small>Admin Session aktiv</small></div>
            <span className="online-dot" />
          </div>

          <button className="logout-button" onClick={logout}><Icon name="logout" /><span>Abmelden</span></button>
        </aside>

        <section className="app-content">
          <header className="mobile-header">
            <Link className="app-brand" href="/dashboard">
              <span className="brand-mark">B</span>
              <span className="brand-wordmark"><strong>BWW</strong><small>COMMAND CENTER</small></span>
            </Link>
            <span className="mobile-status"><span className="online-dot" />Online</span>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
