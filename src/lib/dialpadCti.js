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
export function dialWithDialpad(phone, { outboundCallerId = '', customData = '' } = {}) {
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