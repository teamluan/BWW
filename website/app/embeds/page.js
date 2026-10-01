'use client';

import { useEffect, useMemo, useState } from 'react';

const EMPTY = {
  title: '',
  description: '',
  color: '5865F2',
  thumbnail: '',
  image: '',
  footer: ''
};

function safeColor(value) {
  return /^[0-9a-fA-F]{6}$/.test(value.replace('#', '')) ? '#' + value.replace('#', '') : '#5865F2';
}

export default function EmbedsPage() {
  const [mode, setMode] = useState('loading');
  const [templates, setTemplates] = useState([]);
  const [data, setData] = useState(EMPTY);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch('/api/dashboard/embeds', { cache: 'no-store' });
    const json = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.replace('/');
      return;
    }
    if (!response.ok) throw new Error(json.error || 'Embeds konnten nicht geladen werden.');
    setTemplates(json.templates || []);
    setMode('ready');
  }

  useEffect(() => {
    load().catch((err) => {
      setError(err.message || 'Embeds konnten nicht geladen werden.');
      setMode('error');
    });
  }, []);

  function patch(key, value) {
    setData((current) => ({ ...current, [key]: value }));
    setMessage('');
  }

  const previewColor = useMemo(() => safeColor(data.color), [data.color]);

  async function save() {
    if (!name.trim()) {
      setError('Bitte einen Namen für die Vorlage eingeben.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/dashboard/embeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Speichern fehlgeschlagen.');
      await load();
      setSelected(json.template?.id || '');
      setMessage('V2-Embed-Vorlage gespeichert.');
    } catch (err) {
      setError(err.message || 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Diese Embed-Vorlage wirklich löschen?')) return;
    setError('');
    try {
      const response = await fetch('/api/dashboard/embeds?id=' + encodeURIComponent(id), { method: 'DELETE' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Löschen fehlgeschlagen.');
      setTemplates((current) => current.filter((item) => item.id !== id));
      if (selected === id) {
        setSelected('');
        setName('');
        setData(EMPTY);
      }
      setMessage('Vorlage gelöscht.');
    } catch (err) {
      setError(err.message || 'Löschen fehlgeschlagen.');
    }
  }

  function useTemplate(template) {
    setSelected(template.id);
    setName(template.name);
    setData({ ...EMPTY, ...(template.data || {}) });
    setError('');
    setMessage('Vorlage geladen.');
  }

  async function logout() {
    await fetch('/api/dashboard/logout', { method: 'POST' });
    window.location.replace('/');
  }

  if (mode === 'loading') {
    return <main className="dashboard-app"><div className="page-loading"><span className="brand-icon">B</span><span>Embed-System wird geladen…</span></div></main>;
  }

  if (mode === 'error') {
    return <main className="dashboard-app"><div className="error-panel"><span className="eyebrow">BWW / EMBEDS</span><h1>Embed-System nicht verfügbar</h1><p>{error}</p><a className="button-secondary" href="/dashboard">Zur Übersicht</a></div></main>;
  }

  return (
    <main className="dashboard-app">
      <div className="dashboard-frame">
        <aside className="sidebar">
          <a className="sidebar-brand" href="/dashboard"><span className="brand-icon">B</span><span><strong>BWW</strong><small>COMMAND CENTER</small></span></a>
          <nav className="sidebar-nav" aria-label="Dashboard">
            <span className="nav-group-label">ÜBERSICHT</span>
            <a className="sidebar-link" href="/dashboard">▦<span>Dashboard</span></a>
            <a className="sidebar-link active" href="/embeds">▣<span>Embeds V2</span></a>
            <a className="sidebar-link" href="/settings">⚙<span>Einstellungen</span></a>
            <span className="nav-group-label spaced">SYSTEM</span>
            <a className="sidebar-link" href="/dashboard#servers">◈<span>Server</span></a>
            <a className="sidebar-link" href="/dashboard#status">◉<span>Bot-Status</span></a>
          </nav>
          <div className="sidebar-bottom">
            <div className="access-chip"><span className="status-indicator online" /><div><strong>Admin Session</strong><small>Components V2 aktiv</small></div></div>
            <button className="sidebar-logout" onClick={logout}>↪<span>Abmelden</span></button>
          </div>
        </aside>

        <section className="dashboard-main">
          <header className="dashboard-topbar settings-topbar">
            <div>
              <span className="eyebrow">BWW / COMPONENTS V2</span>
              <h1>Embed-System</h1>
              <p>Erstelle, bearbeite und speichere deine Discord-Nachrichten als Components-V2-Vorlagen.</p>
            </div>
            <div className="top-actions"><span className="secure-pill">V2 ONLY</span><a className="button-secondary" href="/dashboard">Übersicht</a></div>
          </header>

          {error && <div className="form-alert error">{error}</div>}
          {message && <div className="form-alert success">{message}</div>}

          <section className="embed-workspace">
            <div className="embed-editor">
              <article className="settings-card">
                <div className="settings-card-heading">
                  <div><span className="eyebrow">BUILDER</span><h2>V2-Nachricht erstellen</h2></div>
                  <span className="v2-badge">COMPONENTS V2</span>
                </div>
                <label><span>Vorlagenname</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. server-regeln" maxLength={64} /></label>
                <label><span>Titel</span><input value={data.title} onChange={(e) => patch('title', e.target.value)} placeholder="Titel des V2-Containers" maxLength={256} /></label>
                <label><span>Text</span><textarea value={data.description} onChange={(e) => patch('description', e.target.value)} placeholder="Inhalt der Nachricht…" rows={9} maxLength={4000} /></label>
                <div className="embed-form-grid">
                  <label><span>Farbe</span><div className="color-input"><input value={data.color} onChange={(e) => patch('color', e.target.value.replace('#', '').toUpperCase().slice(0, 6))} placeholder="5865F2" maxLength={6} /><span style={{ background: previewColor }} /></div></label>
                  <label><span>Footer</span><input value={data.footer} onChange={(e) => patch('footer', e.target.value)} placeholder="Optionaler Hinweis" maxLength={1000} /></label>
                </div>
                <label><span>Thumbnail URL</span><input value={data.thumbnail} onChange={(e) => patch('thumbnail', e.target.value)} placeholder="https://…" /></label>
                <label><span>Bild URL</span><input value={data.image} onChange={(e) => patch('image', e.target.value)} placeholder="https://…" /></label>
                <div className="embed-actions"><button className="button-primary" onClick={save} disabled={busy}>{busy ? 'Speichere…' : 'V2-Vorlage speichern'}</button><button className="ghost-button" onClick={() => { setName(''); setData(EMPTY); setSelected(''); setMessage(''); setError(''); }}>Neu</button></div>
              </article>
            </div>

            <aside className="embed-preview-column">
              <article className="settings-card embed-preview-card">
                <div className="settings-card-heading"><div><span className="eyebrow">LIVE PREVIEW</span><h2>Components V2</h2></div><span className="preview-status">V2</span></div>
                <div className="discord-preview">
                  <div className="discord-user"><span className="discord-avatar">B</span><div><strong>BWW</strong><small>heute um jetzt</small></div></div>
                  <div className="v2-container-preview" style={{ borderLeftColor: previewColor }}>
                    {data.title && <div className="preview-title">## {data.title}</div>}
                    <div className="preview-description">{data.description || 'Dein Text erscheint hier…'}</div>
                    {data.thumbnail && <div className="preview-thumb-wrap"><img src={data.thumbnail} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></div>}
                    {data.image && <div className="preview-image-wrap"><img src={data.image} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></div>}
                    {data.footer && <><div className="preview-divider" /><div className="preview-footer">{data.footer}</div></>}
                  </div>
                  <div className="preview-flags">MessageFlags.IsComponentsV2 · ContainerBuilder</div>
                </div>
              </article>

              <article className="settings-card saved-embeds">
                <div className="settings-card-heading"><div><span className="eyebrow">LIBRARY</span><h2>Gespeicherte Vorlagen</h2></div><span className="count-pill">{templates.length}</span></div>
                {templates.length ? <div className="template-list">{templates.map((template) => (
                  <div className={'template-item ' + (selected === template.id ? 'selected' : '')} key={template.id}>
                    <button className="template-use" onClick={() => useTemplate(template)}><strong>{template.name}</strong><small>{template.data?.title || 'Ohne Titel'}</small></button>
                    <button className="template-delete" onClick={() => remove(template.id)} aria-label={'Vorlage ' + template.name + ' löschen'}>×</button>
                  </div>
                ))}</div> : <p className="hint">Noch keine Vorlagen gespeichert.</p>}
              </article>
            </aside>
          </section>

          <footer className="dashboard-footer"><span>BWW Embed-System</span><span>Discord Components V2 · zentral in Supabase</span><span>{new Date().getFullYear()}</span></footer>
        </section>
      </div>
    </main>
  );
}
