'use client';

import { useEffect, useState } from 'react';
import DashboardShell from '../../components/dashboard-shell';

const EMPTY = {
  prize: '',
  durationMinutes: 60,
  winnerCount: 1,
  requiredRoleId: '',
  minAccountAgeDays: 0,
  minServerAgeDays: 0,
  bonusRoleId: '',
  bonusEntries: 0
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

function statusMeta(status) {
  if (status === 'active') return { label: 'Aktiv', className: 'online' };
  if (status === 'ended') return { label: 'Beendet', className: 'maintenance' };
  return { label: 'Abgebrochen', className: 'offline' };
}

export default function GiveawaysPage() {
  const [mode, setMode] = useState('loading');
  const [guild, setGuild] = useState(null);
  const [giveaways, setGiveaways] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [channelId, setChannelId] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function load(showLoading = false) {
    if (showLoading) setMode('loading');
    const response = await fetch('/api/dashboard/giveaways', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.replace('/');
      return;
    }
    if (!response.ok) throw new Error(data.error || 'Giveaways konnten nicht geladen werden.');
    setGuild(data.guild);
    setGiveaways(Array.isArray(data.giveaways) ? data.giveaways : []);
    setMode('ready');
  }

  useEffect(() => {
    load(true).catch((err) => {
      setError(err.message || 'Giveaways konnten nicht geladen werden.');
      setMode('error');
    });
    const timer = setInterval(() => load(false).catch(() => {}), 5000);
    return () => clearInterval(timer);
  }, []);

  function patch(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError('');
  }

  async function create() {
    setBusy(true);
    setSaved(false);
    setError('');
    try {
      const response = await fetch('/api/dashboard/giveaways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, giveaway: form })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Giveaway konnte nicht erstellt werden.');
      setSaved(true);
      setForm(EMPTY);
      setChannelId('');
      setTimeout(() => load(false).catch(() => {}), 1000);
    } catch (err) {
      setError(err.message || 'Giveaway konnte nicht erstellt werden.');
    } finally {
      setBusy(false);
    }
  }

  async function manage(id, action) {
    setActionBusy(id + ':' + action);
    setError('');
    try {
      const response = await fetch('/api/dashboard/giveaways', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Aktion fehlgeschlagen.');
      setSaved(true);
      setTimeout(() => load(false).catch(() => {}), 800);
    } catch (err) {
      setError(err.message || 'Aktion fehlgeschlagen.');
    } finally {
      setActionBusy('');
    }
  }

  if (mode === 'loading') return <main className="dashboard-app"><div className="page-loading">Giveaways werden geladen…</div></main>;
  if (mode === 'error') return <main className="dashboard-app"><div className="error-panel"><span className="page-kicker">BWW EVENTS</span><h1>Giveaways nicht verfügbar</h1><p>{error}</p><a className="button-secondary" href="/dashboard">Zur Übersicht</a></div></main>;

  return (
    <DashboardShell active="giveaways" guild={guild}>
      <div className="page">
        <header className="page-header">
          <div>
            <div className="breadcrumb">BWW <span>/</span> Giveaways</div>
            <h1>Giveaways</h1>
            <p>Erstelle und verwalte zeitgesteuerte Gewinnspiele zentral über den BWW Bot.</p>
          </div>
          <div className="header-meta"><span className="server-context">{guild?.name || 'BWW Server'}</span></div>
        </header>

        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert success">Aktion wurde an den Bot übergeben.</div>}

        <section className="settings-layout">
          <div className="settings-main">
            <article className="surface-card settings-card">
              <div className="settings-heading">
                <div>
                  <span className="section-kicker">CREATE</span>
                  <h2>Neues Giveaway</h2>
                  <p>Das Giveaway wird vom Bot im angegebenen Channel erstellt und läuft auch nach einem Neustart weiter.</p>
                </div>
              </div>

              <div className="form-grid">
                <label><span>Preis</span><input value={form.prize} onChange={(e) => patch('prize', e.target.value)} placeholder="z. B. 1 Monat Nitro" maxLength={256} /></label>
                <label><span>Channel-ID</span><input value={channelId} onChange={(e) => setChannelId(e.target.value.replace(/\D/g, ''))} placeholder="Discord Channel-ID" inputMode="numeric" /></label>
              </div>

              <div className="form-grid">
                <label><span>Dauer in Minuten</span><input type="number" min="1" max="43200" value={form.durationMinutes} onChange={(e) => patch('durationMinutes', Math.max(1, Math.min(43200, Number(e.target.value) || 1)))} /></label>
                <label><span>Gewinner</span><input type="number" min="1" max="100" value={form.winnerCount} onChange={(e) => patch('winnerCount', Math.max(1, Math.min(100, Number(e.target.value) || 1)))} /></label>
              </div>

              <div className="form-grid">
                <label><span>Pflichtrolle</span><input value={form.requiredRoleId} onChange={(e) => patch('requiredRoleId', e.target.value.replace(/\D/g, ''))} placeholder="Optional" inputMode="numeric" /></label>
                <label><span>Bonusrolle</span><input value={form.bonusRoleId} onChange={(e) => patch('bonusRoleId', e.target.value.replace(/\D/g, ''))} placeholder="Optional" inputMode="numeric" /></label>
              </div>

              <div className="form-grid">
                <label><span>Mindest-Accountalter (Tage)</span><input type="number" min="0" max="3650" value={form.minAccountAgeDays} onChange={(e) => patch('minAccountAgeDays', Math.max(0, Math.min(3650, Number(e.target.value) || 0)))} /></label>
                <label><span>Mindest-Serveralter (Tage)</span><input type="number" min="0" max="3650" value={form.minServerAgeDays} onChange={(e) => patch('minServerAgeDays', Math.max(0, Math.min(3650, Number(e.target.value) || 0)))} /></label>
              </div>

              <label className="form-field"><span>Bonus-Gewinnchancen</span><input type="number" min="0" max="20" value={form.bonusEntries} onChange={(e) => patch('bonusEntries', Math.max(0, Math.min(20, Number(e.target.value) || 0)))} /></label>
              <p className="field-hint">Teilnehmer mit der Bonusrolle erhalten 1 + Bonus-Gewinnchance(n). Ein Benutzer kann nur einmal teilnehmen.</p>

              <div className="builder-actions">
                <button className="button-primary" onClick={create} disabled={busy}>{busy ? 'Erstelle…' : 'Giveaway erstellen'}</button>
              </div>
            </article>

            <article className="surface-card settings-card">
              <div className="card-header">
                <div><span className="section-kicker">HISTORY</span><h3>Giveaways</h3></div>
                <span className="soft-badge">{giveaways.length} geladen</span>
              </div>

              {giveaways.length ? (
                <div className="server-list">
                  {giveaways.map((giveaway) => {
                    const status = statusMeta(giveaway.status);
                    const busyKey = (action) => actionBusy === giveaway.id + ':' + action;
                    return (
                      <div className="server-row" key={giveaway.id}>
                        <span className={'server-icon fallback ' + status.className}>🎉</span>
                        <div className="server-details">
                          <strong>{giveaway.prize}</strong>
                          <span>{formatDate(giveaway.end_at)} · {giveaway.entry_count || 0} Teilnehmer · ID <code>{giveaway.id}</code></span>
                        </div>
                        <span className={'soft-badge badge-' + status.className}>{status.label}</span>
                        <div className="component-actions">
                          {giveaway.status === 'active' && <>
                            <button onClick={() => manage(giveaway.id, 'end')} disabled={Boolean(actionBusy)} title="Sofort beenden">{busyKey('end') ? '…' : 'Ende'}</button>
                            <button className="danger" onClick={() => manage(giveaway.id, 'cancel')} disabled={Boolean(actionBusy)} title="Abbrechen">{busyKey('cancel') ? '…' : 'X'}</button>
                          </>}
                          {giveaway.status === 'ended' && <button onClick={() => manage(giveaway.id, 'reroll')} disabled={Boolean(actionBusy)} title="Reroll">{busyKey('reroll') ? '…' : 'Reroll'}</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state"><strong>Noch keine Giveaways</strong><span>Erstelle das erste Giveaway über das Formular.</span></div>
              )}
            </article>
          </div>

          <aside className="settings-aside">
            <div className="surface-card sticky-card">
              <span className="section-kicker">SYSTEM</span>
              <h3>Giveaway Engine</h3>
              <p>Persistente Teilnehmer, gewichtete Gewinnchancen und automatische Finalisierung laufen im Bot-Worker.</p>
              <div className="server-summary">
                <div><span>Max. Dauer</span><strong>30 Tage</strong></div>
                <div><span>Max. Gewinner</span><strong>100</strong></div>
                <div><span>Rerolls</span><strong>ohne festes Limit</strong></div>
              </div>
              <div className="aside-divider" />
              <a className="aside-link" href="/dashboard"><span><strong>Übersicht</strong><small>Bot-Status und Server</small></span><span>→</span></a>
            </div>
          </aside>
        </section>

        <footer className="save-bar">
          <span>Server-ID: {guild?.guild_id}</span>
          <span>Automatische Aktualisierung alle 5 Sekunden</span>
        </footer>
      </div>
    </DashboardShell>
  );
}
