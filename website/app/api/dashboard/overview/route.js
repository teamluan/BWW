import { NextResponse } from 'next/server';
import { getDashboardSession, getOverviewData } from '../../../../lib/dashboard';

export async function GET() {
  try {
    const session = await getDashboardSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 });
    return NextResponse.json({ ok: true, ...(await getOverviewData(session.guildId)) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Übersicht konnte nicht geladen werden.' }, { status: 500 });
  }
}
