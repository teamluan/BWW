import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  deleteEmbedTemplate,
  getDashboardSession,
  listEmbedTemplates,
  queueDashboardAction,
  saveEmbedTemplate,
} from '../../../../lib/dashboard';

const DEFAULT_DATA = {
  title: '',
  description: '',
  color: '5865F2',
  spoiler: false,
  thumbnail: '',
  image: '',
  footer: '',
  components: [],
};

function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function url(value) {
  const valueText = text(value, 1000);
  if (!valueText) return '';
  try {
    const parsed = new URL(valueText);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function customId(value, prefix) {
  const raw = text(value, 90).replace(/[^a-zA-Z0-9:_-]/g, '');
  return (raw || prefix + crypto.randomUUID().replaceAll('-', '')).slice(0, 100);
}

function filename(value) {
  const clean = String(value ?? '')
    .trim()
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 100);
  return clean || 'bww-file.bin';
}

function sanitizeButton(input, index = 0) {
  const source = input && typeof input === 'object' ? input : {};
  const style = ['primary', 'secondary', 'success', 'danger', 'link'].includes(source.style) ? source.style : 'secondary';
  const button = {
    label: text(source.label || 'Button', 80),
    style,
    emoji: text(source.emoji, 100),
    disabled: Boolean(source.disabled),
    response: text(source.response, 2000),
  };
  if (style === 'link') {
    button.url = url(source.url);
  } else {
    button.customId = customId(source.customId, 'bww_embed_btn_' + index + '_');
  }
  return button;
}

function sanitizeSelect(input) {
  const source = input && typeof input === 'object' ? input : {};
  const kind = ['string', 'user', 'role', 'mentionable', 'channel'].includes(source.kind) ? source.kind : 'string';
  const select = {
    kind,
    customId: customId(source.customId, 'bww_embed_select_'),
    placeholder: text(source.placeholder, 150),
    minValues: Math.max(0, Math.min(25, Number.isFinite(Number(source.minValues)) ? Number(source.minValues) : 1)),
    maxValues: Math.max(1, Math.min(25, Number.isFinite(Number(source.maxValues)) ? Number(source.maxValues) : 1)),
    disabled: Boolean(source.disabled),
    response: text(source.response, 2000),
  };
  if (select.maxValues < select.minValues) select.maxValues = select.minValues || 1;
  if (kind === 'string') {
    select.options = (Array.isArray(source.options) ? source.options : []).slice(0, 25).map((option, index) => ({
      label: text(option?.label || 'Option ' + (index + 1), 100),
      value: text(option?.value || 'option_' + (index + 1), 100),
      description: text(option?.description, 100),
      default: Boolean(option?.default),
    })).filter((option) => option.label && option.value);
  }
  return select;
}

function sanitizeComponent(input, index) {
  const source = input && typeof input === 'object' ? input : {};
  if (source.type === 'text') {
    return { type: 'text', content: text(source.content, 4000) };
  }
  if (source.type === 'separator') {
    return { type: 'separator', divider: source.divider !== false, spacing: source.spacing === 'large' ? 'large' : 'small' };
  }
  if (source.type === 'file') {
    return {
      type: 'file',
      url: url(source.url),
      filename: filename(source.filename),
      description: text(source.description, 1024),
      spoiler: Boolean(source.spoiler),
    };
  }
  if (source.type === 'media_gallery') {
    return {
      type: 'media_gallery',
      items: (Array.isArray(source.items) ? source.items : []).slice(0, 10).map((item) => ({
        url: url(item?.url),
        description: text(item?.description, 1024),
        spoiler: Boolean(item?.spoiler),
      })).filter((item) => item.url),
    };
  }
  if (source.type === 'section') {
    const section = {
      type: 'section',
      texts: (Array.isArray(source.texts) ? source.texts : []).slice(0, 3).map((value) => text(value, 4000)).filter(Boolean),
    };
    if (source.accessory?.type === 'thumbnail') {
      section.accessory = {
        type: 'thumbnail',
        url: url(source.accessory.url),
        description: text(source.accessory.description, 1024),
        spoiler: Boolean(source.accessory.spoiler),
      };
      if (!section.accessory.url) delete section.accessory;
    } else if (source.accessory?.type === 'button') {
      section.accessory = { type: 'button', ...sanitizeButton(source.accessory, 'section') };
    }
    return section;
  }
  if (source.type === 'buttons') {
    return {
      type: 'buttons',
      buttons: (Array.isArray(source.buttons) ? source.buttons : []).slice(0, 5).map((button, buttonIndex) => sanitizeButton(button, index + '-' + buttonIndex)),
    };
  }
  if (source.type === 'select') {
    return { type: 'select', ...sanitizeSelect(source) };
  }
  return null;
}

function ensureUniqueCustomIds(components) {
  const used = new Set();
  const unique = (value, prefix) => {
    let next = value;
    while (used.has(next)) next = (prefix + crypto.randomUUID()).slice(0, 100);
    used.add(next);
    return next;
  };
  return components.map((component, index) => {
    const copy = JSON.parse(JSON.stringify(component));
    if (copy.type === 'buttons') {
      copy.buttons = (copy.buttons || []).map((button, buttonIndex) => {
        if (button.style !== 'link') button.customId = unique(button.customId, 'bww_embed_btn_' + index + '_' + buttonIndex + '_');
        return button;
      });
    }
    if (copy.type === 'section' && copy.accessory?.type === 'button' && copy.accessory.style !== 'link') {
      copy.accessory.customId = unique(copy.accessory.customId, 'bww_embed_section_btn_' + index + '_');
    }
    if (copy.type === 'select') {
      copy.customId = unique(copy.customId, 'bww_embed_select_' + index + '_');
    }
    return copy;
  });
}

function sanitizeData(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const rawColor = text(source.color, 6).replace(/^#/, '').toUpperCase();
  const components = (Array.isArray(source.components) ? source.components : [])
    .slice(0, 40)
    .map((component, index) => sanitizeComponent(component, index))
    .filter(Boolean)
    .filter((component) => {
      if (component.type === 'text') return Boolean(component.content);
      if (component.type === 'media_gallery') return component.items.length > 0;
      if (component.type === 'file') return Boolean(component.url);
      if (component.type === 'section') return component.texts.length > 0;
      if (component.type === 'buttons') return component.buttons.length > 0;
      if (component.type === 'select') return component.kind !== 'string' || component.options.length > 0;
      return true;
    });

  return {
    ...DEFAULT_DATA,
    title: text(source.title, 256),
    description: text(source.description, 4000),
    color: /^[0-9A-F]{6}$/.test(rawColor) ? rawColor : DEFAULT_DATA.color,
    spoiler: Boolean(source.spoiler),
    thumbnail: url(source.thumbnail),
    image: url(source.image),
    footer: text(source.footer, 1000),
    components: ensureUniqueCustomIds(components),
  };
}

function sanitizeName(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 64);
}

export async function GET() {
  try {
    const session = await getDashboardSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 });
    return NextResponse.json({ ok: true, templates: await listEmbedTemplates(session.guildId) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Embeds konnten nicht geladen werden.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getDashboardSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 });
    const body = await request.json();
    const name = sanitizeName(body?.name);
    if (!name) return NextResponse.json({ ok: false, error: 'Bitte einen Namen für die Vorlage angeben.' }, { status: 400 });

    const cleanData = sanitizeData(body?.data);
    if (!cleanData.components.length && !cleanData.title && !cleanData.description && !cleanData.image && !cleanData.thumbnail && !cleanData.footer) {
      return NextResponse.json({ ok: false, error: 'Die V2-Nachricht enthält noch keine Inhalte.' }, { status: 400 });
    }

    const template = await saveEmbedTemplate(session.guildId, name, cleanData, 'website');

    if (body?.send === true) {
      const channelId = String(body?.channelId || '').replace(/\D/g, '').slice(0, 32);
      if (!channelId) return NextResponse.json({ ok: false, error: 'Für das Senden wird eine Discord Channel-ID benötigt.' }, { status: 400 });
      await queueDashboardAction(session.guildId, 'send_embed_v2', { channelId, data: cleanData, templateId: template.id }, 'website');
    }

    return NextResponse.json({ ok: true, template, queued: body?.send === true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Embed konnte nicht gespeichert werden.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await getDashboardSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 });
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ ok: false, error: 'Ungültige Vorlage.' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, deleted: await deleteEmbedTemplate(session.guildId, id) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Embed konnte nicht gelöscht werden.' }, { status: 500 });
  }
}
