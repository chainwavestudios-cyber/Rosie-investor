/**
 * tracerfyBatch — Tracerfy phone-append pipeline step.
 *
 * Selects a batch of raw LeadVaultEntry records (pipelineStatus='raw',
 * tracerfyStatus='pending'), sends each to the Tracerfy real-time lookup API
 * with name + address, and appends the returned mobile/landline phones.
 *
 * After a successful append:
 *   - mobilePhone / landlinePhone are populated from Tracerfy
 *   - phone is set to the best mobile (or landline fallback) so the existing
 *     validateVaultPhones (Twilio/Omkar verifier) picks it up
 *   - phone2 is set to the landline when mobile is primary
 *   - tracerfyStatus='completed', pipelineStatus='traced'
 *   - validationStatus='pending' (routes into the existing Twilio verifier)
 *
 * On no hit or error:
 *   - tracerfyStatus='failed' (no hit) or 'failed' (API error)
 *   - pipelineStatus='dead' when no phone could be appended at all
 *
 * Modes:
 *   - default: process up to 50 raw+pending entries
 *   - "retry_failed": re-run entries with tracerfyStatus='failed'
 *   - "skip": mark entries without enough address data as tracerfyStatus='skipped'
 *
 * Tracerfy API: POST https://tracerfy.com/v1/api/trace/lookup/
 * Rate limit: 500 lookups/min (shared). 50/batch is well within limits.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

const TRACERFY_URL = 'https://tracerfy.com/v1/api/trace/lookup/';
const BATCH_SIZE = 50;

interface TracerfyPhone {
  number: string;
  type: string;
  carrier: string;
  rank: number;
}

interface TracerfyResponse {
  hit: boolean;
  persons_count?: number;
  credits_deducted?: number;
  persons?: Array<{
    first_name?: string;
    last_name?: string;
    phones?: TracerfyPhone[];
    emails?: Array<{ email: string; rank: number }>;
  }>;
  error?: string;
  detail?: string | Record<string, string[]>;
}

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

async function tracerfyLookup(
  entry: any,
  apiKey: string
): Promise<{ ok: boolean; data?: TracerfyResponse; status: number; error?: string }> {
  const body: Record<string, string> = {};
  if (entry.address) body.address = entry.address;
  if (entry.city) body.city = entry.city;
  if (entry.state) body.state = entry.state;
  if (entry.zipCode) body.zip = entry.zipCode;
  if (entry.firstName) body.first_name = entry.firstName;
  if (entry.lastName) body.last_name = entry.lastName;

  // Need at least address + state for a meaningful lookup
  if (!body.address || !body.state) {
    return { ok: false, status: 0, error: 'insufficient_address' };
  }

  try {
    const res = await fetch(TRACERFY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });

    if (res.status === 402) {
      const errBody = await res.json().catch(() => ({}));
      return { ok: false, status: 402, error: (errBody as any)?.error || 'insufficient_credits' };
    }
    if (res.status === 429) {
      return { ok: false, status: 429, error: 'rate_limited' };
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: `HTTP ${res.status}: ${errBody.slice(0, 150)}` };
    }

    const data = (await res.json()) as TracerfyResponse;
    return { ok: true, status: 200, data };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message || 'fetch_failed' };
  }
}

/** Extract best mobile and landline phones from a Tracerfy response. */
function extractPhones(data: TracerfyResponse): {
  mobilePhone: string;
  landlinePhone: string;
  carrier: string;
  email: string;
} {
  let mobilePhone = '';
  let landlinePhone = '';
  let carrier = '';
  let email = '';
  let bestMobileRank = Infinity;
  let bestLandlineRank = Infinity;

  for (const person of data.persons || []) {
    for (const phone of person.phones || []) {
      const type = (phone.type || '').toLowerCase();
      const num = phone.number || '';
      if (!num) continue;
      if (type === 'mobile' && phone.rank < bestMobileRank) {
        mobilePhone = num;
        bestMobileRank = phone.rank;
        if (!carrier) carrier = phone.carrier || '';
      } else if (type === 'landline' && phone.rank < bestLandlineRank) {
        landlinePhone = num;
        bestLandlineRank = phone.rank;
        if (!carrier && !mobilePhone) carrier = phone.carrier || '';
      }
    }
    for (const e of person.emails || []) {
      if (!email && e.email) email = e.email;
    }
  }

  return { mobilePhone, landlinePhone, carrier, email };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    try { await base44.auth.me(); } catch {}

    const body = await req.json().catch(() => ({}));
    const { batchLabel, mode } = body || {};
    const retryFailed = mode === 'retry_failed';

    const apiKey = secrets.get('TRACERFY_API_KEY') || '';
    if (!apiKey) {
      return Response.json(
        { error: 'TRACERFY_API_KEY secret not set' },
        { status: 500 }
      );
    }

    // ── Select batch of raw leads pending Tracerfy ──
    const query: any = {};
    if (retryFailed) {
      query.tracerfyStatus = 'failed';
    } else {
      query.tracerfyStatus = 'pending';
    }
    if (batchLabel) query.batchLabel = batchLabel;

    const page = await base44.asServiceRole.entities.LeadVaultEntry.filter(
      query,
      { sort: 'created_date', limit: BATCH_SIZE }
    );
    const entries = page?.items || page || [];

    if (!entries || entries.length === 0) {
      return Response.json({
        processed: 0,
        hits: 0,
        appended: 0,
        failed: 0,
        done: true,
        message: retryFailed
          ? 'No failed Tracerfy entries to retry'
          : 'No raw leads pending Tracerfy phone append',
      });
    }

    // ── Assign batch ID and mark as processing ──
    const batchId = `tf-${Date.now()}`;
    const now = new Date().toISOString();
    const entryIds = entries.map((e: any) => e.id);
    await base44.asServiceRole.entities.LeadVaultEntry.updateMany(
      { id: { $in: entryIds } },
      { $set: { tracerfyStatus: 'processing', pipelineStatus: 'tracing', tracerfyBatchId: batchId } }
    );

    // ── Process each entry ──
    let hits = 0;
    let appended = 0;
    let failed = 0;
    let skipped = 0;
    let creditsUsed = 0;
    let rateLimited = false;
    let outOfCredits = false;
    const updateBatch: any[] = [];

    for (const entry of entries) {
      if (rateLimited || outOfCredits) {
        // Revert remaining entries to pending so they get picked up next run
        updateBatch.push({
          id: entry.id,
          tracerfyStatus: 'pending',
          pipelineStatus: 'raw',
          tracerfyBatchId: batchId,
        });
        continue;
      }

      const result = await tracerfyLookup(entry, apiKey);

      if (result.status === 429) {
        rateLimited = true;
        updateBatch.push({
          id: entry.id,
          tracerfyStatus: 'pending',
          pipelineStatus: 'raw',
          tracerfyBatchId: batchId,
        });
        continue;
      }
      if (result.status === 402) {
        outOfCredits = true;
        updateBatch.push({
          id: entry.id,
          tracerfyStatus: 'pending',
          pipelineStatus: 'raw',
          tracerfyBatchId: batchId,
        });
        continue;
      }
      if (result.status === 0 && result.error === 'insufficient_address') {
        skipped++;
        updateBatch.push({
          id: entry.id,
          tracerfyStatus: 'skipped',
          pipelineStatus: 'dead',
          tracerfyProcessedAt: now,
          tracerfyBatchId: batchId,
        });
        continue;
      }
      if (!result.ok || !result.data) {
        failed++;
        updateBatch.push({
          id: entry.id,
          tracerfyStatus: 'failed',
          tracerfyProcessedAt: now,
          tracerfyBatchId: batchId,
        });
        continue;
      }

      const data = result.data;
      creditsUsed += data.credits_deducted || 0;

      if (!data.hit || !data.persons || data.persons.length === 0) {
        // No match — mark failed but keep pipelineStatus raw so a retry can try again
        failed++;
        updateBatch.push({
          id: entry.id,
          tracerfyStatus: 'failed',
          tracerfyHit: false,
          tracerfyCreditsUsed: data.credits_deducted || 0,
          tracerfyProcessedAt: now,
          tracerfyBatchId: batchId,
        });
        continue;
      }

      hits++;
      const { mobilePhone, landlinePhone, carrier, email } = extractPhones(data);

      // Decide primary phone: mobile preferred, landline fallback
      const bestPhone = mobilePhone || landlinePhone;
      const secondaryPhone = mobilePhone && landlinePhone ? landlinePhone : '';

      if (!bestPhone) {
        // Hit but no phones returned
        failed++;
        updateBatch.push({
          id: entry.id,
          tracerfyStatus: 'failed',
          tracerfyHit: true,
          tracerfyCreditsUsed: data.credits_deducted || 0,
          tracerfyProcessedAt: now,
          tracerfyBatchId: batchId,
        });
        continue;
      }

      appended++;
      const update: any = {
        id: entry.id,
        tracerfyStatus: 'completed',
        tracerfyHit: true,
        tracerfyCreditsUsed: data.credits_deducted || 0,
        tracerfyProcessedAt: now,
        tracerfyBatchId: batchId,
        pipelineStatus: 'traced',
        mobilePhone: mobilePhone || '',
        landlinePhone: landlinePhone || '',
        carrierName: carrier || '',
        lineType: mobilePhone ? 'mobile' : 'landline',
        // Preserve original phone as rawPhone if it existed and differs
        rawPhone: entry.phone && entry.phone !== bestPhone ? entry.phone : entry.rawPhone || '',
        // Set primary phone to best appended phone for the existing verifier
        phone: bestPhone,
        phone2: secondaryPhone || entry.phone2 || '',
        // Route into the existing Twilio/Omkar verifier
        validationStatus: 'pending',
      };
      // Append email if Tracerfy found one and entry had none
      if (email && !entry.email) update.email = email;

      updateBatch.push(update);
    }

    // ── Bulk update all entries ──
    if (updateBatch.length > 0) {
      await base44.asServiceRole.entities.LeadVaultEntry.bulkUpdate(updateBatch);
    }

    const processed = hits + failed + skipped;
    return Response.json({
      processed,
      hits,
      appended,
      failed,
      skipped,
      creditsUsed,
      batchId,
      rateLimited,
      outOfCredits,
      done: entries.length < BATCH_SIZE,
      message: outOfCredits
        ? 'Tracerfy credits exhausted — remaining entries held for next run'
        : rateLimited
          ? 'Tracerfy rate limit hit — remaining entries held for next run'
          : `${appended} phones appended, ${hits} hits, ${failed} misses`,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}