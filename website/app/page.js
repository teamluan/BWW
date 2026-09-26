async function loadJson(path) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

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
}

function formatNumber(value) {
  return new Intl.NumberFormat('de-DE').format(value ?? 0);
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

export default async function Home() {
  const [statusRows, guildRows] = await Promise.all([
    loadJson('bww_bot_status?select=*&id=eq.primary&limit=1'),
    loadJson('bww_guilds?select=guild_id,name,member_count,icon_url,updated_at&order=name.asc')
  ]);

  const status = statusRows?.[0] ?? null;
  const guilds = Array.isArray(guildRows) ? guildRows : [];
  const online = status?.status === 'online';

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <span className="eyebrow">BWW · DISCORD BOT</span>
          <h1>Control Center</h1>
          <p>Öffentlicher Live-Überblick über den BWW Bot und seine verbundenen Server.</p>
        </div>
        <div className={`status-pill ${online ? 'online' : 'offline'}`}>
          <span className="status-dot" />
          {online ? 'Online' : status?.status === 'maintenance' ? 'Wartung' : 'Offline'}
        </div>
      </header>

      <section className="stats">
        <article className="card">
          <span>Server</span>
          <strong>{formatNumber(status?.guild_count ?? guilds.length)}</strong>
        </article>
        <article className="card">
          <span>Mitglieder</span>
          <strong>{formatNumber(status?.member_count)}</strong>
        </article>
        <article className="card">
          <span>Ping</span>
          <strong>{status?.ping_ms == null ? '—' : `${status.ping_ms} ms`}</strong>
        </article>
        <article className="card">
          <span>Uptime</span>
          <strong>{formatUptime(status?.uptime_seconds)}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">VERBUNDENE SERVER</span>
            <h2>Guilds</h2>
          </div>
          <span className="muted">{guilds.length} Einträge</span>
        </div>

        {guilds.length ? (
          <div className="guild-grid">
            {guilds.map((guild) => (
              <article className="guild" key={guild.guild_id}>
                {guild.icon_url ? (
                  <img src={guild.icon_url} alt="" width="48" height="48" />
                ) : (
                  <div className="guild-icon">{guild.name.slice(0, 1).toUpperCase()}</div>
                )}
                <div>
                  <strong>{guild.name}</strong>
                  <span>{formatNumber(guild.member_count)} Mitglieder</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">Noch keine Daten verfügbar.</div>
        )}
      </section>

      <footer>
        <span>BWW Dashboard</span>
        <span>Aktualisierung alle 15 Sekunden</span>
      </footer>
    </main>
  );
}
