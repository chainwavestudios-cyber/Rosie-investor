/**
 * validateVaultPhones — Validates pending LeadVaultEntry phone numbers via
 * Omkar Carrier Lookup API. Rotates through a pool of API keys (each with its
 * own 100/month quota) so multiple free-tier keys can be stacked. Returns
 * progress + remaining across all keys.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

const OMKAR_URL = 'https://carrier-lookup-api.omkar.cloud/lookup';
const PER_KEY_LIMIT = 100;

function toE164(phone: string): string {
  if (!phone) return '';
  let p = phone.trim();
  if (p.startsWith('+')) return p;
  const digits = p.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits[0] === '1') return '+' + digits;
  if (digits.length > 6) return '+' + digits;
  return '';
}

/** Load all available Omkar API keys from secrets (key1, key2, ... up to 10). */
function loadKeyPool(): { label: string; apiKey: string }[] {
  const pool: { label: string; apiKey: string }[] = [];
  const primary = secrets.get('PHONE_LOOKUP_API_KEY') || '';
  if (primary) pool.push({ label: 'key1', apiKey: primary });
  for (let i = 2; i <= 10; i++) {
    const k = secrets.get(`PHONE_LOOKUP_API_KEY_${i}`) || '';
    if (k) pool.push({ label: `key${i}`, apiKey: k });
  }
  return pool;
}

async function carrierLookup(phone: string, apiKey: string): Promise<{
  isValid: boolean; lineType: string; carrier: string; e164: string; quotaHit: boolean;
} | null> {
  const e164 = toE164(phone);
  if (!e164 || !apiKey) return null;
  try {
    const res = await fetch(
      `${OMKAR_URL}?phone=${encodeURIComponent(e164)}`,
      { headers: { 'API-Key': apiKey }, signal: AbortSignal.timeout(12000) }
    );
    // 429 = rate limited / quota exhausted for this key
    if (res.status === 429) return { isValid: false, lineType: 'unknown', carrier: '', e164: '', quotaHit: true };
    if (!res.ok) return null;
    const data = await res.json();
    const lt = (data?.line_type || 'unknown').toLowerCase();
    const lineType = lt.includes('voip') ? 'voip' : lt.includes('mobile') ? 'mobile' : lt.includes('landline') || lt.includes('fixed') || lt === 'landline' ? 'landline' : 'unknown';
    return {
      isValid: data?.is_valid_number === true,
      lineType,
      carrier: data?.carrier || '',
      e164: data?.phone_number || e164,
      quotaHit: false,
    };
  } catch {
    return null;
  }
}

function getMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Fronter/manager users authenticate via DebtCoachAuth (custom), not Base44
    // platform auth, so base44.auth.me() throws for them. All entity operations
    // below use asServiceRole, so the user auth check is non-fatal.
    try { await base44.auth.me(); } catch {}

    const body = await req.json();
    const { batchLabel, maxCount } = body || {};
    const limit = Math.min(Math.max(1, maxCount || 50), 50);

    // ── Load key pool ──
    const keyPool = loadKeyPool();
    if (keyPool.length === 0) return Response.json({ error: 'No PHONE_LOOKUP_API_KEY secrets set' }, { status: 500 });

    // ── Get or create usage record for each key this month ──
    const monthKey = getMonthKey();
    const usageByLabel: Record<string, { id: string; requestCount: number; monthlyLimit: number }> = {};
    for (const k of keyPool) {
      const existing = await base44.asServiceRole.entities.PhoneValidationUsage.filter({ monthKey, keyLabel: k.label });
      let rec = existing?.[0];
      if (!rec) {
        rec = await base44.asServiceRole.entities.PhoneValidationUsage.create({
          monthKey, keyLabel: k.label, requestCount: 0, monthlyLimit: PER_KEY_LIMIT,
        });
      }
      usageByLabel[k.label] = { id: rec.id, requestCount: rec.requestCount || 0, monthlyLimit: rec.monthlyLimit || PER_KEY_LIMIT };
    }

    // ── Total remaining across all keys ──
    const totalRemaining = keyPool.reduce((sum, k) => {
      const u = usageByLabel[k.label];
      return sum + Math.max(0, (u.monthlyLimit) - u.requestCount);
    }, 0);

    if (totalRemaining <= 0) {
      return Response.json({ error: 'All API keys exhausted for this month', remaining: 0, used: keyPool.reduce((s, k) => s + usageByLabel[k.label].requestCount, 0), limit: keyPool.length * PER_KEY_LIMIT, keyCount: keyPool.length });
    }

    const toValidate = Math.min(limit, totalRemaining);

    // ── Fetch pending entries ──
    const query: any = { validationStatus: 'pending', destination: 'none' };
    if (batchLabel) query.batchLabel = batchLabel;
    const page = await base44.asServiceRole.entities.LeadVaultEntry.filter(query, { sort: 'created_date', limit: toValidate });
    const entries = page?.items || page || [];

    if (!entries || entries.length === 0) {
      return Response.json({ validated: 0, remaining: totalRemaining, used: keyPool.reduce((s, k) => s + usageByLabel[k.label].requestCount, 0), limit: keyPool.length * PER_KEY_LIMIT, keyCount: keyPool.length, done: true });
    }

    // ── Validate, rotating keys when one hits its limit ──
    let validated = 0;
    let apiCalls = 0;
    const updateBatch: any[] = [];
    // Track per-key call counts for batch increment
    const callsPerKey: Record<string, number> = {};
    keyPool.forEach(k => { callsPerKey[k.label] = 0; });

    // Start with the first key that has remaining quota
    let keyIdx = 0;
    const pickActiveKey = () => {
      while (keyIdx < keyPool.length) {
        const k = keyPool[keyIdx];
        const u = usageByLabel[k.label];
        if (u.requestCount + callsPerKey[k.label] < u.monthlyLimit) return k;
        keyIdx++;
      }
      return null;
    };

    for (let i = 0; i < entries.length; i += 6) {
      const batch = entries.slice(i, i + 6);
      const results = await Promise.allSettled(batch.map(async (entry) => {
        let activeKey = pickActiveKey();
        if (!activeKey) return { entry, result: null, exhausted: true };
        let result = await carrierLookup(entry.phone, activeKey.apiKey);
        // If quota hit on this key, try the next one
        if (result?.quotaHit) {
          keyIdx++;
          const nextKey = pickActiveKey();
          if (nextKey) {
            result = await carrierLookup(entry.phone, nextKey.apiKey);
            activeKey = nextKey;
          } else {
            return { entry, result: null, exhausted: true };
          }
        }
        if (result && !result.quotaHit) callsPerKey[activeKey.label]++;
        return { entry, result, exhausted: false };
      }));

      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        const { entry, result, exhausted } = r.value;
        if (exhausted) break;
        apiCalls++;
        if (!result) {
          updateBatch.push({ id: entry.id, data: { validationStatus: 'failed', validatedAt: new Date().toISOString() } });
        } else {
          updateBatch.push({
            id: entry.id,
            data: {
              validationStatus: 'validated',
              phoneValid: result.isValid,
              phoneLineType: result.lineType,
              phoneCarrier: result.carrier,
              phoneE164: result.e164,
              validatedAt: new Date().toISOString(),
            },
          });
          validated++;
        }
      }
      if (keyIdx >= keyPool.length) break; // all keys exhausted
    }

    // ── Update entries ──
    if (updateBatch.length > 0) {
      await base44.asServiceRole.entities.LeadVaultEntry.bulkUpdate(
        updateBatch.map(u => ({ id: u.id, ...u.data }))
      );
    }

    // ── Increment usage per key ──
    for (const k of keyPool) {
      if (callsPerKey[k.label] > 0) {
        const u = usageByLabel[k.label];
        await base44.asServiceRole.entities.PhoneValidationUsage.update(u.id, {
          requestCount: u.requestCount + callsPerKey[k.label],
        });
      }
    }

    const totalUsed = keyPool.reduce((s, k) => s + usageByLabel[k.label].requestCount + callsPerKey[k.label], 0);
    const totalLimit = keyPool.length * PER_KEY_LIMIT;
    const newRemaining = totalLimit - totalUsed;

    return Response.json({
      validated,
      apiCalls,
      remaining: newRemaining,
      used: totalUsed,
      limit: totalLimit,
      keyCount: keyPool.length,
      done: entries.length < toValidate,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}