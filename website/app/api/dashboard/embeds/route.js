import { NextResponse } from 'next/server';
import {
  deleteEmbedTemplate,
  getDashboardSession,
  listEmbedTemplates,
  saveEmbedTemplate,
} from '../../../../lib/dashboard';

const DEFAULT_DATA = {
  title: '',
  description: '',
  color: '5865F2',
  thumbnail: '',
  image: '',
  footer: '',
};

function sanitizeData(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const text = (value, max) => String(value ?? '').trim().slice(0, max);
  const url = (value) => {
    const valueText = text(value, 500);
    if (!valueText) return '';
    try {
      const parsed = new URL(valueText);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
    } catch {
      return '';
    }
  };
  const rawColor = text(source.color, 6).replace(/^#/, '').toUpperCase();
  return {
    title: text(source.title, 256),
    description: text(source.description, 4000),
    color: /^[0-9A-F]{6}$/.test(rawColor) ? rawColor : DEFAULT_DATA.color,
    thumbnail: url(source.thumbnail),
    image: url(source.image),
    footer: text(source.footer, 1000),
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
    const template = await saveEmbedTemplate(session.guildId, name, sanitizeData(body?.data), 'website');
    return NextResponse.json({ ok: true, template });
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
