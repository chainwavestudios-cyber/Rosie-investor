/**
 * dncScrubVault — DNC + Litigator scrub via LandlineRemover API.
 *
 * Runs AFTER the existing Twilio/Omkar phone validation. Selects validated,
 * non-VoIP, undistributed LeadVaultEntry records that haven't been DNC-scrubbed
 * yet, calls the LandlineRemover check-number API for each, and records:
 *   - Federal DNC status
 *   - State DNC status
 *   - TCPA Litigator status
 *   - Line type + carrier (cross-check)
 *   - Clean/callable flag
 *
 * Numbers on the DNC registry or known litigator list are marked
 * pipelineStatus='dead' so they're excluded from distribution.
 *
 * API: GET https://app.landlineremover.com/api/check-number?apikey=KEY&number=NUM
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

const LLR_URL = 'https://app.landlineremover.com/api/check-number';
const BATCH_SIZE = 50;

function toDigits(phone: string): string {
  if (!phone) return '';
  let p = phone.trim().replace(/\D/g, '');
  if (p.length === 11 && p[0] === '1') p = p.slice(1);
  return p;
}

/** Flexible response parser — LandlineRemover field names aren't documented. */
function parseLlrResponse(data: any): {
  lineType: string;
  carrier: string;
  dncFederal: boolean;
  dncState: boolean;
  litigator: boolean;
  clean: boolean;
} {
  // Try to find line type across common field names
  const rawType = (
    data?.line_type || data?.linetype || data?.type || data?.phone_type ||
    data?.LineType || data?.lineType || data?.Type || ''
  ).toString().toLowerCase();
  const lineType = rawType.includes('mobile') || rawType.includes('cell')
    ? 'mobile'
    : rawType.includes('landline') || rawType.includes('fixed')
      ? 'landline'
      : rawType.includes('voip')
        ? 'voip'
        : rawType || 'unknown';

  const carrier = data?.carrier || data?.carrier_name || data?.Carrier || data?.carrierName || '';

  // DNC — check multiple possible field shapes
  const dncFederalRaw = data?.dnc || data?.dnc_federal || data?.federal_dnc || data?.national_dnc || data?.DNC || data?.dncFederal;
  const dncStateRaw = data?.dnc_state || data?.state_dnc || data?.dncState || data?.StateDNC;
  const litigatorRaw = data?.litigator || data?.is_litigator || data?.Litigator || data?.tcpa_litigator || data?.is_litigator;

  const isYes = (v: any): boolean => {
    if (v === true || v === 'true' || v === 'Y' || v === 'y' || v === 1 || v === '1') return true;
    if (typeof v === 'string') return v.toLowerCase() === 'yes' || v.toLowerCase() === 'true' || v.toLowerCase() === 'on';
    return false;
  };

  const dncFederal = isYes(dncFederalRaw);
  const dncState = isYes(dncStateRaw);
  const litigator = isYes(litigatorRaw);

  // "clean" might be provided directly, or we derive it
  const clean = data?.clean !== undefined
    ? isYes(data.clean) || data.clean === 1 || data.clean === '1'
    : !dncFederal && !dncState && !litigator;

  return { lineType, carrier, dncFederal, dncState, litigator, clean };
}

