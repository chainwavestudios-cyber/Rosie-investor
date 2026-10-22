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

/**
 * App lines that have no env slot yet. Their inbound calls must still be
 * recognised as our own (not an out-of-app dial), and they ring the /fronter
 * inbound dialer directly instead of going to the AI agent.
 */
export const FRONTER_DIRECT_NUMBERS = ['+18662908994'];

/** Env-var outbound slots the dialer can place a call from. */
export const FROM_KEYS = [
  'TWILIO_FROM_NUMBER', 'TWILIO_FROM_NUMBER_2', 'TWILIO_FROM_NUMBER_3',
  'TWILIO_FROM_NUMBER_4', 'TWILIO_FROM_NUMBER_5', 'TWILIO_FROM_NUMBER_6',
];

export function envFromLines(): { key: string; number: string }[] {
  return FROM_KEYS
    .map((key) => ({ key, number: Deno.env.get(key) || '' }))
    .filter((l) => /^\+\d{10,}$/.test(l.number));
}

/** Every voice-capable number on the Twilio account (in case one has no env slot yet). */
export async function twilioVoiceNumbers(): Promise<string[]> {
  try {
    const data = await twilioFetch('/IncomingPhoneNumbers.json?PageSize=100');
    return (data.incoming_phone_numbers || []).filter((n: any) => n.capabilities?.voice).map((n: any) => n.phone_number);
  } catch { return []; }
}

/** Numbers currently carrying a live call, so a transfer leg never lands on a busy line. */
export async function twilioActiveFromNumbers(): Promise<string[]> {
  try {
    const data = await twilioFetch('/Calls.json?Status=in-progress&PageSize=200');
    return (data.calls || []).map((c: any) => c.from).filter(Boolean);
  } catch { return []; }
}

/**
 * Picks the line for a transfer / merge leg: a line no one is assigned to that is
 * not already on a call. Falls back to any unowned line, then to the preferred key.
 */
export function pickFreeLineKey(owned: string[], busy: string[], preferredKey: string, extraNumbers: string[] = []): string {
  const ownedSet = new Set(owned.map((v) => String(v).trim()).filter(Boolean));
  const busySet = new Set(busy.map((v) => String(v).trim()).filter(Boolean));
  const envLines = envFromLines();
  const known = new Set(envLines.map((l) => l.number));
  const candidates = [...envLines, ...extraNumbers.filter((n) => n && !known.has(n)).map((n) => ({ key: n, number: n }))];
  const free = candidates.find((l) => !ownedSet.has(l.number) && !ownedSet.has(l.key) && !busySet.has(l.number));
  const unowned = candidates.find((l) => !ownedSet.has(l.number) && !ownedSet.has(l.key));
  return free?.key || unowned?.key || preferredKey;
}