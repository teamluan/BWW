import { NextResponse } from 'next/server';
import { getDashboardSession, getGuildInfo, getSettings, getHoneypotEvents, saveSettings } from '../../../../lib/dashboard';

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

function sanitizeHoneypot(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const cleanId = (value) => String(value ?? '').slice(0, 32).replace(/[^0-9]/g, '');
  const punishment = ['none', 'kick', 'ban', 'timeout'].includes(source.punishment) ? source.punishment : 'none';
  return {
    enabled: Boolean(source.enabled),
    channelId: cleanId(source.channelId),
    logChannelId: cleanId(source.logChannelId),
    punishment,
    timeoutMinutes: Math.max(1, Math.min(40320, Number(source.timeoutMinutes) || 10)),
    deleteMessage: source.deleteMessage !== false,
    ignoreAdmins: source.ignoreAdmins !== false,
    exemptRoleIds: Array.isArray(source.exemptRoleIds) ? source.exemptRoleIds.map(cleanId).filter(Boolean).slice(0, 25) : []
  };
}

export async function PATCH(request) {
  try {
    const session = await getDashboardSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 });
    const body = await request.json();
    const current = await getSettings(session.guildId);
    const honeypot = sanitizeHoneypot(body?.honeypot);
    const savedSettings = await saveSettings(session.guildId, { ...current, honeypot }, 'website');
    return NextResponse.json({ ok: true, settings: savedSettings.honeypot });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Honeypot konnte nicht gespeichert werden.' }, { status: 500 });
  }
}
