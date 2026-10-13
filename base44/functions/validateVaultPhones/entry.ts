/**
 * validateVaultPhones — Validates pending LeadVaultEntry phone numbers via
 * Omkar Carrier Lookup API. Rotates through a pool of API keys (each with its
 * own 100/month quota) so multiple free-tier keys can be stacked. Returns
 * progress + remaining across all keys.
 *
 * Modes:
 *   - "pending" (default): validate entries with validationStatus='pending'
 *   - "retry_failed": re-validate entries with validationStatus='failed'
 *   - "all": process all pending+failed in one call (loops internally up to quota)
 *   - "twilio": use Twilio Lookup API instead of Omkar (paid, ~$0.004/lookup)
 *   - "diagnostic": test each Omkar key with one lookup
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

interface LookupResult {
  isValid: boolean;
  lineType: string;
  carrier: string;
  e164: string;
  quotaHit: boolean;
  error?: string;
}

async function carrierLookup(phone: string, apiKey: string): Promise<LookupResult | null> {
  const e164 = toE164(phone);
  if (!e164 || !apiKey) return null;
  try {
    const res = await fetch(
      `${OMKAR_URL}?phone=${encodeURIComponent(e164)}`,
      { headers: { 'API-Key': apiKey }, signal: AbortSignal.timeout(15000) }
    );
    // 429 = rate limited / quota exhausted for this key
    if (res.status === 429) return { isValid: false, lineType: 'unknown', carrier: '', e164: '', quotaHit: true };
    if (!res.ok) {
      // Capture error info for diagnostics — don't just silently return null
      let body = '';
      try { body = await res.text(); } catch {}
      return { isValid: false, lineType: 'unknown', carrier: '', e164: '', quotaHit: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
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
  } catch (e) {
    return { isValid: false, lineType: 'unknown', carrier: '', e164: '', quotaHit: false, error: e?.message || 'fetch_failed' };
  }
}

/** Twilio Lookup API fallback — uses existing TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN. */
async function twilioLookup(phone: string): Promise<LookupResult | null> {
  const e164 = toE164(phone);
  const sid = secrets.get('TWILIO_ACCOUNT_SID') || '';
  const token = secrets.get('TWILIO_AUTH_TOKEN') || '';
  if (!e164 || !sid || !token) return null;
  try {
    const auth = btoa(`${sid}:${token}`);
    const res = await fetch(
      `https://lookups.twilio.com/v1/PhoneNumbers/${encodeURIComponent(e164)}?Type=carrier`,
      { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(15000) }
    );
    if (res.status === 404) return { isValid: false, lineType: 'unknown', carrier: '', e164: '', quotaHit: false };
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch {}
      return { isValid: false, lineType: 'unknown', carrier: '', e164: '', quotaHit: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json();
    const lt = (data?.carrier?.type || 'unknown').toLowerCase();
    const lineType = lt.includes('voip') ? 'voip' : lt.includes('mobile') ? 'mobile' : lt.includes('landline') ? 'landline' : 'unknown';
    return {
      isValid: true, // Twilio returns 200 only for valid numbers
      lineType,
      carrier: data?.carrier?.name || '',
      e164: data?.phone_number || e164,
      quotaHit: false,
    };
  } catch (e) {
    return { isValid: false, lineType: 'unknown', carrier: '', e164: '', quotaHit: false, error: e?.message || 'fetch_failed' };
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
    const { batchLabel, maxCount, mode } = body || {};
    const retryFailed = mode === 'retry_failed' || mode === 'all';
    const processAll = mode === 'all';
    const diagnostic = mode === 'diagnostic';
    const useTwilio = mode === 'twilio';
    const limit = processAll ? 500 : Math.min(Math.max(1, maxCount || 50), 50);

    // ── Twilio Lookup API mode (paid fallback) ──
    if (useTwilio) {
      const sid = secrets.get('TWILIO_ACCOUNT_SID') || '';
      const token = secrets.get('TWILIO_AUTH_TOKEN') || '';
      if (!sid || !token) return Response.json({ error: 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN secrets required for Twilio mode' }, { status: 500 });

      const query: any = { destination: 'none' };
      query.$or = [{ validationStatus: 'pending' }, { validationStatus: 'failed' }];
      if (batchLabel) query.batchLabel = batchLabel;
      const page = await base44.asServiceRole.entities.LeadVaultEntry.filter(query, { sort: 'created_date', limit });
      const entries = page?.items || page || [];
      if (!entries || entries.length === 0) return Response.json({ validated: 0, apiCalls: 0, failedCalls: 0, provider: 'twilio', done: true });

      let validated = 0, apiCalls = 0, failedCalls = 0;
      const updateBatch: any[] = [];
      for (const entry of entries) {
        const result = await twilioLookup(entry.phone);
        apiCalls++;
        if (result?.error) {
          failedCalls++;
          updateBatch.push({ id: entry.id, data: { validationStatus: 'failed', validatedAt: new Date().toISOString() } });
        } else if (!result) {
          failedCalls++;
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
          if (result.isValid) validated++;
        }
      }
      if (updateBatch.length > 0) {
        await base44.asServiceRole.entities.LeadVaultEntry.bulkUpdate(updateBatch.map(u => ({ id: u.id, ...u.data })));
      }
      return Response.json({
        validated, apiCalls, failedCalls,
        provider: 'twilio',
        cost: `$${(apiCalls * 0.004).toFixed(2)}`,
        done: entries.length < limit,
      });
    }

    // ── Load key pool ──
    const keyPool = loadKeyPool();
    if (keyPool.length === 0) return Response.json({ error: 'No PHONE_LOOKUP_API_KEY secrets set' }, { status: 500 });

    // ── Diagnostic mode: test each key with one lookup ──
    if (diagnostic) {
      const testPhone = '+13125551212'; // standard test number
      const keyStatus: Record<string, any> = {};
      for (const k of keyPool) {
        const result = await carrierLookup(testPhone, k.apiKey);
        keyStatus[k.label] = {
          hasKey: !!k.apiKey,
          result: result ? { isValid: result.isValid, lineType: result.lineType, error: result.error, quotaHit: result.quotaHit } : null,
        };
      }
      return Response.json({ diagnostic: true, testPhone, keyStatus, keyCount: keyPool.length });
    }

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

    // ── Fetch entries to validate ──
    const query: any = { destination: 'none' };
    if (retryFailed) {
      query.$or = [{ validationStatus: 'pending' }, { validationStatus: 'failed' }];
    } else {
      query.validationStatus = 'pending';
    }
    if (batchLabel) query.batchLabel = batchLabel;
    const page = await base44.asServiceRole.entities.LeadVaultEntry.filter(query, { sort: 'created_date', limit: toValidate });
    const entries = page?.items || page || [];

    if (!entries || entries.length === 0) {
      return Response.json({ validated: 0, remaining: totalRemaining, used: keyPool.reduce((s, k) => s + usageByLabel[k.label].requestCount, 0), limit: keyPool.length * PER_KEY_LIMIT, keyCount: keyPool.length, done: true });
    }

    // ── Validate, rotating keys on ANY error (not just 429) ──
    // Process sequentially to avoid key-rotation race conditions when keys fail.
    let validated = 0;
    let apiCalls = 0;
    let failedCalls = 0;
    const updateBatch: any[] = [];
    const callsPerKey: Record<string, number> = {};
    keyPool.forEach(k => { callsPerKey[k.label] = 0; });
    const errorsByLabel: Record<string, string> = {};

    // Start with the first key that has remaining quota
    let keyIdx = 0;
    const pickActiveKey = (): { label: string; apiKey: string } | null => {
      while (keyIdx < keyPool.length) {
        const k = keyPool[keyIdx];
        const u = usageByLabel[k.label];
        if (u.requestCount + callsPerKey[k.label] < u.monthlyLimit) return k;
        keyIdx++;
      }
      return null;
    };

    for (const entry of entries) {
      let activeKey = pickActiveKey();
      if (!activeKey) break; // all keys exhausted

      let result = await carrierLookup(entry.phone, activeKey.apiKey);
      apiCalls++;

      // When a key returns quotaHit (429), sync our tracking to mark it as
      // exhausted even if our local count was wrong (e.g. key was used elsewhere).
      if (result?.quotaHit) {
        const u = usageByLabel[activeKey.label];
        callsPerKey[activeKey.label] = u.monthlyLimit - u.requestCount; // fill up to limit
      }

      // Rotate on quota hit OR any other error (HTTP error, network failure, etc.)
      while ((result?.quotaHit || result?.error) && keyIdx < keyPool.length - 1) {
        if (result?.error) errorsByLabel[activeKey.label] = result.error;
        keyIdx++;
        const nextKey = pickActiveKey();
        if (!nextKey) { activeKey = null; break; }
        activeKey = nextKey;
        result = await carrierLookup(entry.phone, activeKey.apiKey);
        apiCalls++;
        if (result?.quotaHit) {
          const u2 = usageByLabel[activeKey.label];
          callsPerKey[activeKey.label] = u2.monthlyLimit - u2.requestCount;
        }
      }

      if (!activeKey) break; // all keys exhausted

      if (result?.error) {
        errorsByLabel[activeKey.label] = result.error;
        failedCalls++;
        updateBatch.push({ id: entry.id, data: { validationStatus: 'failed', validatedAt: new Date().toISOString() } });
      } else if (!result || result.quotaHit) {
        // Should not reach here after rotation, but handle defensively
        failedCalls++;
        updateBatch.push({ id: entry.id, data: { validationStatus: 'failed', validatedAt: new Date().toISOString() } });
      } else {
        callsPerKey[activeKey.label]++;
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
        if (result.isValid) validated++;
      }
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

    // Check if all keys are exhausted or broken
    const allBroken = newRemaining <= 0 || (failedCalls > 0 && validated === 0 && apiCalls > 0 && keyIdx >= keyPool.length);

    return Response.json({
      validated,
      apiCalls,
      failedCalls,
      remaining: newRemaining,
      used: totalUsed,
      limit: totalLimit,
      keyCount: keyPool.length,
      done: entries.length < toValidate,
      allKeysExhausted: allBroken,
      keyErrors: Object.keys(errorsByLabel).length > 0 ? errorsByLabel : undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}