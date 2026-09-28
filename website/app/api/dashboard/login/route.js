import { NextResponse } from 'next/server';
import { findDashboardCode, getGuildInfo, consumeDashboardCode, setDashboardSession } from '../../../../lib/dashboard';

export async function POST(request) {
  try {
    const body = await request.json();
    const record = await findDashboardCode(body?.code);
    if (!record) return NextResponse.json({ ok: false, error: 'Ungültiger oder abgelaufener Dashboard-Code.' }, { status: 401 });

    const expiresAt = new Date(record.expires_at).getTime();
    const consumed = await consumeDashboardCode(record.id);
    if (!consumed) return NextResponse.json({ ok: false, error: 'Der Dashboard-Code wurde bereits verwendet.' }, { status: 409 });
    await setDashboardSession(record.id, record.guild_id, expiresAt);

    return NextResponse.json({ ok: true, guild: await getGuildInfo(record.guild_id) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Login fehlgeschlagen.' }, { status: 500 });
  }
}
