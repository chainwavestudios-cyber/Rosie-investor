// Copy this server-only adapter with the pinned Call Intelligence contract into each host.
const contract = 'rosie.core.call_intelligence.post_call.v1';
const appIds = { bob: '6aeab8051a8d4e4d8019bf2b', investor: '69cd2741578c9b5ce655395b' };
const coreAppId = '6aeabe88ef37542746e10df3';
const approvedCore = /^(?:https:\/\/rosie-ai-core-46e10df3\.base44\.app|https:\/\/(?:preview(?:-sandbox)?|checkpoint)--6aeabe88ef37542746e10df3--[a-z0-9-]+\.base44\.app)$/;
const encode = new TextEncoder();
const statuses = new Set(['queued', 'processing', 'reconciliation_required', 'metering', 'completed', 'failed']);

function validTerminalReceipt(ledger, usage) {
  const micros = value => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000;
  return ledger?.status === 'finalized' && typeof ledger.eventId === 'string' &&
    /^rosie-ai:reservation:[1-9][0-9]{0,19}$/.test(ledger.eventId) &&
    micros(ledger.consumedMicros) && micros(ledger.refundedMicros) &&
    ledger.consumedMicros + ledger.refundedMicros <= 1_000_000_000 &&
    usage?.provider === 'anthropic' && usage.billingMode === 'staging_credit' && typeof usage.providerRequestId === 'string' &&
    /^msg_[A-Za-z0-9_-]{8,130}$/.test(usage.providerRequestId) && Number.isSafeInteger(usage.inputTokens) &&
    usage.inputTokens > 0 && Number.isSafeInteger(usage.outputTokens) && usage.outputTokens > 0;
}

export function makeCorePostCallIntentClient({ appKey, origin, secret, fetchImpl = fetch }) {
  if (!Object.hasOwn(appIds, appKey) || typeof secret !== 'string' || secret.length < 32) {
    throw Error('core_post_call_identity_unavailable');
  }
  if (typeof origin !== 'string' || !approvedCore.test(origin) || new URL(origin).origin !== origin) {
    throw Error('core_post_call_transport_not_configured');
  }
  const url = origin + '/api/apps/' + coreAppId + '/functions/corePostCallIntent';
  return async function request({ scope, action, callSessionId, transcriptVersion, transcript = null,
    jobId = null, requestId = crypto.randomUUID() }) {
    const { organizationId, userId } = scope;
    const raw = JSON.stringify({ contract, app_key: appKey, organization_id: organizationId, user_id: userId,
      request_id: requestId, call_session_id: callSessionId, action, transcript_version: transcriptVersion,
      transcript, job_id: jobId });
    if (encode.encode(raw).byteLength > 65_536) throw Error('core_post_call_request_too_large');
    const time = String(Math.floor(Date.now() / 1000));
    const key = await crypto.subtle.importKey('raw', encode.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const proof = await crypto.subtle.sign('HMAC', key, encode.encode(time + '.' + raw));
    const signature = 'sha256=' + Array.from(new Uint8Array(proof), byte => byte.toString(16).padStart(2, '0')).join('');
    const response = await fetchImpl(url, {
      method: 'POST', redirect: 'manual', body: raw, signal: AbortSignal.timeout(32_000),
      headers: { 'content-type': 'application/json', 'x-rosie-app': appKey, 'x-rosie-source-app-id': appIds[appKey],
        'x-rosie-environment': 'staging', 'x-rosie-timestamp': time, 'x-rosie-signature': signature },
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw Error(result?.contract === contract && /^[a-z_]{5,80}$/.test(result.error)
        ? result.error : 'core_post_call_unavailable');
    }
    if (result?.contract !== contract || result.request_id !== requestId || result.app_key !== appKey ||
        result.call_session_id !== callSessionId || result.transcript_version !== transcriptVersion ||
        !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(result.job_id) ||
        (jobId && result.job_id !== jobId) || !statuses.has(result.status) ||
        typeof result.superseded !== 'boolean' ||
        (result.status === 'completed' && (!result.result || typeof result.result !== 'object' || Array.isArray(result.result))) ||
        (['completed', 'failed'].includes(result.status) && !validTerminalReceipt(result.ledger, result.usage)) ||
        (!['completed', 'failed'].includes(result.status) && (result.ledger || result.usage || result.result))) {
      throw Error('core_post_call_invalid_receipt');
    }
    return result;
  };
}
