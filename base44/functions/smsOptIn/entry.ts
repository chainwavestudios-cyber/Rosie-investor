import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN');
const FROM_NUMBER        = Deno.env.get('TWILIO_FROM_NUMBER') || '+19495963970';

Deno.serve(async (req) => {
  // Public endpoint — no auth required
  const base44 = createClientFromRequest(req);

  const { phone, firstName, leadId: passedLeadId, email } = await req.json();

  if (!phone || !phone.trim()) {
    return Response.json({ error: 'Phone number is required' }, { status: 400 });
  }
  if (!firstName || !firstName.trim()) {
    return Response.json({ error: 'First name is required' }, { status: 400 });
  }

  const cleanPhone = phone.trim();
  const cleanName  = firstName.trim();

  // Normalize phone for matching (strip spaces, dashes, parens)
  const normalizedPhone = cleanPhone.replace(/[\s\-().]/g, '');

  // Send confirmation SMS via Twilio
  const body = `Rosie AI: Hi ${cleanName}! You are now opted-in to receive investment updates and communications from us. Msg & data rates may apply. Msg frequency varies. For help, reply HELP. To opt-out, reply STOP.`;

  const params = new URLSearchParams({ From: FROM_NUMBER, To: cleanPhone, Body: body });

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  );

  const twilioData = await twilioRes.json();

  if (!twilioRes.ok) {
    return Response.json({ error: twilioData.message || 'Failed to send confirmation SMS' }, { status: 500 });
  }

  // Try to match Lead by passed leadId first, then by phone
  let leadId = null;
  let investorId = null;

  try {
    if (passedLeadId) {
      // Direct match from URL param
      leadId = passedLeadId;
      await base44.asServiceRole.entities.Lead.update(passedLeadId, { badgeSmsOptIn: true }).catch(() => {});
    } else {
      const leads = await base44.asServiceRole.entities.Lead.list('-created_date', 1000);
      const matchedLead = leads.find(l => {
        const p1 = (l.phone || '').replace(/[\s\-().]/g, '');
        const p2 = (l.phone2 || '').replace(/[\s\-().]/g, '');
        return p1 === normalizedPhone || p2 === normalizedPhone;
      });
      if (matchedLead) {
        leadId = matchedLead.id;
        await base44.asServiceRole.entities.Lead.update(matchedLead.id, { badgeSmsOptIn: true }).catch(() => {});
      }
    }
  } catch {}

  // Try to match InvestorUser by phone
  try {
    const investors = await base44.asServiceRole.entities.InvestorUser.list('-created_date', 1000);
    const matchedInvestor = investors.find(inv => {
      const p = (inv.phone || '').replace(/[\s\-().]/g, '');
      return p === normalizedPhone;
    });
    if (matchedInvestor) investorId = matchedInvestor.id;
  } catch {}

  // Save opt-in record
  const optInRecord = await base44.asServiceRole.entities.SmsOptIn.create({
    phone: cleanPhone,
    firstName: cleanName,
    optedInAt: new Date().toISOString(),
    confirmationSmsSid: twilioData.sid,
    leadId: leadId || null,
    investorId: investorId || null,
    active: true,
  });

  return Response.json({ success: true, sid: twilioData.sid, leadMatched: !!leadId, investorMatched: !!investorId });
});