async function llrLookup(phone: string, apiKey: string): Promise<{
  ok: boolean;
  data?: any;
  status: number;
  error?: string;
}> {
  const num = toDigits(phone);
  if (!num || num.length !== 10) {
    return { ok: false, status: 0, error: 'invalid_number' };
  }
  try {
    const url = `${LLR_URL}?apikey=${encodeURIComponent(apiKey)}&number=${encodeURIComponent(num)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (res.status === 401) return { ok: false, status: 401, error: 'invalid_api_key' };
    if (res.status === 402) return { ok: false, status: 402, error: 'insufficient_credits' };
    if (res.status === 429) return { ok: false, status: 429, error: 'rate_limited' };
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: `HTTP ${res.status}: ${body.slice(0, 150)}` };
    }
    const data = await res.json().catch(() => null);
    if (!data) return { ok: false, status: 0, error: 'invalid_json' };
    return { ok: true, status: 200, data };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message || 'fetch_failed' };
  }
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    try { await base44.auth.me(); } catch {}

    const body = await req.json().catch(() => ({}));
    const { batchLabel, maxCount, mode } = body || {};
    const retryFailed = mode === 'retry_failed';
    const limit = Math.min(Math.max(1, maxCount || BATCH_SIZE), BATCH_SIZE);

    const apiKey = secrets.get('LANDLINE_REMOVER_API_KEY') || '';
    if (!apiKey) {
      return Response.json(
        { error: 'LANDLINE_REMOVER_API_KEY secret not set' },
        { status: 500 }
      );
    }

    // ── Select validated entries pending DNC scrub ──
    const query: any = {
      validationStatus: 'validated',
      phoneValid: true,
      destination: 'none',
    };
    if (retryFailed) {
      query.dncScrubStatus = 'failed';
    } else {
      query.$or = [{ dncScrubStatus: 'pending' }, { dncScrubStatus: { $exists: false } }];
    }
    if (batchLabel) query.batchLabel = batchLabel;

    const page = await base44.asServiceRole.entities.LeadVaultEntry.filter(
      query,
      { sort: 'validatedAt', limit }
    );
    const entries = page?.items || page || [];

    if (!entries || entries.length === 0) {
      return Response.json({
        scrubbed: 0,
        clean: 0,
        blocked: 0,
        failed: 0,
        done: true,
        message: 'No validated entries pending DNC scrub',
      });
    }

    // ── Process each entry ──
    let scrubbed = 0;
    let clean = 0;
    let blocked = 0;
    let failed = 0;
    let rateLimited = false;
    let outOfCredits = false;
    const now = new Date().toISOString();
    const updateBatch: any[] = [];

    for (const entry of entries) {
      if (rateLimited || outOfCredits) break;

      const result = await llrLookup(entry.phone, apiKey);

      if (result.status === 429) {
        rateLimited = true;
        break;
      }
      if (result.status === 402) {
        outOfCredits = true;
        break;
      }
      if (result.status === 401) {
        return Response.json({ error: 'Invalid LANDLINE_REMOVER_API_KEY' }, { status: 500 });
      }
      if (!result.ok) {
        failed++;
        updateBatch.push({
          id: entry.id,
          dncScrubStatus: 'failed',
          llrScrubbedAt: now,
        });
        continue;
      }

      const parsed = parseLlrResponse(result.data);
      scrubbed++;

      const isBlocked = parsed.dncFederal || parsed.dncState || parsed.litigator;
      if (isBlocked) {
        blocked++;
      } else {
        clean++;
      }

      updateBatch.push({
        id: entry.id,
        dncScrubStatus: 'scrubbed',
        dncFederal: parsed.dncFederal,
        dncState: parsed.dncState,
        litigator: parsed.litigator,
        llrClean: !isBlocked,
        llrLineType: parsed.lineType,
        llrCarrier: parsed.carrier,
        llrScrubbedAt: now,
        // Dead-end DNC/litigator numbers so they're excluded from distribution
        pipelineStatus: isBlocked ? 'dead' : (entry.pipelineStatus || 'ready'),
      });
    }

    // ── Bulk update ──
    if (updateBatch.length > 0) {
      await base44.asServiceRole.entities.LeadVaultEntry.bulkUpdate(updateBatch);
    }

    return Response.json({
      scrubbed,
      clean,
      blocked,
      failed,
      rateLimited,
      outOfCredits,
      done: entries.length < limit,
      message: outOfCredits
        ? 'LandlineRemover credits exhausted — add credits to continue'
        : rateLimited
          ? 'Rate limited — remaining entries will scrub on next run'
          : `${clean} clean, ${blocked} blocked (DNC/litigator), ${failed} failed`,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}