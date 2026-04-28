import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * validateAccessCode
 * Called by investors.rosieai.tech (Home.jsx) to validate a personal access code.
 * Runs as service role so it works regardless of client auth state.
 *
 * POST body: { code: string }
 * Returns:   { valid: true,  type: 'investor'|'lead', name, email, id, leadId, siteAccessCode }
 *          | { valid: false, reason: string }
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let code = '';
  try {
    const body = await req.json();
    code = (body.code || '').trim().toLowerCase();
  } catch {
    return Response.json({ valid: false, reason: 'Invalid request body' }, { status: 400 });
  }

  if (!code) {
    return Response.json({ valid: false, reason: 'No code provided' }, { status: 400 });
  }

  // ── 1. Try InvestorUser.siteAccessCode (stored after migration) ──────────
  try {
    const byCode = await base44.asServiceRole.entities.InvestorUser.filter({ siteAccessCode: code });
    if (byCode?.length > 0) {
      const u = byCode[0];
      console.log(`[validateAccessCode] Matched InvestorUser.siteAccessCode: ${code}`);
      return Response.json({
        valid: true,
        type: 'investor',
        name: u.name,
        email: u.email,
        id: u.id,
        leadId: u.leadId || null,
        siteAccessCode: code,
      });
    }
  } catch (e) {
    console.warn('[validateAccessCode] siteAccessCode filter error:', e.message);
  }

  // ── 2. Try InvestorUser.username (username matches access code exactly) ──
  try {
    const byUsername = await base44.asServiceRole.entities.InvestorUser.filter({ username: code });
    if (byUsername?.length > 0) {
      const u = byUsername[0];
      // Only treat as info-site access if they have a siteAccessCode or their username
      // matches the code pattern (firstname+last4digits)
      console.log(`[validateAccessCode] Matched InvestorUser.username: ${code}`);
      return Response.json({
        valid: true,
        type: 'investor',
        name: u.name,
        email: u.email,
        id: u.id,
        leadId: u.leadId || null,
        siteAccessCode: code,
      });
    }
  } catch (e) {
    console.warn('[validateAccessCode] username filter error:', e.message);
  }

  // ── 3. Try Lead.portalPasscode (lead not yet migrated to portal) ─────────
  try {
    const byPasscode = await base44.asServiceRole.entities.Lead.filter({ portalPasscode: code });
    if (byPasscode?.length > 0) {
      const lead = byPasscode[0];
      console.log(`[validateAccessCode] Matched Lead.portalPasscode: ${code}`);

      // Stamp badge + engagement + lastSiteVisit on the lead
      try {
        await base44.asServiceRole.entities.Lead.update(lead.id, {
          badgeInvestorPage: true,
          engagementScore:   (lead.engagementScore || 0) + 10,
          lastSiteVisit:     new Date().toISOString(),
        });
      } catch {}

      return Response.json({
        valid: true,
        type: 'lead',
        name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
        email: lead.email || '',
        id: lead.id,
        leadId: lead.id,
        siteAccessCode: code,
      });
    }
  } catch (e) {
    console.warn('[validateAccessCode] portalPasscode filter error:', e.message);
  }

  // ── 4. Last resort: list recent leads and check portalPasscode in memory ─
  // Handles cases where base44 filter doesn't support custom-field equality
  try {
    const allLeads = await base44.asServiceRole.entities.Lead.list('-created_date', 500);
    const match = (allLeads || []).find(l =>
      (l.portalPasscode || '').trim().toLowerCase() === code
    );
    if (match) {
      console.log(`[validateAccessCode] Matched via in-memory Lead scan: ${code}`);
      try {
        await base44.asServiceRole.entities.Lead.update(match.id, {
          badgeInvestorPage: true,
          engagementScore: (match.engagementScore || 0) + 10,
        });
      } catch {}
      return Response.json({
        valid: true,
        type: 'lead',
        name: `${match.firstName || ''} ${match.lastName || ''}`.trim(),
        email: match.email || '',
        id: match.id,
        leadId: match.id,
        siteAccessCode: code,
      });
    }
  } catch (e) {
    console.warn('[validateAccessCode] in-memory scan error:', e.message);
  }

  console.log(`[validateAccessCode] No match found for code: ${code}`);
  return Response.json({ valid: false, reason: 'Access code not recognised' });
});