'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardShell from '../../components/dashboard-shell';

const EMPTY = { title: '', description: '', color: '5865F2', thumbnail: '', image: '', footer: '' };

function safeColor(value) {
  const normalized = String(value || '').replace('#', '');
  return /^[0-9a-fA-F]{6}$/.test(normalized) ? '#' + normalized : '#5865F2';
}

function BuilderField({ label, children, hint }) {
  return <label className="form-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export default function EmbedsPage() {
  const [mode, setMode] = useState('loading');
  const [templates, setTemplates] = useState([]);
  const [data, setData] = useState(EMPTY);
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const previewColor = useMemo(() => safeColor(data.color), [data.color]);

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

  function reset() {
    setName('');
    setChannelId('');
    setData(EMPTY);
    setSelected('');
    setError('');
    setMessage('');
  }

  async function save(send = false) {
    if (!name.trim()) {
      setError('Bitte einen Vorlagennamen eingeben.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/dashboard/embeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data, send, channelId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Speichern fehlgeschlagen.');
      await load();
      setSelected(json.template?.id || '');
      setMessage(send ? 'Vorlage gespeichert und an den Bot übergeben.' : 'Vorlage gespeichert.');
    } catch (err) {
      setError(err.message || 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Diese Vorlage wirklich löschen?')) return;
    try {
      const response = await fetch('/api/dashboard/embeds?id=' + encodeURIComponent(id), { method: 'DELETE' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Löschen fehlgeschlagen.');
      setTemplates((current) => current.filter((item) => item.id !== id));
      if (selected === id) reset();
      setMessage('Vorlage gelöscht.');
    } catch (err) {
      setError(err.message || 'Löschen fehlgeschlagen.');
    }
  }

  function useTemplate(template) {
    setSelected(template.id);
    setName(template.name);
    setData({ ...EMPTY, ...(template.data || {}) });
    setMessage('Vorlage geladen.');
    setError('');
  }

  if (mode === 'loading') return <main className="dashboard-app"><div className="page-loading">Embed-System wird geladen…</div></main>;
  if (mode === 'error') return <main className="dashboard-app"><div className="error-panel"><span className="page-kicker">BWW / EMBEDS</span><h1>Embed-System nicht verfügbar</h1><p>{error}</p><a className="button-secondary" href="/dashboard">Zur Übersicht</a></div></main>;

  return (
    <DashboardShell active="embeds">
      <div className="page">
        <header className="page-header">
          <div>
            <div className="breadcrumb">BWW <span>/</span> Embeds V2</div>
            <h1>Embeds V2</h1>
            <p>Erstelle Discord Components-V2-Nachrichten, speichere Vorlagen und veröffentliche sie direkt aus dem Dashboard.</p>
          </div>
          <div className="header-meta"><span className="v2-status"><i /> Components V2</span></div>
        </header>

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

        <section className="embed-layout">
          <div className="embed-builder">
            <div className="section-title"><div><span className="section-kicker">BUILDER</span><h2>Neue Nachricht</h2></div><button className="text-button" onClick={reset}>Zurücksetzen</button></div>
            <article className="surface-card builder-card">
              <div className="builder-head"><div><strong>Vorlage bearbeiten</strong><span>Alle Änderungen werden erst beim Speichern veröffentlicht.</span></div><span className="v2-chip">V2</span></div>

              <div className="form-field"><span>Vorlagenname</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. server-regeln" maxLength={64} /></div>
              <div className="form-field"><span>Titel</span><input value={data.title} onChange={(e) => patch('title', e.target.value)} placeholder="Titel der Nachricht" maxLength={256} /></div>
              <BuilderField label="Text"><textarea value={data.description} onChange={(e) => patch('description', e.target.value)} placeholder="Inhalt der Nachricht…" rows={7} maxLength={4000} /></BuilderField>

              <div className="form-grid">
                <BuilderField label="Farbe" hint="6-stelliger Hex-Wert">
                  <div className="color-row"><input value={data.color} onChange={(e) => patch('color', e.target.value.replace('#', '').toUpperCase().slice(0, 6))} placeholder="5865F2" maxLength={6} /><span style={{ background: previewColor }} /></div>
                </BuilderField>
                <BuilderField label="Footer"><input value={data.footer} onChange={(e) => patch('footer', e.target.value)} placeholder="Optionaler Hinweis" maxLength={1000} /></BuilderField>
              </div>

              <div className="form-grid">
                <BuilderField label="Thumbnail URL"><input value={data.thumbnail} onChange={(e) => patch('thumbnail', e.target.value)} placeholder="https://…" /></BuilderField>
                <BuilderField label="Bild URL"><input value={data.image} onChange={(e) => patch('image', e.target.value)} placeholder="https://…" /></BuilderField>
              </div>

              <BuilderField label="Discord Channel-ID" hint="Nur erforderlich, wenn direkt gesendet werden soll."><input value={channelId} onChange={(e) => setChannelId(e.target.value.replace(/\D/g, '').slice(0, 32))} placeholder="Channel-ID" /></BuilderField>

              <div className="builder-actions">
                <button className="button-primary" onClick={() => save(false)} disabled={busy}>{busy ? 'Speichere…' : 'Vorlage speichern'}</button>
                <button className="button-accent" onClick={() => save(true)} disabled={busy || !channelId}>{busy ? 'Sende…' : 'In Discord senden'}</button>
              </div>
            </article>

            <article className="surface-card template-card">
              <div className="card-header"><div><span className="section-kicker">LIBRARY</span><h3>Gespeicherte Vorlagen</h3></div><span className="soft-badge">{templates.length}</span></div>
              {templates.length ? <div className="template-list">{templates.map((template) => (
                <div className={'template-row ' + (selected === template.id ? 'selected' : '')} key={template.id}>
                  <button onClick={() => useTemplate(template)}><span className="template-icon">V2</span><span><strong>{template.name}</strong><small>{template.data?.title || 'Ohne Titel'}</small></span></button>
                  <button className="delete-template" onClick={() => remove(template.id)} aria-label={template.name + ' löschen'}>×</button>
                </div>
              ))}</div> : <div className="empty-inline">Noch keine Vorlagen gespeichert.</div>}
            </article>
          </div>

          <aside className="preview-column">
            <article className="surface-card preview-card">
              <div className="card-header"><div><span className="section-kicker">PREVIEW</span><h3>Discord</h3></div><span className="soft-badge">LIVE</span></div>
              <div className="discord-window">
                <div className="discord-user"><span className="discord-avatar">B</span><span><strong>BWW</strong><small>heute um jetzt</small></span></div>
                <div className="discord-message" style={{ borderLeftColor: previewColor }}>
                  {data.title && <strong className="preview-title">{data.title}</strong>}
                  <div className="preview-text">{data.description || 'Dein Nachrichtentext wird hier angezeigt.'}</div>
                  {data.thumbnail && <div className="preview-thumbnail"><img src={data.thumbnail} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></div>}
                  {data.image && <div className="preview-image"><img src={data.image} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></div>}
                  {data.footer && <><div className="preview-rule" /><div className="preview-footer">{data.footer}</div></>}
                </div>
                <small className="preview-note">Components V2 · ContainerBuilder</small>
              </div>
            </article>
            <div className="info-card"><strong>Components V2</strong><span>Das Bot-System sendet diese Nachrichten mit Discord MessageFlags.IsComponentsV2.</span></div>
          </aside>
        </section>

        <footer className="page-footer"><span>BWW Embed-System</span><span>Zentral in Supabase gespeichert</span></footer>
      </div>
    </DashboardShell>
  );
}
