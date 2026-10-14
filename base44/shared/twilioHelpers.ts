/**
 * twilioHelpers.ts — Shared Twilio utility functions used by fronterCall,
 * aiAgentDial, and other Twilio-backed backend functions.
 */

export const ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
export const AUTH_TOKEN   = Deno.env.get('TWILIO_AUTH_TOKEN')  || '';
export const twilioBase   = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}`;
export const twilioAuth   = 'Basic ' + btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);

export function lineNumber(lineKey: string): string {
  if (lineKey && lineKey.startsWith('+')) return lineKey; // already a phone number (line without env var)
  return (lineKey && Deno.env.get(lineKey)) || Deno.env.get('TWILIO_FROM_NUMBER') || '';
}

export function toE164(raw: string): string {
  const s = String(raw || '').trim();
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return s.startsWith('+') ? `+${digits}` : `+${digits}`;
}

export function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function twilioFetch(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(`${twilioBase}${path}`, {
    ...opts,
    headers: {
      Authorization: twilioAuth,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(opts.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.message || `Twilio error ${res.status}`);
    error.status = res.status;
    error.twilioCode = data.code;
    throw error;
  }
  return data;
}

export function confTwiML(name: string, muted = false, waitUrl = ''): string {
  const escName = xmlEscape(name);
  const waitAttr = waitUrl ? ` waitUrl="${xmlEscape(waitUrl)}" waitMethod="GET"` : '';
  return `<Response><Dial><Conference name="${escName}" muted="${muted}" beep="false" startConferenceOnEnter="true" endConferenceOnExit="false"${waitAttr}>${escName}</Conference></Dial></Response>`;
}

export async function findConferenceSid(name: string): Promise<string | null> {
  const data = await twilioFetch(`/Conferences.json?FriendlyName=${encodeURIComponent(name)}&Status=in-progress`);
  return data.conferences?.[0]?.sid || null;
}

export async function waitForConference(name: string): Promise<string | null> {
  for (let i = 0; i < 12; i++) {
    const sid = await findConferenceSid(name);
    if (sid) return sid;
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
}