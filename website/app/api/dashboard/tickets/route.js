import { NextResponse } from 'next/server';
import { getDashboardSession, getGuildInfo, listTickets, queueDashboardAction } from '../../../../lib/dashboard';

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

export async function PATCH(request) {
  try {
    const session = await getDashboardSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const id = String(body.id || '').trim();
    const action = String(body.action || '').trim();
    if (!/^[A-Za-z0-9-]{4,64}$/.test(id)) {
      return NextResponse.json({ ok: false, error: 'Ungültige Ticket-ID.' }, { status: 400 });
    }
    const allowed = new Set(['close', 'reopen', 'lock', 'unlock', 'claim', 'priority']);
    if (!allowed.has(action)) {
      return NextResponse.json({ ok: false, error: 'Unbekannte Ticket-Aktion.' }, { status: 400 });
    }

    const payload = { id };
    if (action === 'priority') {
      const priority = String(body.priority || '');
      if (!['low', 'normal', 'high', 'urgent'].includes(priority)) {
        return NextResponse.json({ ok: false, error: 'Ungültige Priorität.' }, { status: 400 });
      }
      payload.priority = priority;
    }
    if (action === 'close') payload.reason = String(body.reason || 'Über Dashboard geschlossen').trim().slice(0, 1000);

    const mapped = {
      close: 'close_ticket',
      reopen: 'reopen_ticket',
      lock: 'lock_ticket',
      unlock: 'unlock_ticket',
      claim: 'claim_ticket',
      priority: 'ticket_priority'
    }[action];

    const queued = await queueDashboardAction(session.guildId, mapped, payload, session.actorId || session.id);
    return NextResponse.json({ ok: true, queued: Boolean(queued), action: mapped, ticketId: id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Ticket-Aktion konnte nicht angelegt werden.' }, { status: 500 });
  }
}
