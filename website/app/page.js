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

  if (status === 'loading') {
    return <main className="auth-page"><div className="auth-loading"><span className="brand-icon">B</span><span>Verbindung wird geprüft…</span></div></main>;
  }

  return (
    <main className="auth-page">
      <div className="auth-background" aria-hidden="true"><span className="auth-grid" /><span className="glow glow-one" /><span className="glow glow-two" /></div>
      <section className="auth-layout">
        <div className="auth-intro">
          <a className="brand-lockup" href="/"><span className="brand-icon">B</span><span><strong>BWW</strong><small>COMMAND CENTER</small></span></a>
          <div className="auth-copy">
            <span className="eyebrow"><i /> PRIVATE ADMIN PORTAL</span>
            <h1>Dein Server.<br /><em>Deine Kontrolle.</em></h1>
            <p>Ein zentraler Arbeitsplatz für Status, Systeme und die komplette Konfiguration deines BWW Discord Bots.</p>
          </div>
          <div className="auth-points">
            <div><span>01</span><strong>Live-Übersicht</strong><small>Bot, Ping, Server und Mitglieder.</small></div>
            <div><span>02</span><strong>Zentrale Einstellungen</strong><small>Alle Bot-Optionen aus einer Oberfläche.</small></div>
            <div><span>03</span><strong>Sicherer Zugang</strong><small>Temporärer Code direkt aus Discord.</small></div>
          </div>
        </div>
        <section className="auth-card">
          <div className="auth-card-top"><span className="auth-card-icon">↗</span><span className="auth-secure">SECURE ACCESS</span></div>
          <span className="eyebrow">ADMIN LOGIN</span>
          <h2>Willkommen zurück.</h2>
          <p className="auth-card-copy">Erzeuge in Discord mit <code>/dashboard-code</code> einen temporären Zugangscode und gib ihn hier ein.</p>
          <form className="auth-form" onSubmit={login}>
            <label><span>Dashboard-Code</span><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="z. B. 8F3K-2P7Q" autoComplete="one-time-code" spellCheck="false" autoFocus /></label>
            {error && <div className="form-alert error">{error}</div>}
            <button className="auth-submit" disabled={busy || !code.trim()}><span>{busy ? 'Anmeldung läuft…' : 'Anmelden'}</span><b>→</b></button>
          </form>
          <div className="auth-help"><span className="help-dot" /><span>Der Code ist nur einmal verwendbar und zeitlich begrenzt.</span></div>
          <div className="auth-footer"><span>BWW Command Center</span><span>© {new Date().getFullYear()}</span></div>
        </section>
      </section>
    </main>
  );
}
