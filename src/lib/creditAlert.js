/**
 * creditAlert.js — Global credit exhaustion alert system.
 * Dispatches and listens for window events when Deepgram or Anthropic/AI credits run out.
 * Any component can call notifyCreditExhaustion('deepgram' | 'anthropic') to trigger the popup.
 */

// Dispatch a credit exhaustion event that the CreditAlertPopup listens for.
export function notifyCreditExhaustion(service, detail = '') {
  window.dispatchEvent(new CustomEvent('credit-exhaustion', { detail: { service, detail } }));
}

// Check a thrown error for credit/quota exhaustion indicators.
// Returns { service, detail } if it looks like a credit error, or null otherwise.
export function checkErrorForCreditError(e) {
  const msg = (e?.message || String(e || '')).toLowerCase();
  if (msg.includes('credit_exhausted') || msg.includes('creditexhausted')) {
    const service = msg.includes('deepgram') ? 'deepgram' : 'anthropic';
    return { service, detail: e?.message || '' };
  }
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('rate_limit')) {
    return { service: 'anthropic', detail: e?.message || '' };
  }
  if (msg.includes('402') || msg.includes('payment required') || msg.includes('insufficient') || msg.includes('quota')) {
    return { service: 'anthropic', detail: e?.message || '' };
  }
  return null;
}

// Check an AI function response object for credit error indicators.
export function checkAIResponseForCreditError(res) {
  if (!res) return null;
  if (res.creditError) {
    return { service: res.creditService || 'anthropic', detail: res.error || '' };
  }
  return null;
}