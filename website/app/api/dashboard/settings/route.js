import { NextResponse } from 'next/server';
import { getDashboardSession, getGuildInfo, getSettings, saveSettings } from '../../../../lib/dashboard';

export async function GET() {
  try {
    const session = await getDashboardSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 });
    return NextResponse.json({
      ok: true,
      guild: await getGuildInfo(session.guildId),
      settings: await getSettings(session.guildId)
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Laden fehlgeschlagen.' }, { status: 500 });
  }
}

function sanitize(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const cleanText = (value, max = 4000) => String(value ?? '').slice(0, max);
  const cleanId = (value) => cleanText(value, 32).replace(/[^0-9]/g, '');
  const permissions = {};
  if (source.permissions && typeof source.permissions === 'object' && !Array.isArray(source.permissions)) {
    for (const [command, roles] of Object.entries(source.permissions).slice(0, 100)) {
      permissions[cleanText(command, 64)] = Array.isArray(roles)
        ? roles.map(cleanId).filter(Boolean).slice(0, 25)
        : [];
    }
  }

  return {
    welcome: {
      enabled: Boolean(source.welcome?.enabled),
      channelId: cleanId(source.welcome?.channelId),
      title: cleanText(source.welcome?.title, 256),
      message: cleanText(source.welcome?.message)
    },
    verify: {
      enabled: Boolean(source.verify?.enabled),
      channelId: cleanId(source.verify?.channelId),
      message: cleanText(source.verify?.message),
      roleId: cleanId(source.verify?.roleId)
    },
    ticket: {
      enabled: Boolean(source.ticket?.enabled),
      categoryId: cleanId(source.ticket?.categoryId),
      roleId: cleanId(source.ticket?.roleId),
      logChannelId: cleanId(source.ticket?.logChannelId),
      transcriptEnabled: source.ticket?.transcriptEnabled !== false,
      closeDelete: source.ticket?.closeDelete !== false,
      allowUserClose: source.ticket?.allowUserClose !== false,
      maxOpenPerUser: Math.max(1, Math.min(5, Number(source.ticket?.maxOpenPerUser) || 1))
    },
    status: {
      enabled: Boolean(source.status?.enabled),
      channelId: cleanId(source.status?.channelId),
      messageId: cleanId(source.status?.messageId),
      mode: ['online', 'offline', 'maintenance'].includes(source.status?.mode) ? source.status.mode : 'online'
    },
    honeypot: {
      enabled: Boolean(source.honeypot?.enabled),
      channelId: cleanId(source.honeypot?.channelId),
      logChannelId: cleanId(source.honeypot?.logChannelId),
      punishment: ['none', 'kick', 'ban', 'timeout'].includes(source.honeypot?.punishment) ? source.honeypot.punishment : 'none',
      timeoutMinutes: Math.max(1, Math.min(40320, Number(source.honeypot?.timeoutMinutes) || 10)),
      deleteMessage: source.honeypot?.deleteMessage !== false,
      ignoreAdmins: source.honeypot?.ignoreAdmins !== false,
      exemptRoleIds: Array.isArray(source.honeypot?.exemptRoleIds) ? source.honeypot.exemptRoleIds.map(cleanId).filter(Boolean).slice(0, 25) : []
    },
    permissions
  };
}

export async function PATCH(request) {
  try {
    const session = await getDashboardSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Nicht angemeldet.' }, { status: 401 });
    const body = await request.json();
    const current = await getSettings(session.guildId);
    const clean = sanitize(body?.settings);
    if (current.status?.channelId !== clean.status.channelId) clean.status.messageId = '';
    const saved = await saveSettings(session.guildId, clean, 'website');
    return NextResponse.json({ ok: true, settings: saved });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Speichern fehlgeschlagen.' }, { status: 500 });
  }
}
