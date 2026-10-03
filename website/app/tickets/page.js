'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardShell from '../../components/dashboard-shell';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

const STATUS = {
  open: { label: 'Offen', className: 'online', icon: '🟢' },
  locked: { label: 'Gesperrt', className: 'maintenance', icon: '🔒' },
  closed: { label: 'Geschlossen', className: 'offline', icon: '✅' }
};

const PRIORITY = {
  low: '🟢 Niedrig',
  normal: '🔵 Normal',
  high: '🟠 Hoch',
  urgent: '🔴 Dringend'
};

export default function TicketsPage() {
  const [mode, setMode] = useState('loading');
  const [guild, setGuild] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');

  async function load(showLoading = false) {
    if (showLoading) setMode('loading');
    const query = filter === 'all' ? '' : '?status=' + encodeURIComponent(filter);
    const response = await fetch('/api/dashboard/tickets' + query, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.replace('/');
      return;
    }
    if (!response.ok) throw new Error(data.error || 'Tickets konnten nicht geladen werden.');
    setGuild(data.guild);
    setTickets(Array.isArray(data.tickets) ? data.tickets : []);
    setMode('ready');
  }

  useEffect(() => {
    load(true).catch((err) => {
      setError(err.message || 'Tickets konnten nicht geladen werden.');
      setMode('error');
    });
  }, [filter]);

  useEffect(() => {
    const timer = setInterval(() => load(false).catch(() => {}), 10000);
    return () => clearInterval(timer);
  }, [filter]);

  async function action(ticketId, actionName, extra = {}) {
    setBusy(ticketId + ':' + actionName);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/dashboard/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticketId, action: actionName, ...extra })
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.replace('/');
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Ticket-Aktion fehlgeschlagen.');
      setNotice('✅ Ticket-Aktion in die Bot-Warteschlange gestellt.');
      await load(false);
    } catch (err) {
      setError(err.message || 'Ticket-Aktion fehlgeschlagen.');
    } finally {
      setBusy('');
    }
  }

  const stats = useMemo(() => ({
    open: tickets.filter((ticket) => ticket.status === 'open').length,
    locked: tickets.filter((ticket) => ticket.status === 'locked').length,
    closed: tickets.filter((ticket) => ticket.status === 'closed').length
  }), [tickets]);

  if (mode === 'loading') return <main className="dashboard-app"><div className="page-loading">Tickets werden geladen…</div></main>;
  if (mode === 'error') return <main className="dashboard-app"><div className="error-panel"><span className="page-kicker">BWW SUPPORT</span><h1>Tickets nicht verfügbar</h1><p>{error}</p><a className="button-secondary" href="/dashboard">Zur Übersicht</a></div></main>;

  return (
    <DashboardShell active="tickets" guild={guild}>
      <div className="page">
        <header className="page-header">
          <div>
            <div className="breadcrumb">BWW <span>/</span> Tickets</div>
            <h1>Tickets</h1>
            <p>Übersicht über Tickets, Zuständigkeiten, Prioritäten und Abschlussdaten.</p>
          </div>
          <div className="header-meta"><span className="server-context">{guild?.name || 'BWW Server'}</span></div>
        </header>

        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}

        <div className="stats-grid">
          <div className="surface-card stat-card"><span className="section-kicker">OFFEN</span><strong>{stats.open}</strong><small>Tickets warten auf Bearbeitung</small></div>
          <div className="surface-card stat-card"><span className="section-kicker">GESPERRT</span><strong>{stats.locked}</strong><small>Aktive Tickets ohne normale Schreibrechte</small></div>
          <div className="surface-card stat-card"><span className="section-kicker">GESCHLOSSEN</span><strong>{stats.closed}</strong><small>Historische Tickets</small></div>
        </div>

        <article className="surface-card settings-card">
          <div className="card-header">
            <div><span className="section-kicker">SUPPORT</span><h3>Ticket-Verlauf</h3></div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="open">Offen</option>
              <option value="locked">Gesperrt</option>
              <option value="closed">Geschlossen</option>
            </select>
          </div>

          {tickets.length ? (
            <div className="server-list">
              {tickets.map((ticket) => {
                const meta = STATUS[ticket.status] || STATUS.closed;
                return (
                  <div className="server-row" key={ticket.id}>
                    <span className={'server-icon fallback ' + meta.className}>{meta.icon}</span>
                    <div className="server-details">
                      <strong>{ticket.reason} <span className="soft-badge">{meta.label}</span></strong>
                      <span><code>{ticket.id}</code> · <code>{ticket.owner_id}</code> · erstellt {formatDate(ticket.created_at)}</span>
                    </div>
                    <div className="server-details">
                      <strong>{PRIORITY[ticket.priority] || PRIORITY.normal}</strong>
                      <span>{ticket.claimed_by ? '👤 ' + ticket.claimed_by : 'Noch nicht übernommen'}</span>
                    </div>
                    <div className="server-details">
                      <strong>{ticket.status === 'closed' ? 'Geschlossen' : 'Letzte Änderung'}</strong>
                      <span>{formatDate(ticket.status === 'closed' ? ticket.closed_at : ticket.updated_at)}</span>
                    </div>
                    <div className="row-actions">
                      {ticket.status === 'closed' ? (
                        <button className="button-secondary" disabled={busy === ticket.id + ':reopen'} onClick={() => action(ticket.id, 'reopen')}>
                          {busy === ticket.id + ':reopen' ? '…' : 'Wieder öffnen'}
                        </button>
                      ) : (
                        <>
                          <button className="button-secondary" disabled={busy === ticket.id + ':claim'} onClick={() => action(ticket.id, 'claim')}>
                            {busy === ticket.id + ':claim' ? '…' : 'Claim'}
                          </button>
                          <button className="button-secondary" disabled={busy === ticket.id + ':lock' || ticket.status === 'locked'} onClick={() => action(ticket.id, 'lock')}>
                            {ticket.status === 'locked' ? 'Gesperrt' : 'Sperren'}
                          </button>
                          {ticket.status === 'locked' && (
                            <button className="button-secondary" disabled={busy === ticket.id + ':unlock'} onClick={() => action(ticket.id, 'unlock')}>Entsperren</button>
                          )}
                          <button className="button-danger" disabled={busy === ticket.id + ':close'} onClick={() => action(ticket.id, 'close')}>
                            {busy === ticket.id + ':close' ? '…' : 'Schließen'}
                          </button>
                        </>
                      )}
                      <select
                        value={ticket.priority || 'normal'}
                        disabled={busy === ticket.id + ':priority'}
                        onChange={(e) => action(ticket.id, 'priority', { priority: e.target.value })}
                        aria-label={'Priorität für ' + ticket.id}
                      >
                        <option value="low">Niedrig</option>
                        <option value="normal">Normal</option>
                        <option value="high">Hoch</option>
                        <option value="urgent">Dringend</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state"><strong>Keine Tickets</strong><span>Für diesen Filter wurden keine Ticket-Datensätze gefunden.</span></div>
          )}
        </article>

        <footer className="save-bar">
          <span>Server-ID: {guild?.guild_id}</span>
          <span>Automatische Aktualisierung alle 10 Sekunden</span>
        </footer>
      </div>
    </DashboardShell>
  );
}
