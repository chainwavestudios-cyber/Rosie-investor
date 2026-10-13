/**
 * validateVaultPhones — Validates pending LeadVaultEntry phone numbers via
 * Omkar Carrier Lookup API. Enforces monthly quota. Returns progress + remaining.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

const OMKAR_URL = 'https://carrier-lookup-api.omkar.cloud/lookup';

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

async function carrierLookup(phone: string, apiKey: string): Promise<{
  isValid: boolean; lineType: string; carrier: string; e164: string;
} | null> {
  const e164 = toE164(phone);
  if (!e164 || !apiKey) return null;
  try {
    const res = await fetch(
      `${OMKAR_URL}?phone=${encodeURIComponent(e164)}`,
      { headers: { 'API-Key': apiKey }, signal: AbortSignal.timeout(12000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const lt = (data?.line_type || 'unknown').toLowerCase();
    const lineType = lt.includes('voip') ? 'voip' : lt.includes('mobile') ? 'mobile' : lt.includes('landline') || lt.includes('fixed') || lt === 'landline' ? 'landline' : 'unknown';
    return {
      isValid: data?.is_valid_number === true,
      lineType,
      carrier: data?.carrier || '',
      e164: data?.phone_number || e164,
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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { batchLabel, maxCount } = body || {};
    const limit = Math.min(Math.max(1, maxCount || 50), 50);

    const apiKey = secrets.get('PHONE_LOOKUP_API_KEY') || '';
    if (!apiKey) return Response.json({ error: 'PHONE_LOOKUP_API_KEY not set' }, { status: 500 });

    // ── Monthly usage tracking ──
    const monthKey = getMonthKey();
    const usageRecords = await base44.asServiceRole.entities.PhoneValidationUsage.filter({ monthKey });
    let usage = usageRecords?.[0];
    if (!usage) {
      usage = await base44.asServiceRole.entities.PhoneValidationUsage.create({ monthKey, requestCount: 0, monthlyLimit: 100 });
    }
    const remaining = (usage.monthlyLimit || 100) - (usage.requestCount || 0);
    if (remaining <= 0) {
      return Response.json({ error: 'Monthly validation quota exhausted', remaining: 0, used: usage.requestCount, limit: usage.monthlyLimit });
    }
    const toValidate = Math.min(limit, remaining);

    // ── Fetch pending entries ──
    const query: any = { validationStatus: 'pending', destination: 'none' };
    if (batchLabel) query.batchLabel = batchLabel;
    const page = await base44.asServiceRole.entities.LeadVaultEntry.filter(query, { sort: 'created_date', limit: toValidate });
    const entries = page?.items || page || [];

    if (!entries || entries.length === 0) {
      return Response.json({ validated: 0, remaining, used: usage.requestCount, limit: usage.monthlyLimit, done: true });
    }

    // ── Validate in parallel batches of 6 ──
    let validated = 0;
    let apiCalls = 0;
    const updateBatch: any[] = [];

    for (let i = 0; i < entries.length; i += 6) {
      const batch = entries.slice(i, i + 6);
      const results = await Promise.allSettled(batch.map(async (entry) => {
        const result = await carrierLookup(entry.phone, apiKey);
        apiCalls++;
        return { entry, result };
      }));
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        const { entry, result } = r.value;
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
    }

    // ── Update entries ──
    if (updateBatch.length > 0) {
      await base44.asServiceRole.entities.LeadVaultEntry.bulkUpdate(
        updateBatch.map(u => ({ id: u.id, ...u.data }))
      );
    }

    // ── Increment usage ──
    await base44.asServiceRole.entities.PhoneValidationUsage.update(usage.id, {
      requestCount: (usage.requestCount || 0) + apiCalls,
    });

    const newRemaining = (usage.monthlyLimit || 100) - (usage.requestCount || 0) - apiCalls;

    return Response.json({
      validated,
      apiCalls,
      remaining: newRemaining,
      used: (usage.requestCount || 0) + apiCalls,
      limit: usage.monthlyLimit || 100,
      done: entries.length < toValidate,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}