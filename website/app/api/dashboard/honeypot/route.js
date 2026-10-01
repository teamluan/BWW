import { NextResponse } from 'next/server';
import { getDashboardSession, getGuildInfo, getSettings, getHoneypotEvents } from '../../../../lib/dashboard';

export async function GET() {
  try {
    const session = await getDashboardSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 });

    const [guild, settings, events] = await Promise.all([
      getGuildInfo(session.guildId),
      getSettings(session.guildId),
      getHoneypotEvents(session.guildId, 50)
    ]);

    return NextResponse.json({
      ok: true,
      guild,
      settings: settings.honeypot,
      events
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Honeypot-Daten konnten nicht geladen werden.' }, { status: 500 });
  }
}
