/**
 * assignNoticeId — Hands out the next Notice ID(s) for new contact cards.
 *
 * The fronter/admin panels create contact cards through the client SDK, so they
 * ask this function for the ID first and store what it returns. Backend paths
 * (vault distribution, AI dialer, inbound AI cards) call assignNoticeIds()
 * directly from the shared module. Both routes share one counter, so no two
 * contact cards can ever end up with the same Notice ID.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { assignNoticeIds } from '../../shared/noticeId.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Portal users (fronters, admins) sign in through DebtCoachAuth, not platform
    // auth, so the platform session check is non-fatal here — the counter write
    // runs as service role either way.
    try { await base44.auth.me(); } catch {}

    const ids = await assignNoticeIds(base44, Number(body?.count) || 1);
    return Response.json({ ids });
  } catch (error: any) {
    console.error('[assignNoticeId] error:', error?.message || String(error));
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}