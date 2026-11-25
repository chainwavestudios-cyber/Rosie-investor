const CONTRACT = 'rosie.core.live_assistance.v1';
const PRODUCT_APP_ID = {
  bob: '6aeab8051a8d4e4d8019bf2b',
  investor: '69cd2741578c9b5ce655395b',
};
const CORE_ORIGINS = new Set([
  'https://preview--6aeabe88ef37542746e10df3--b-7591f83.base44.app',
  'https://preview-sandbox--6aeabe88ef37542746e10df3--b-7591f83.base44.app',
  'https://rosie-ai-core-46e10df3.base44.app',
  'https://core.rosieai.tech',
]);
const CORE_PATH = '/api/apps/6aeabe88ef37542746e10df3/functions/coreLiveAssistance';
const encoder = new TextEncoder();

export async function requestCoreLiveAssistance({ appKey, secret, coreOrigin, organizationId,
  userId, sessionId, requestId, service, mode, question, transcript,
  fetchImpl = fetch, now = Date.now() }) {
  if (!Object.hasOwn(PRODUCT_APP_ID, appKey) || typeof secret !== 'string' || secret.length < 32) {
    throw Error('core_live_service_identity_unavailable');
  }
  if (!CORE_ORIGINS.has(coreOrigin)) throw Error('core_live_transport_not_configured');
  const raw = JSON.stringify({ app_key: appKey, contract: CONTRACT,
    organization_id: organizationId, user_id: userId, session_id: sessionId,
    request_id: requestId, service, mode, question, transcript });
  if (encoder.encode(raw).length > 32768) throw Error('core_live_request_too_large');
  const time = String(Math.floor(now / 1000));
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(time + '.' + raw));
  const signature = 'sha256=' + Array.from(new Uint8Array(signed),
    byte => byte.toString(16).padStart(2, '0')).join('');
  const response = await fetchImpl(coreOrigin + CORE_PATH, {
    method: 'POST', redirect: 'manual', body: raw, signal: AbortSignal.timeout(32000),
    headers: { 'content-type': 'application/json', 'x-rosie-app': appKey,
      'x-rosie-source-app-id': PRODUCT_APP_ID[appKey], 'x-rosie-environment': 'staging',
      'x-rosie-timestamp': time, 'x-rosie-signature': signature },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const code = result?.contract === CONTRACT && /^[a-z_]{5,80}$/.test(result.error)
      ? result.error : 'core_live_service_unavailable';
    throw Error(code);
  }
  if (result?.contract !== CONTRACT || result.success !== true || result.request_id !== requestId ||
      result.ledger?.status !== 'finalized' || result.usage?.settlementStatus !== 'committed') {
    throw Error('core_live_invalid_receipt');
  }
  return result;
}
