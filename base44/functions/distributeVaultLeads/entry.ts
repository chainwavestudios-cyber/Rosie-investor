/**
 * distributeVaultLeads — Moves validated LeadVaultEntry records into FronterLead
 * records (for fronter assignment) or marks them for the AI dialer.
 * VoIP numbers are excluded from distribution.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { entryIds, destination, assignedTo, assignedBy } = body || {};

    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return Response.json({ error: 'No entry IDs provided' }, { status: 400 });
    }
    if (!destination || !['fronter', 'ai_dialer'].includes(destination)) {
      return Response.json({ error: 'Invalid destination' }, { status: 400 });
    }
    if (destination === 'fronter' && !assignedTo) {
      return Response.json({ error: 'assignedTo required for fronter destination' }, { status: 400 });
    }

    // ── Fetch entries ──
    const page = await base44.asServiceRole.entities.LeadVaultEntry.filter({ id: { $in: entryIds } });
    const entries = page?.items || page || [];
    if (!entries || entries.length === 0) {
      return Response.json({ error: 'No entries found' }, { status: 404 });
    }

    // ── Filter: only validated, non-VoIP, not already distributed ──
    const distributable = entries.filter(e =>
      e.validationStatus === 'validated' &&
      e.phoneValid === true &&
      e.phoneLineType !== 'voip' &&
      e.destination === 'none'
    );

    if (distributable.length === 0) {
      return Response.json({ error: 'No distributable entries (must be validated, non-VoIP, not already assigned)' , skipped: entries.length });
    }

    // ── Get next lead number ──
    const existing = await base44.asServiceRole.entities.FronterLead.list('-created_date', 1);
    let num = existing?.[0]?.leadNumber ? parseInt(existing[0].leadNumber.replace(/\D/g, '')) + 1 : 1;

    // ── Create FronterLead records ──
    const now = new Date().toISOString();
    const records = distributable.map(entry => {
      const leadNumber = `#F${String(num++).padStart(4, '0')}`;
      const rec: any = {
        leadNumber,
        firstName: entry.firstName,
        lastName: entry.lastName,
        phone: entry.phone,
        phone2: entry.phone2 || '',
        email: entry.email || '',
        address: entry.address || '',
        city: entry.city || '',
        state: entry.state || '',
        zipCode: entry.zipCode || '',
        debtAmount: entry.debtAmount || 0,
        notes: entry.notes || '',
        status: 'prospect',
        uploadedBy: assignedBy || user.username,
        phoneValid: entry.phoneValid,
        phoneLineType: entry.phoneLineType,
        phoneCarrier: entry.phoneCarrier,
        phone2Valid: entry.phone2Valid || false,
        phone2LineType: entry.phone2LineType || 'unknown',
        phone2Carrier: entry.phone2Carrier || '',
      };
      if (destination === 'fronter') {
        rec.assignedTo = assignedTo;
        rec.assignedAt = now;
        rec.assignedBy = assignedBy || user.username;
      }
      return rec;
    });

    // ── Bulk create FronterLeads ──
    let created = [];
    for (let i = 0; i < records.length; i += 400) {
      const batch = await base44.asServiceRole.entities.FronterLead.bulkCreate(records.slice(i, i + 400));
      created = created.concat(batch || []);
    }

    // ── Mark vault entries as distributed ──
    const vaultUpdates = distributable.map((entry, i) => ({
      id: entry.id,
      destination,
      assignedTo: destination === 'fronter' ? assignedTo : '',
      assignedAt: now,
      distributedAt: now,
      distributedBy: assignedBy || user.username,
      fronterLeadId: created[i]?.id || '',
    }));
    if (vaultUpdates.length > 0) {
      await base44.asServiceRole.entities.LeadVaultEntry.bulkUpdate(vaultUpdates);
    }

    return Response.json({
      distributed: created.length,
      skipped: entries.length - distributable.length,
      destination,
      assignedTo: destination === 'fronter' ? assignedTo : 'ai_dialer',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}