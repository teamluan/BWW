import { NextResponse } from 'next/server';
import { getDashboardSession, getGuildInfo, listGiveaways, queueDashboardAction } from '../../../../lib/dashboard';

function cleanId(value) {
  return String(value ?? '').slice(0, 32).replace(/[^0-9]/g, '');
}

function cleanData(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const prize = String(source.prize || '').trim().slice(0, 256);
  if (!prize) throw new Error('Preis fehlt.');
  const durationMinutes = Math.max(1 / 60, Math.min(43200, Number(source.durationMinutes) || 0));
  if (!durationMinutes) throw new Error('Ungültige Dauer.');
  return {
    prize,
    durationMs: Math.max(5000, Math.min(30 * 24 * 60 * 60 * 1000, durationMinutes * 60 * 1000)),
    winnerCount: Math.max(1, Math.min(100, Number(source.winnerCount) || 1)),
    requiredRoleId: cleanId(source.requiredRoleId),
    minAccountAgeDays: Math.max(0, Math.min(3650, Number(source.minAccountAgeDays) || 0)),
    minServerAgeDays: Math.max(0, Math.min(3650, Number(source.minServerAgeDays) || 0)),
    bonusRoleId: cleanId(source.bonusRoleId),
    bonusEntries: Math.max(0, Math.min(20, Number(source.bonusEntries) || 0))
  };
}

export async function GET() {
  try {
    const session = await getDashboardSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 });
    const [guild, giveaways] = await Promise.all([
      getGuildInfo(session.guildId),
      listGiveaways(session.guildId, 100)
    ]);
    return NextResponse.json({ ok: true, guild, giveaways });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Giveaways konnten nicht geladen werden.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getDashboardSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 });
    const body = await request.json();
    const channelId = cleanId(body?.channelId);
    if (!channelId) return NextResponse.json({ ok: false, error: 'Channel-ID fehlt.' }, { status: 400 });
    const data = cleanData(body?.giveaway);
    const action = await queueDashboardAction(session.guildId, 'create_giveaway', { channelId, data }, 'website');
    return NextResponse.json({ ok: true, action });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Giveaway konnte nicht erstellt werden.' }, { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    const session = await getDashboardSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 });
    const body = await request.json();
    const id = String(body?.id || '').slice(0, 200);
    if (!id) return NextResponse.json({ ok: false, error: 'Giveaway-ID fehlt.' }, { status: 400 });
    const type = String(body?.action || '');
    const map = {
      end: 'end_giveaway',
      reroll: 'reroll_giveaway',
      cancel: 'cancel_giveaway'
    };
    if (!map[type]) return NextResponse.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 });
    const action = await queueDashboardAction(session.guildId, map[type], { id }, 'website');
    return NextResponse.json({ ok: true, action });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Aktion konnte nicht eingereiht werden.' }, { status: 400 });
  }
}
