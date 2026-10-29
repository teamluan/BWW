// BWW Phase 3 – Transcript-Service (03: Nachrichten sammeln -> HTML/TXT ->
// Supabase Storage bww-ticket-transcripts -> transcript_url/metadaten in DB).
// Nutzt services (supabase, logger). Kein Embed/Welcome-Code.

const { supabaseRequest, isConfigured, SUPABASE_URL, serviceHeaders } = require('../../services/supabase');
const { logger } = require('../../services/logger');
const { cleanId } = require('../../services/validation');

const log = logger.child('ticket:transcript');
const BUCKET = 'bww-ticket-transcripts';

function escapeHtml(s) {
  return String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

async function collectMessages(channel, max = 1000) {
  const out = [];
  let before = null;
  while (out.length < max) {
    const batch = await channel.messages.fetch(before ? { limit: 100, before } : { limit: 100 }).catch(() => null);
    if (!batch?.size) break;
    out.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100 || !before) break;
  }
  return out.sort((a, b) => a.createdTimestamp - b.createdTimestamp).slice(-max);
}

function buildText(messages, ticket) {
  const lines = [
    'BWW TICKET TRANSCRIPT',
    `Ticket: ${ticket.id} (#${ticket.ticket_number ?? '-'})`,
    `Status: ${ticket.status} | Priorität: ${ticket.priority}`,
    `Ersteller: ${ticket.creator_id || ticket.owner_id} | Typ: ${ticket.type_id || '-'}`,
    `Erstellt: ${ticket.created_at} | Export: ${new Date().toISOString()}`,
    '', '--- Nachrichten ---', '',
  ];
  for (const m of messages) {
    const atts = [...(m.attachments?.values?.() || [])].map((a) => a.url).join(' ');
    const body = String(m.content || '').trim();
    lines.push(`[${m.createdAt.toISOString()}] ${m.author?.tag} (${m.author?.id}): ${(body || '[keine Textnachricht]') + (atts ? ` [Anhänge] ${atts}` : '')}`);
  }
  return lines.join('\n');
}

function buildHtml(messages, ticket, guildName = '') {
  const rows = messages.map((m) => {
    const atts = [...(m.attachments?.values?.() || [])].map((a) => `<a href="${escapeHtml(a.url)}">${escapeHtml(a.name || 'Anhang')}</a>`).join(' ');
    return `<div class="msg"><div class="meta"><strong>${escapeHtml(m.author?.tag || '?')}</strong> <span>${escapeHtml(m.author?.id || '')}</span> <time>${escapeHtml(m.createdAt.toISOString())}</time></div><div class="body">${escapeHtml(m.content || '[keine Textnachricht]')}</div>${atts ? `<div class="atts">${atts}</div>` : ''}</div>`;
  }).join('\n');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Ticket ${escapeHtml(ticket.id)}</title><style>body{font-family:system-ui;background:#111;color:#eee;margin:0;padding:24px}.card{max-width:900px;margin:0 auto;background:#1a1a1a;border-radius:12px;padding:20px}.msg{border-top:1px solid #333;padding:10px 0}.meta{font-size:12px;color:#aaa}.body{white-space:pre-wrap;margin-top:4px}</style></head><body><div class="card"><h1>🎫 Ticket ${escapeHtml(ticket.id)} (#${escapeHtml(String(ticket.ticket_number ?? '-'))})</h1><p>Status ${escapeHtml(ticket.status)} · Priorität ${escapeHtml(ticket.priority)} · Server ${escapeHtml(guildName)}</p><p>Ersteller ${escapeHtml(ticket.creator_id || ticket.owner_id || '')} · Export ${escapeHtml(new Date().toISOString())}</p>${rows}</div></body></html>`;
}

async function uploadToStorage(objectPath, buffer, contentType) {
  if (!isConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`;
  const res = await fetch(url, { method: 'POST', headers: { ...serviceHeaders({ 'Content-Type': contentType, 'x-upsert': 'true' }), Prefer: undefined }, body: buffer });
  if (!res.ok) throw new Error(`Storage-Upload fehlgeschlagen (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return `${BUCKET}/${objectPath}`;
}

async function createTranscript(client, ticket) {
  const channelId = cleanId(ticket?.channel_id);
  if (!channelId) throw new Error('Ticket hat keinen Channel.');
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) throw new Error('Ticket-Channel nicht gefunden.');
  const messages = await collectMessages(channel, 1000);
  const text = buildText(messages, ticket);
  const html = buildHtml(messages, ticket, channel.guild?.name || '');
  const base = `${ticket.guild_id}/${ticket.id}-${Date.now()}`;
  const txtPath = await uploadToStorage(`${base}.txt`, Buffer.from(text, 'utf8'), 'text/plain; charset=utf-8');
  await uploadToStorage(`${base}.html`, Buffer.from(html, 'utf8'), 'text/html; charset=utf-8').catch((e) => log.warn('HTML-Upload fehlgeschlagen:', e.message));
  const transcriptUrl = txtPath;
  // Metadaten in DB (transcript_url) + Action
  try {
    const res = await supabaseRequest(`bww_tickets?id=eq.${encodeURIComponent(ticket.id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ transcript_url: transcriptUrl, updated_at: new Date().toISOString() }),
    });
    await res.json().catch(() => []);
  } catch (e) { log.warn('transcript_url speichern fehlgeschlagen:', e.message); }
  try {
    const { recordAction } = require('./ticketService');
    await recordAction(ticket.id, ticket.guild_id, null, 'transcript', null, transcriptUrl, { messages: messages.length });
  } catch {}
  return { url: transcriptUrl, messages: messages.length };
}

module.exports = { createTranscript, buildText, buildHtml, BUCKET };
