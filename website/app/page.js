async function loadJson(path) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  try {
    const response = await fetch(
      `${url.replace(/\/$/, '')}/rest/v1/${path}`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        },
        next: { revalidate: 15 }
      }
    );

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat('de-DE').format(Number(value) || 0);
}

function formatUptime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days) return `${days}T ${hours}Std`;
  if (hours) return `${hours}Std ${minutes}Min`;
  return `${minutes}Min`;
}

function getStatus(status) {
  if (status === 'online') return { label: 'Online', className: 'online' };
  if (status === 'maintenance') return { label: 'Wartung', className: 'maintenance' };
  return { label: 'Offline', className: 'offline' };
}

export default async function Home() {
  const [statusRows, guildRows] = await Promise.all([
    loadJson('bw_bot_status?select=*&id=eq.primary&limit=1'),
    loadJson('bw_guilds?select=guild_id,name,member_count,icon_url,updated_at&order=name.asc')
  ]);

  const status = statusRows?.[0] ?? null;
  const guilds = Array.isArray(guildRows) ? guildRows : [];
  const botStatus = getStatus(status?.status);
  const serverCount = Number(status?.guild_count ?? guilds.length) || 0;
  const memberCount = Number(status?.member_count) || 0;
  const ping = Number(status?.ping_ms);

  return (
    <main className="site-shell">
      <nav className="topbar">
        <a className="brand" href="/" aria-label="BWW Dashboard Startseite">
          <span className="brand-mark">B</span>
          <span>
            <strong>BWW</strong>
            <small>COMMAND CENTER</small>
          </span>
        </a>

        <a className="topbar-link" href="/settings">Einstellungen</a>
        <div className="nav-status">
          <span className={`status-indicator ${botStatus.className}`} />
          <span>{botStatus.label}</span>
          <span className="nav-separator" />
          <span className="live-label">LIVE</span>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="pulse" />
            DISCORD INFRASTRUCTURE
          </div>
          <h1>Alles im Blick.</h1>
          <p>
            Das zentrale BWW Dashboard für Bot-Status, Performance und
            verbundene Discord-Server.
          </p>

          <div className="hero-actions">
            <a className="primary-button" href="#servers">
              Server ansehen
              <span>↓</span>
            </a>
            <span className="refresh-note">
              Automatische Aktualisierung · 15 Sek.
            </span>
          </div>
        </div>

        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="core">
            <span>BWW</span>
            <small>ONLINE</small>
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="Bot Statistiken">
        <article className="metric-card featured">
          <div className="metric-icon">◎</div>
          <div className="metric-content">
            <span>Bot Status</span>
            <strong>{botStatus.label}</strong>
            <small>Aktueller Verbindungsstatus</small>
          </div>
          <span className={`metric-dot ${botStatus.className}`} />
        </article>

        <article className="metric-card">
          <div className="metric-icon">◈</div>
          <div className="metric-content">
            <span>Discord Server</span>
            <strong>{formatNumber(serverCount)}</strong>
            <small>Verbundene Guilds</small>
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-icon">♙</div>
          <div className="metric-content">
            <span>Mitglieder</span>
            <strong>{formatNumber(memberCount)}</strong>
            <small>Über alle Server</small>
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-icon">↯</div>
          <div className="metric-content">
            <span>Ping</span>
            <strong>{Number.isFinite(ping) && ping >= 0 ? `${ping}<em>ms</em>` : '—'}</strong>
            <small>WebSocket Latenz</small>
          </div>
        </article>
      </section>

      <section className="content-grid">
        <article className="server-panel" id="servers">
          <div className="section-heading">
            <div>
              <span className="section-label">DISCORD NETWORK</span>
              <h2>Verbundene Server</h2>
            </div>
            <span className="count-badge">{formatNumber(guilds.length)} Server</span>
          </div>

          {guilds.length ? (
            <div className="server-list">
              {guilds.map((guild, index) => (
                <article className="server-row" key={guild.guild_id}>
                  <span className="server-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  {guild.icon_url ? (
                    <img
                      className="server-icon"
                      src={guild.icon_url}
                      alt=""
                      width="52"
                      height="52"
                    />
                  ) : (
                    <div className="server-icon fallback">
                      {(guild.name || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  <div className="server-info">
                    <strong>{guild.name || 'Unbenannter Server'}</strong>
                    <span>
                      {formatNumber(guild.member_count)} Mitglieder
                    </span>
                  </div>

                  <div className="server-meta">
                    <span className="server-online-dot" />
                    <span>Verbunden</span>
                  </div>

                  <span className="server-arrow">↗</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>◌</span>
              <strong>Noch keine Serverdaten</strong>
              <p>Der Bot hat bisher keine Guild-Daten an das Dashboard übertragen.</p>
            </div>
          )}
        </article>

        <aside className="side-stack">
          <article className="info-card uptime-card">
            <div className="section-heading compact">
              <div>
                <span className="section-label">SYSTEM</span>
                <h3>Uptime</h3>
              </div>
              <span className="mini-icon">◷</span>
            </div>
            <strong className="uptime-value">
              {formatUptime(status?.uptime_seconds)}
            </strong>
            <div className="uptime-line">
              <span />
            </div>
            <p>Seit dem letzten erfolgreichen Bot-Start.</p>
          </article>

          <article className="info-card">
            <div className="section-heading compact">
              <div>
                <span className="section-label">BOT IDENTITÄT</span>
                <h3>{status?.bot_tag || 'BWW Bot'}</h3>
              </div>
              <span className={`identity-badge ${botStatus.className}`}>●</span>
            </div>
            <div className="info-list">
              <div><span>Status</span><strong>{botStatus.label}</strong></div>
              <div><span>Server</span><strong>{formatNumber(serverCount)}</strong></div>
              <div><span>Mitglieder</span><strong>{formatNumber(memberCount)}</strong></div>
            </div>
          </article>
        </aside>
      </section>

      <footer className="footer">
        <div className="footer-brand">
          <span className="brand-mark small">B</span>
          <span>BWW Dashboard</span>
        </div>
        <span>Live-Daten aus Supabase · Aktualisierung alle 15 Sekunden</span>
        <span>© {new Date().getFullYear()} BWW</span>
      </footer>
    </main>
  );
}
