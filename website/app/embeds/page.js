'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardShell from '../../components/dashboard-shell';

const EMPTY = {
  title: '',
  description: '',
  color: '5865F2',
  spoiler: false,
  thumbnail: '',
  image: '',
  footer: '',
  components: [{ type: 'text', content: '' }],
};

const COMPONENT_TYPES = [
  ['text', 'Text Display', 'Markdown-Text'],
  ['separator', 'Separator', 'Abstand / Trennlinie'],
  ['section', 'Section', 'Text + Thumbnail oder Button'],
  ['media_gallery', 'Media Gallery', '1–10 Bilder'],
  ['file', 'File', 'Datei als V2-Komponente'],
  ['buttons', 'Button-Reihe', 'Bis zu 5 Buttons'],
  ['select', 'Select Menu', 'String, User, Role, Mentionable oder Channel'],
];

const BUTTON_STYLES = ['primary', 'secondary', 'success', 'danger', 'link'];
const SELECT_TYPES = ['string', 'user', 'role', 'mentionable', 'channel'];

function id(prefix) {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function safeColor(value) {
  const normalized = String(value || '').replace('#', '');
  return /^[0-9a-fA-F]{6}$/.test(normalized) ? '#' + normalized : '#5865F2';
}

function blankComponent(type) {
  if (type === 'text') return { type, content: '' };
  if (type === 'separator') return { type, divider: true, spacing: 'small' };
  if (type === 'section') return { type, texts: [''], accessory: { type: 'thumbnail', url: '', description: '', spoiler: false } };
  if (type === 'media_gallery') return { type, items: [{ url: '', description: '', spoiler: false }] };
  if (type === 'file') return { type, url: '', filename: 'datei.pdf', description: '', spoiler: false };
  if (type === 'buttons') return { type, buttons: [{ label: 'Button', style: 'primary', customId: id('bww_embed_btn_'), url: '', emoji: '', disabled: false, response: '' }] };
  return { type: 'select', kind: 'string', customId: id('bww_embed_select_'), placeholder: 'Bitte auswählen…', minValues: 1, maxValues: 1, disabled: false, response: '', options: [{ label: 'Option 1', value: 'option_1', description: '', default: false }] };
}

function migrateLegacy(data) {
  if (Array.isArray(data?.components) && data.components.length) return { ...EMPTY, ...data, components: data.components };
  const components = [];
  if (data?.title) components.push({ type: 'text', content: '## ' + data.title });
  if (data?.description) components.push({ type: 'text', content: data.description });
  if (data?.thumbnail && components.length) components.push({ type: 'section', texts: [components.pop().content], accessory: { type: 'thumbnail', url: data.thumbnail, description: '', spoiler: false } });
  if (data?.image) components.push({ type: 'media_gallery', items: [{ url: data.image, description: data.title || '', spoiler: false }] });
  if (data?.footer) components.push({ type: 'text', content: '-# ' + data.footer });
  return { ...EMPTY, ...data, components: components.length ? components : [{ type: 'text', content: '' }] };
}

function Field({ label, children, hint }) {
  return <label className="builder-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function ButtonEditor({ button, onChange, onRemove, compact = false }) {
  return (
    <div className={'nested-card ' + (compact ? 'compact' : '')}>
      <div className="nested-head"><strong>Button</strong><button className="icon-text-button danger" onClick={onRemove}>Löschen</button></div>
      <div className="form-grid">
        <Field label="Label"><input value={button.label || ''} onChange={(e) => onChange({ ...button, label: e.target.value })} maxLength={80} /></Field>
        <Field label="Style"><select value={button.style || 'secondary'} onChange={(e) => onChange({ ...button, style: e.target.value })}>{BUTTON_STYLES.map((style) => <option key={style}>{style}</option>)}</select></Field>
      </div>
      <div className="form-grid">
        <Field label={button.style === 'link' ? 'URL' : 'Custom ID'}>{button.style === 'link'
          ? <input value={button.url || ''} onChange={(e) => onChange({ ...button, url: e.target.value })} placeholder="https://…" />
          : <input value={button.customId || ''} onChange={(e) => onChange({ ...button, customId: e.target.value })} maxLength={100} />}</Field>
        <Field label="Emoji"><input value={button.emoji || ''} onChange={(e) => onChange({ ...button, emoji: e.target.value })} placeholder="Optional" /></Field>
      </div>
      {button.style !== 'link' && <label className="check-option"><input type="checkbox" checked={Boolean(button.disabled)} onChange={(e) => onChange({ ...button, disabled: e.target.checked })} /><span>Deaktiviert</span></label>}
      {button.style !== 'link' && <Field label="Antwort nach Klick" hint="{user}, {username}, {server} und {values} sind verfügbar."><textarea rows={3} value={button.response || ''} onChange={(e) => onChange({ ...button, response: e.target.value })} placeholder="z. B. ✅ Danke {user}!" /></Field>}
    </div>
  );
}

function ComponentEditor({ component, onChange, onDelete }) {
  const update = (value) => onChange({ ...component, ...value });

  if (component.type === 'text') {
    return <Field label="Markdown-Inhalt"><textarea rows={5} value={component.content || ''} onChange={(e) => update({ content: e.target.value })} placeholder="# Überschrift
Dein Text mit **Markdown**…" maxLength={4000} /></Field>;
  }

  if (component.type === 'separator') {
    return <div className="component-inline-options"><label className="check-option"><input type="checkbox" checked={component.divider !== false} onChange={(e) => update({ divider: e.target.checked })} /><span>Trennlinie anzeigen</span></label><Field label="Abstand"><select value={component.spacing || 'small'} onChange={(e) => update({ spacing: e.target.value })}><option value="small">Klein</option><option value="large">Groß</option></select></Field></div>;
  }

  if (component.type === 'section') {
    const texts = Array.isArray(component.texts) ? component.texts : [''];
    const accessory = component.accessory;
    return (
      <div className="nested-stack">
        <div className="component-subheading">Section Text · bis zu 3 Text Displays</div>
        {texts.map((value, index) => <div className="nested-inline" key={index}><textarea rows={3} value={value} onChange={(e) => update({ texts: texts.map((item, i) => i === index ? e.target.value : item) })} placeholder={'Text Display ' + (index + 1)} /><button className="icon-text-button danger" onClick={() => update({ texts: texts.filter((_, i) => i !== index) })} disabled={texts.length === 1}>×</button></div>)}
        {texts.length < 3 && <button className="add-small-button" onClick={() => update({ texts: [...texts, ''] })}>+ Text Display</button>}
        <Field label="Accessory"><select value={accessory?.type || 'none'} onChange={(e) => update({ accessory: e.target.value === 'none' ? undefined : { ...(component.accessory || {}), type: e.target.value } })}><option value="thumbnail">Thumbnail</option><option value="button">Button</option><option value="none">Kein Accessory</option></select></Field>
        {accessory?.type === 'thumbnail' && <div className="form-grid">
          <Field label="Thumbnail URL"><input value={accessory.url || ''} onChange={(e) => update({ accessory: { ...accessory, url: e.target.value } })} placeholder="https://…" /></Field>
          <Field label="Alt-Text"><input value={accessory.description || ''} onChange={(e) => update({ accessory: { ...accessory, description: e.target.value } })} /></Field>
          <label className="check-option"><input type="checkbox" checked={Boolean(accessory.spoiler)} onChange={(e) => update({ accessory: { ...accessory, spoiler: e.target.checked } })} /><span>Spoiler</span></label>
        </div>}
        {accessory?.type === 'button' && <ButtonEditor button={{ label: 'Action', style: 'primary', customId: id('bww_embed_btn_'), response: '', ...(accessory || {}) }} onChange={(button) => update({ accessory: { ...button, type: 'button' } })} onRemove={() => update({ accessory: undefined })} compact />}
      </div>
    );
  }

  if (component.type === 'media_gallery') {
    const items = Array.isArray(component.items) ? component.items : [];
    return (
      <div className="nested-stack">
        {items.map((item, index) => <div className="nested-card compact" key={index}>
          <div className="nested-head"><strong>Bild {index + 1}</strong><button className="icon-text-button danger" onClick={() => update({ items: items.filter((_, i) => i !== index) })}>Löschen</button></div>
          <Field label="URL"><input value={item.url || ''} onChange={(e) => update({ items: items.map((current, i) => i === index ? { ...current, url: e.target.value } : current) })} placeholder="https://…" /></Field>
          <div className="form-grid"><Field label="Beschreibung"><input value={item.description || ''} onChange={(e) => update({ items: items.map((current, i) => i === index ? { ...current, description: e.target.value } : current) })} maxLength={1024} /></Field><label className="check-option"><input type="checkbox" checked={Boolean(item.spoiler)} onChange={(e) => update({ items: items.map((current, i) => i === index ? { ...current, spoiler: e.target.checked } : current) })} /><span>Spoiler</span></label></div>
        </div>)}
        {items.length < 10 && <button className="add-small-button" onClick={() => update({ items: [...items, { url: '', description: '', spoiler: false }] })}>+ Bild hinzufügen</button>}
      </div>
    );
  }

  if (component.type === 'file') {
    return (
      <div className="nested-stack">
        <Field label="Datei-URL" hint="Der Bot lädt die Datei beim Senden herunter und hängt sie als echte Discord-Datei an.">
          <input value={component.url || ''} onChange={(e) => update({ url: e.target.value })} placeholder="https://…/datei.pdf" />
        </Field>
        <div className="form-grid">
          <Field label="Dateiname"><input value={component.filename || ''} onChange={(e) => update({ filename: e.target.value })} maxLength={100} placeholder="datei.pdf" /></Field>
          <Field label="Beschreibung / Alt-Text"><input value={component.description || ''} onChange={(e) => update({ description: e.target.value })} maxLength={1024} /></Field>
        </div>
        <label className="check-option"><input type="checkbox" checked={Boolean(component.spoiler)} onChange={(e) => update({ spoiler: e.target.checked })} /><span>Spoiler</span></label>
        <small className="builder-note">Standardmäßig maximal 20 MB pro Datei. Größere Discord-Kontolimits können abweichen.</small>
      </div>
    );
  }

  if (component.type === 'buttons') {
    const buttons = Array.isArray(component.buttons) ? component.buttons : [];
    return <div className="nested-stack">{buttons.map((button, index) => <ButtonEditor key={index} button={button} onChange={(value) => update({ buttons: buttons.map((current, i) => i === index ? value : current) })} onRemove={() => update({ buttons: buttons.filter((_, i) => i !== index) })} />)}{buttons.length < 5 && <button className="add-small-button" onClick={() => update({ buttons: [...buttons, { label: 'Button', style: 'secondary', customId: id('bww_embed_btn_'), url: '', emoji: '', disabled: false, response: '' }] })}>+ Button</button>}</div>;
  }

  if (component.type === 'select') {
    const options = Array.isArray(component.options) ? component.options : [];
    return (
      <div className="nested-stack">
        <div className="form-grid">
          <Field label="Select-Typ"><select value={component.kind || 'string'} onChange={(e) => update({ kind: e.target.value })}>{SELECT_TYPES.map((kind) => <option key={kind}>{kind}</option>)}</select></Field>
          <Field label="Custom ID"><input value={component.customId || ''} onChange={(e) => update({ customId: e.target.value })} maxLength={100} /></Field>
        </div>
        <div className="form-grid">
          <Field label="Placeholder"><input value={component.placeholder || ''} onChange={(e) => update({ placeholder: e.target.value })} maxLength={150} /></Field>
          <Field label="Werte"><div className="value-range"><input type="number" min="0" max="25" value={component.minValues ?? 1} onChange={(e) => update({ minValues: Number(e.target.value) })} /><span>bis</span><input type="number" min="1" max="25" value={component.maxValues ?? 1} onChange={(e) => update({ maxValues: Number(e.target.value) })} /></div></Field>
        </div>
        <label className="check-option"><input type="checkbox" checked={Boolean(component.disabled)} onChange={(e) => update({ disabled: e.target.checked })} /><span>Select deaktivieren</span></label>
        <Field label="Antwort bei Auswahl" hint="{values} enthält die ausgewählten Werte bzw. IDs."><textarea rows={3} value={component.response || ''} onChange={(e) => update({ response: e.target.value })} placeholder="z. B. ✅ Auswahl: {values}" /></Field>
        {component.kind === 'string' && <div className="nested-stack">
          <div className="component-subheading">Optionen · max. 25</div>
          {options.map((option, index) => <div className="nested-card compact" key={index}>
            <div className="nested-head"><strong>Option {index + 1}</strong><button className="icon-text-button danger" onClick={() => update({ options: options.filter((_, i) => i !== index) })}>Löschen</button></div>
            <div className="form-grid"><Field label="Label"><input value={option.label || ''} onChange={(e) => update({ options: options.map((current, i) => i === index ? { ...current, label: e.target.value } : current) })} maxLength={100} /></Field><Field label="Value"><input value={option.value || ''} onChange={(e) => update({ options: options.map((current, i) => i === index ? { ...current, value: e.target.value } : current) })} maxLength={100} /></Field></div>
            <div className="form-grid">
              <Field label="Beschreibung"><input value={option.description || ''} onChange={(e) => update({ options: options.map((current, i) => i === index ? { ...current, description: e.target.value } : current) })} maxLength={100} /></Field>
              <Field label="Emoji"><input value={option.emoji || ''} onChange={(e) => update({ options: options.map((current, i) => i === index ? { ...current, emoji: e.target.value } : current) })} maxLength={100} placeholder="Optional" /></Field>
            </div>
          </div>)}
          {options.length < 25 && <button className="add-small-button" onClick={() => update({ options: [...options, { label: 'Neue Option', value: 'new_option', description: '', default: false }] })}>+ Option</button>}
        </div>}
      </div>
    );
  }

  return null;
}

function Preview({ data }) {
  const color = safeColor(data.color);
  return (
    <div className="discord-window">
      <div className="discord-user"><span className="discord-avatar">B</span><span><strong>BWW</strong><small>heute um jetzt</small></span></div>
      <div className="v2-preview" style={{ borderLeftColor: color }}>
        {data.spoiler && <div className="soft-badge" style={{ marginBottom: 8 }}>SPOILER-CONTAINER</div>}
        {(data.components || []).map((component, index) => {
          if (component.type === 'text') return <div className="v2-preview-text" key={index}>{component.content || 'Text Display…'}</div>;
          if (component.type === 'separator') return <div className={'v2-preview-separator ' + (component.spacing === 'large' ? 'large' : '')} key={index}>{component.divider !== false && <i />}</div>;
          if (component.type === 'section') return <div className="v2-preview-section" key={index}><div>{(component.texts || []).map((text, i) => <div className="v2-preview-text" key={i}>{text || 'Text Display…'}</div>)}</div>{component.accessory?.type === 'thumbnail' && component.accessory.url && <img src={component.accessory.url} alt="" />}{component.accessory?.type === 'button' && <span className="preview-button">{component.accessory.label || 'Button'}</span>}</div>;
          if (component.type === 'media_gallery') return <div className="v2-preview-gallery" key={index}>{(component.items || []).map((item, i) => item.url ? <img src={item.url} alt="" key={i} /> : <span key={i}>Bild {i + 1}</span>)}</div>;
          if (component.type === 'file') return <div className="nested-card compact" key={index}><strong>📎 {component.filename || 'Datei'}</strong><small>{component.description || 'File Component'}</small>{component.spoiler && <span className="soft-badge">SPOILER</span>}</div>;
          if (component.type === 'buttons') return <div className="v2-preview-buttons" key={index}>{(component.buttons || []).map((button, i) => <span className={'preview-button ' + (button.style || 'secondary')} key={i}>{button.emoji ? button.emoji + ' ' : ''}{button.label || 'Button'}</span>)}</div>;
          if (component.type === 'select') return <div className="preview-select" key={index}>{component.placeholder || 'Select Menu'} <span>⌄</span></div>;
          return null;
        })}
        {!(data.components || []).length && <div className="v2-preview-text">Noch keine Komponenten hinzugefügt.</div>}
      </div>
      <small className="preview-note">IS_COMPONENTS_V2 · ContainerBuilder · bis zu 40 Komponenten</small>
    </div>
  );
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
    load().catch((err) => { setError(err.message || 'Embeds konnten nicht geladen werden.'); setMode('error'); });
  }, []);

  function patchData(next) {
    setData((current) => ({ ...current, ...next }));
    setMessage('');
  }

  function addComponent(type) {
    if ((data.components || []).length >= 40) {
      setError('Discord erlaubt maximal 40 Komponenten pro V2-Nachricht.');
      return;
    }
    patchData({ components: [...(data.components || []), blankComponent(type)] });
  }

  function move(index, direction) {
    const next = [...data.components];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patchData({ components: next });
  }

  function duplicate(index) {
    if ((data.components || []).length >= 40) return setError('Maximal 40 Komponenten.');
    const copy = JSON.parse(JSON.stringify(data.components[index]));
    patchData({ components: [...data.components.slice(0, index + 1), copy, ...data.components.slice(index + 1)] });
  }

  function updateComponent(index, value) {
    patchData({ components: data.components.map((item, i) => i === index ? value : item) });
  }

  function removeComponent(index) {
    patchData({ components: data.components.filter((_, i) => i !== index) });
  }

  async function save(send = false) {
    if (!name.trim()) return setError('Bitte einen Vorlagennamen eingeben.');
    setBusy(true); setError(''); setMessage('');
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
      setMessage(send ? 'V2-Vorlage gespeichert und an den Bot übergeben.' : 'V2-Vorlage gespeichert.');
    } catch (err) {
      setError(err.message || 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  function reset() { setName(''); setChannelId(''); setData(EMPTY); setSelected(''); setError(''); setMessage(''); }

  function useTemplate(template) {
    const migrated = migrateLegacy(template.data || {});
    setSelected(template.id);
    setName(template.name);
    setData(migrated);
    setError('');
    setMessage('Vorlage geladen.');
  }

  async function remove(idValue) {
    if (!window.confirm('Diese Vorlage wirklich löschen?')) return;
    try {
      const response = await fetch('/api/dashboard/embeds?id=' + encodeURIComponent(idValue), { method: 'DELETE' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Löschen fehlgeschlagen.');
      setTemplates((current) => current.filter((item) => item.id !== idValue));
      if (selected === idValue) reset();
      setMessage('Vorlage gelöscht.');
    } catch (err) { setError(err.message || 'Löschen fehlgeschlagen.'); }
  }

  const componentCount = useMemo(() => (data.components || []).length, [data.components]);

  if (mode === 'loading') return <main className="dashboard-app"><div className="page-loading">Embed-System wird geladen…</div></main>;
  if (mode === 'error') return <main className="dashboard-app"><div className="error-panel"><span className="page-kicker">BWW / EMBEDS</span><h1>Embed-System nicht verfügbar</h1><p>{error}</p><a className="button-secondary" href="/dashboard">Zur Übersicht</a></div></main>;

  return (
    <DashboardShell active="embeds">
      <div className="page">
        <header className="page-header">
          <div><div className="breadcrumb">BWW <span>/</span> Embeds V2</div><h1>Embeds V2</h1><p>Baue deine Discord-Nachricht aus echten Components-V2-Blöcken und veröffentliche sie direkt.</p></div>
          <div className="header-meta"><span className="v2-status"><i />{componentCount}/40 Komponenten</span></div>
        </header>

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

        <section className="embed-layout">
          <div className="embed-builder">
            <div className="section-title"><div><span className="section-kicker">MESSAGE BUILDER</span><h2>Components V2</h2></div><button className="text-button" onClick={reset}>Neue Nachricht</button></div>

            <article className="surface-card builder-card">
              <div className="form-grid">
                <Field label="Vorlagenname"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. server-regeln" maxLength={64} /></Field>
                <Field label="Accent Color" hint="Container-Farbe"><div className="color-row"><input value={data.color} onChange={(e) => patchData({ color: e.target.value.replace('#', '').toUpperCase().slice(0, 6) })} maxLength={6} placeholder="5865F2" /><span style={{ background: safeColor(data.color) }} /></div></Field>
                <label className="check-option"><input type="checkbox" checked={Boolean(data.spoiler)} onChange={(e) => patchData({ spoiler: e.target.checked })} /><span>Container als Spoiler markieren</span></label>
              </div>

              <div className="builder-toolbar">
                <span>Komponente hinzufügen · bis zu 40</span>
                <div className="component-add-grid">{COMPONENT_TYPES.map(([type, label, description]) => <button key={type} onClick={() => addComponent(type)} disabled={componentCount >= 40}><strong>+</strong><span><b>{label}</b><small>{description}</small></span></button>)}</div>
              </div>

              <div className="component-stack">
                {(data.components || []).map((component, index) => (
                  <article className="component-card" key={index}>
                    <div className="component-card-head">
                      <div><span className="component-number">{String(index + 1).padStart(2, '0')}</span><strong>{COMPONENT_TYPES.find(([type]) => type === component.type)?.[1] || component.type}</strong></div>
                      <div className="component-actions"><button onClick={() => move(index, -1)} disabled={index === 0}>↑</button><button onClick={() => move(index, 1)} disabled={index === componentCount - 1}>↓</button><button onClick={() => duplicate(index)}>Dupl.</button><button className="danger" onClick={() => removeComponent(index)}>×</button></div>
                    </div>
                    <ComponentEditor component={component} onChange={(value) => updateComponent(index, value)} onDelete={() => removeComponent(index)} />
                  </article>
                ))}
                {!componentCount && <div className="empty-inline">Füge oben eine V2-Komponente hinzu.</div>}
              </div>

              <div className="builder-actions">
                <button className="button-primary" onClick={() => save(false)} disabled={busy}>{busy ? 'Speichere…' : 'Vorlage speichern'}</button>
                <button className="button-accent" onClick={() => save(true)} disabled={busy || !channelId}>{busy ? 'Sende…' : 'In Discord senden'}</button>
              </div>
              <Field label="Discord Channel-ID" hint="Nur für direktes Senden erforderlich."><input value={channelId} onChange={(e) => setChannelId(e.target.value.replace(/\D/g, '').slice(0, 32))} placeholder="Channel-ID" /></Field>
            </article>

            <article className="surface-card template-card">
              <div className="card-header"><div><span className="section-kicker">LIBRARY</span><h3>Gespeicherte Vorlagen</h3></div><span className="soft-badge">{templates.length}</span></div>
              {templates.length ? <div className="template-list">{templates.map((template) => <div className={'template-row ' + (selected === template.id ? 'selected' : '')} key={template.id}><button onClick={() => useTemplate(template)}><span className="template-icon">V2</span><span><strong>{template.name}</strong><small>{Array.isArray(template.data?.components) ? template.data.components.length + ' Komponenten' : 'Legacy-Vorlage'}</small></span></button><button className="delete-template" onClick={() => remove(template.id)}>×</button></div>)}</div> : <div className="empty-inline">Noch keine Vorlagen gespeichert.</div>}
            </article>
          </div>

          <aside className="preview-column">
            <article className="surface-card preview-card">
              <div className="card-header"><div><span className="section-kicker">LIVE PREVIEW</span><h3>Discord</h3></div><span className="soft-badge">LIVE</span></div>
              <Preview data={data} />
            </article>
            <div className="info-card"><strong>Was jetzt unterstützt wird</strong><span>Text Displays · Sections · Thumbnails · Media Gallery · File · Separator · Button-Reihen · String/User/Role/Mentionable/Channel Selects · Spoiler. File-Komponenten werden beim Senden als echte Discord-Anhänge vorbereitet.</span></div>
          </aside>
        </section>

        <footer className="page-footer"><span>BWW Embed-System</span><span>Discord Components V2 · zentral in Supabase</span></footer>
      </div>
    </DashboardShell>
  );
}
