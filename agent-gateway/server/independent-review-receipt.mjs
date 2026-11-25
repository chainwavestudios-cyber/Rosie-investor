export const reviewReceiptContract = 'rosie.core.independent-review.receipt.v1';
const reviewerRoles = {A05: 'rosieeyez', A14: 'check_agent'};
const fields = ['contract', 'assignment_id', 'repository_id', 'pull_number', 'head_sha',
  'base_sha', 'reviewer_id', 'reviewer_role', 'evidence_sha256', 'verdict', 'issued_at'];
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const sha = /^[a-f0-9]{40}$/;
const sha256 = /^[a-f0-9]{64}$/;
const workload = /^srv-[a-z0-9]{12,64}$/;
const verdicts = ['accept', 'reject', 'veto'];
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const matches = (value, pattern) => typeof value === 'string' && pattern.test(value);
const decode = input => Uint8Array.from(atob(input), character => character.charCodeAt(0));

export function reviewReceiptBytes(receipt) {
  return new TextEncoder().encode(JSON.stringify(fields.map(field => receipt[field])));
}

export async function verifyIndependentReviewReceipt(receipt, assignment, registry, now = Date.now()) {
  if (!receipt || !assignment || !registry || !Number.isSafeInteger(now) ||
      Object.keys(receipt).length !== fields.length + 1 ||
      !fields.every(field => Object.hasOwn(receipt, field)) ||
      receipt.contract !== reviewReceiptContract ||
      !matches(receipt.assignment_id, uuid) || receipt.assignment_id !== assignment.id ||
      !positiveInteger(receipt.repository_id) || receipt.repository_id !== assignment.repository_id ||
      !positiveInteger(receipt.pull_number) || receipt.pull_number !== assignment.pull_number ||
      !matches(receipt.head_sha, sha) || receipt.head_sha !== assignment.head_sha ||
      !matches(receipt.base_sha, sha) || receipt.base_sha !== assignment.base_sha ||
      !matches(receipt.evidence_sha256, sha256) || !verdicts.includes(receipt.verdict) ||
      !matches(receipt.reviewer_id, workload) || receipt.reviewer_id === assignment.implementer_id ||
      !Number.isSafeInteger(receipt.issued_at) || !Number.isSafeInteger(assignment.issued_at) ||
      receipt.issued_at < assignment.issued_at || receipt.issued_at > now + 30000 ||
      !matches(receipt.signature, /^[A-Za-z0-9+/]{86}==$/) ||
      !Object.hasOwn(reviewerRoles, assignment.agent_id) ||
      receipt.reviewer_role !== reviewerRoles[assignment.agent_id] ||
      (receipt.verdict === 'veto' && assignment.agent_id !== 'A05')) return false;

  const [a05, a14] = [registry.A05, registry.A14];
  if (!a05 || !a14 || a05.id === a14.id ||
      !matches(a05.id, workload) || !matches(a14.id, workload) ||
      !matches(a05.public_key, /^[A-Za-z0-9+/]{43}=$/) ||
      !matches(a14.public_key, /^[A-Za-z0-9+/]{43}=$/)) return false;
  const signer = registry[assignment.agent_id];
  if (signer.revoked_at || signer.id !== receipt.reviewer_id ||
      !Number.isSafeInteger(signer.enrolled_at) || receipt.issued_at < signer.enrolled_at) return false;

  try {
    const first = decode(a05.public_key);
    const second = decode(a14.public_key);
    if (first.every((byte, index) => byte === second[index])) return false;
    const key = await crypto.subtle.importKey('raw', decode(signer.public_key), 'Ed25519', false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, decode(receipt.signature), reviewReceiptBytes(receipt));
  } catch {
    return false;
  }
}
