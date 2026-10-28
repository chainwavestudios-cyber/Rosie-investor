/**
 * Recipient-specific, public welcome page interaction telemetry.
 * Every event is resolved through the same unguessable EmailMessage token
 * used for Gmail open/click tracking. Never accepts a browser-supplied lead ID.
 */
import { resolveMessageToken } from './emailMessageEngine.ts';

const events = new Set(['page_view','play','pause','progress','ended','replay','calendar_open','calendar_external','website_click']);
const items = (p: any) => Array.isArray(p) ? p : (p?.items || []);
const num = (v: any, max = 10000) => Number.isFinite(Number(v)) ? Math.min(max, Math.max(0, Number(v))) : 0;
const reply = (data: any, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function welcomeEngagement(base44: any, body: any): Promise<Response> {
  const token = String(body.token || '').trim();
  if (!/^m_[A-Za-z0-9_-]{24}$/.test(token)) return reply({ error: 'Invalid link' }, 400);
  const message = await resolveMessageToken(base44, token);
  if (!message || message.status !== 'sent' || message.contactKind !== 'debt_lead' || !message.sendId || message.source === 'campaign') return reply({ error: 'Link not found' }, 404);
  const svc = base44.asServiceRole.entities;
  // The welcome page is audio + calendar only. Never mint a Protoface token,
  // invoke an AI assistant, or modify the lead simply because they visit.
  if (body.event === 'config') return reply({ ok: true, hasBookingCalendar: true });
  const event = String(body.event || '');
  const sessionId = String(body.sessionId || '');
  if (!events.has(event) || !/^[A-Za-z0-9_-]{12,80}$/.test(sessionId)) return reply({ error: 'Invalid event' }, 400);
  const entity = svc.EmailAudioEngagement;
  const existing = items(await entity.filter({ sendId: String(message.sendId), sessionId }, { limit: 1 }).catch(() => []))[0];
  const now = new Date().toISOString();
  const duration = Math.max(num(existing?.durationSeconds, 3600), num(body.durationSeconds, 3600));
  const played = Math.max(num(existing?.playedSeconds, duration || 3600), num(body.playedSeconds, duration || 3600));
  const percent = duration > 0 ? Math.round(Math.min(100, (played / duration) * 100)) : 0;
  const base = {
    sendId: String(message.sendId), contactId: String(message.contactId || ''), templateId: String(message.templateId || ''), sessionId,
    playedSeconds: played, durationSeconds: duration, percentListened: percent,
    maxPositionSeconds: Math.max(num(existing?.maxPositionSeconds, 3600), num(body.maxPositionSeconds, 3600)),
    playCount: Number(existing?.playCount || 0) + (event === 'play' ? 1 : 0),
    pauseCount: Number(existing?.pauseCount || 0) + (event === 'pause' ? 1 : 0),
    completed: !!existing?.completed || (event === 'ended' && percent >= 90),
    completedAt: existing?.completedAt || (event === 'ended' && percent >= 90 ? now : null),
    calendarOpenedAt: existing?.calendarOpenedAt || (event === 'calendar_open' ? now : null),
    calendarExternalAt: existing?.calendarExternalAt || (event === 'calendar_external' ? now : null),
    calendarExternalClicks: Number(existing?.calendarExternalClicks || 0) + (event === 'calendar_external' ? 1 : 0),
    websiteClickedAt: existing?.websiteClickedAt || (event === 'website_click' ? now : null),
    websiteClicks: Number(existing?.websiteClicks || 0) + (event === 'website_click' ? 1 : 0),
    firstAt: existing?.firstAt || now, lastAt: now, lastEvent: event,
  };
  try {
    if (existing) await entity.update(existing.id, base);
    else await entity.create(base);
    return reply({ ok: true });
  } catch {
    return reply({ error: 'Could not record activity' }, 503);
  }
}
