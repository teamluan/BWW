'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard/settings', { cache: 'no-store' })
      .then(async (response) => {
        if (response.ok) window.location.replace('/dashboard');
        else setStatus('login');
      })
      .catch(() => setStatus('login'));
  }, []);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/dashboard/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Anmeldung fehlgeschlagen.');
      window.location.replace('/dashboard');
    } catch (err) {
      setError(err.message || 'Anmeldung fehlgeschlagen.');
      setBusy(false);
    }
  }

  if (status === 'loading') return <main className="auth-page"><div className="page-loading">Verbindung wird geprüft…</div></main>;

  return (
    <main className="auth-page">
      <section className="auth-layout">
        <div className="auth-intro">
          <a className="app-brand" href="/">
            <span className="brand-mark">B</span>
            <span className="brand-wordmark"><strong>BWW</strong><small>COMMAND CENTER</small></span>
          </a>
          <span className="section-kicker">ADMINISTRATOR PORTAL</span>
          <h1>Zentrale Kontrolle für deinen BWW Bot.</h1>
          <p>Verwalte Server-Einstellungen, Components V2 und den aktuellen Systemstatus in einer einzigen Oberfläche.</p>
          <div className="auth-feature-row"><span className="auth-feature-dot" /><span>Gesicherte Session mit dauerhaftem Login-Cookie</span></div>
          <div className="auth-feature-row"><span className="auth-feature-dot" /><span>Zentral gespeicherte Konfiguration</span></div>
          <div className="auth-feature-row"><span className="auth-feature-dot" /><span>Live-Daten aus deinem BWW System</span></div>
        </div>

        <section className="auth-card">
          <div className="auth-card-top"><span className="auth-secure">SECURE ACCESS</span><span className="online-dot" /></div>
          <span className="section-kicker">ANMELDUNG</span>
          <h2>Willkommen zurück.</h2>
          <p className="auth-card-copy">Nutze den einmaligen Code aus Discord mit <code>/dashboard-code</code>. Nach erfolgreicher Anmeldung bleibt die Session gespeichert.</p>
          <form className="auth-form" onSubmit={login}>
            <label>
              <span>Dashboard-Code</span>
              <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="8F3K-2P7Q" autoComplete="one-time-code" spellCheck="false" autoFocus />
            </label>
            {error && <div className="form-alert error">{error}</div>}
            <button className="auth-submit" disabled={busy || !code.trim()}><span>{busy ? 'Anmeldung läuft…' : 'Anmelden'}</span><b>→</b></button>
          </form>
          <div className="auth-help"><span className="help-dot" /><span>Der Code ist nur einmal verwendbar und zeitlich begrenzt.</span></div>
          <div className="auth-footer"><span>BWW Command Center</span><span>Gesicherte Verbindung</span></div>
        </section>
      </section>
    </main>
  );
}
