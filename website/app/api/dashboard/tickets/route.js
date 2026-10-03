import { NextResponse } from 'next/server';
import { getDashboardSession, getGuildInfo, listTickets } from '../../../../lib/dashboard';

export async function GET(request) {
  try {
    const session = await getDashboardSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || null;
    return NextResponse.json({
      ok: true,
      guild: await getGuildInfo(session.guildId),
      tickets: await listTickets(session.guildId, 100, status)
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Tickets konnten nicht geladen werden.' }, { status: 500 });
  }
}
