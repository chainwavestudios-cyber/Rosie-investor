/**
 * DialpadCti — the bridge to the embedded Dialpad Mini Dialer (CTI).
 *
 * The CTI lives in an iframe (https://dialpad.com/apps/open). It carries its own
 * login, call control, SMS and call-center status, and it is reached only through
 * window.postMessage — no API key involved.
 *
 * Calls are placed through the Chris B RA call center, so they go out on that
 * call center's line. Which of its two numbers shows as caller ID is the call
 * center's default; the agent can switch it in the dialer's own line picker, or
 * pass outboundCallerId here to force one.
 */
export const DIALPAD_CTI_URL = 'https://dialpad.com/apps/open';
export const DIALPAD_CTI_ORIGIN = 'https://dialpad.com';
export const DIALPAD_CCID = '5432587964293120';
export const DIALPAD_CALL_CENTER = 'Chris B RA';

/**
 * Where calls may go out from. The first entry forces no caller ID, so the call
 * center presents its own line — that is the only way its numbers appear instead
 * of the agent's personal desk line. The two numbers below are opt-in overrides.
 */
export const DIALPAD_LINES = [
  { key: 'center', label: 'Call center default', number: '' },
  { key: 'chris', label: 'Live call with Chris', number: '+16193530919' },
  { key: 'other', label: 'Other', number: '+12162586934' },
];

const LINE_KEY = 'dialpad_line_v2';

/** The line every call placed from the app goes out on. */
export function getDialpadLine() {
  try {
    return DIALPAD_LINES.find((l) => l.key === localStorage.getItem(LINE_KEY)) || DIALPAD_LINES[0];
  } catch {
    return DIALPAD_LINES[0];
  }
}

export function setDialpadLine(key) {
  if (!DIALPAD_LINES.some((l) => l.key === key)) return;
  try { localStorage.setItem(LINE_KEY, key); } catch {}
}

const digits = (value) => String(value || '').replace(/[^\d+]/g, '');

/**
 * The Dialpad line a lead may be dialed from.
 * When the card carries a consented number, that number is the only line it may
 * go out on — and only if it is one of the numbers assigned in this file. A
 * number we don't know blocks the call instead of falling back to another line.
 */
export function resolveDialpadLine(lead) {
  const consented = digits(lead?.tcpaCallerId);
  if (!consented) return { line: getDialpadLine(), error: '' };
  const match = DIALPAD_LINES.find((l) => l.number && digits(l.number) === consented);
  if (!match) {
    return {
      line: null,
      error: `This lead consented to be called from ${lead.tcpaCallerId}, which is not a Dialpad number on ${DIALPAD_CALL_CENTER}. Not dialing.`,
    };
  }
  return { line: match, error: '' };
}

let frameWindow = null;

export function registerDialpadFrame(win) {
  frameWindow = win || null;
}

export function unregisterDialpadFrame(win) {
  if (frameWindow === win) frameWindow = null;
}

export function isDialpadReady() {
  return !!frameWindow;
}

function post(method, payload) {
  if (!frameWindow) return false;
  frameWindow.postMessage(
    { api: 'opencti_dialpad', version: '1.0', method, ...(payload ? { payload } : {}) },
    DIALPAD_CTI_ORIGIN,
  );
  return true;
}

/** Make this tab the one the CTI rings and dials from. */
export function enableDialpadTab() {
  return post('enable_current_tab');
}

export function hangUpDialpadCalls() {
  return post('hang_up_all_calls');
}

/**
 * Place a call through the Chris B RA call center.
 * Returns false when the dialer is not mounted, so the caller can fall back.
 */
export function dialWithDialpad(phone, { outboundCallerId = getDialpadLine().number, customData = '' } = {}) {
  const number = String(phone || '').replace(/[^\d+]/g, '');
  if (!number) return false;
  return post('initiate_call', {
    enable_current_tab: true,
    phone_number: number,
    identity_type: 'CallCenter',
    identity_id: Number(DIALPAD_CCID),
    ...(outboundCallerId ? { outbound_caller_id: outboundCallerId } : {}),
    ...(customData ? { custom_data: String(customData).slice(0, 2000) } : {}),
  });
}