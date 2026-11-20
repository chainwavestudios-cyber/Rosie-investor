/**
 * Fail-closed reconciliation of a Core ticket, War Room claim, and independently
 * authenticated Neon lease receipt. Pure policy check, NOT signature verification
 * or an endpoint. The caller must independently authenticate the gateway reply
 * before passing authenticated=true; never accept that flag from a browser.
 */
const scalar = value => typeof value === 'string' && value.trim().length > 0;

export function verifyTicketLeaseProof({ ticket, claim, gatewayProof, now = Date.now() } = {}) {
  const deny = reason => ({ accepted: false, reason });
  if (!ticket || !claim || !gatewayProof) return deny('missing_evidence');
  if (gatewayProof.authenticated !== true || gatewayProof.source !== 'neon_lease_gateway') {
    return deny('untrusted_gateway');
  }
  if (claim.status !== 'claimed' || gatewayProof.event_type !== 'claim') return deny('invalid_claim_state');

  const fields = ['ticket_key', 'organization_id', 'job_id', 'seat_id', 'lease_token'];
  for (const field of fields) {
    if (![ticket[field], claim[field], gatewayProof[field]].every(scalar) ||
        ticket[field] !== claim[field] || claim[field] !== gatewayProof[field]) {
      return deny(`mismatched_${field}`);
    }
  }
  if (!scalar(gatewayProof.receipt_id)) return deny('missing_receipt_id');
  const fences = [ticket.fencing_token, claim.fencing_token, gatewayProof.fencing_token];
  if (!fences.every(n => Number.isSafeInteger(n) && n > 0) || !fences.every(n => n === fences[0])) {
    return deny('mismatched_fencing_token');
  }
  if (ticket.tenant_verified !== true || claim.tenant_verified !== true) return deny('tenant_unverified');
  if (!Number.isFinite(now)) return deny('invalid_clock');
  const expires = [claim.lease_until, gatewayProof.lease_until].map(v =>
    typeof v === 'string' && v.trim() ? Date.parse(v) : Number.NaN
  );
  if (expires.some(t => !Number.isFinite(t) || t <= now) || expires[0] !== expires[1]) {
    return deny('expired_or_mismatched_lease');
  }
  return { accepted: true, reason: 'verified_claim_policy', receipt_id: gatewayProof.receipt_id };
}
