/**
 * confirmAppointment — Public endpoint linked from the night-before reminder email.
 * When the client clicks "Confirm Appointment", this marks the DebtLead's
 * appointmentConfirmed = true and returns a simple confirmation page.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const url = new URL(req.url);
  const leadId = url.searchParams.get('leadId') || '';

  if (!leadId) {
    return htmlResponse('Missing appointment link. Please contact us to confirm your appointment.');
  }

  try {
    const lead = await base44.asServiceRole.entities.DebtLead.get(leadId);
    if (!lead) {
      return htmlResponse('Appointment not found. Please contact us at (619) 353-0919.');
    }

    if (!lead.appointmentConfirmed) {
      await base44.asServiceRole.entities.DebtLead.update(leadId, {
        appointmentConfirmed: true,
        appointmentConfirmedAt: new Date().toISOString(),
      });

      // Log activity
      await base44.asServiceRole.entities.DebtLeadActivity.create({
        leadId,
        leadName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
        activityType: 'note',
        activityText: '✅ Client confirmed appointment via email link',
        createdBy: 'appointment_system',
      }).catch(() => {});
    }

    const apptDate = lead.appointmentDate ? new Date(lead.appointmentDate).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }) : 'your scheduled time';

    return htmlResponse(`
      <div style="text-align:center;padding:60px 20px;font-family:Arial,Helvetica,sans-serif;background:#f4f4f5;min-height:100vh;">
        <div style="max-width:500px;margin:0 auto;background:#ffffff;border-radius:12px;padding:40px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <div style="font-size:48px;margin-bottom:16px;">✅</div>
          <h1 style="color:#10b981;font-size:28px;margin:0 0 12px 0;">Appointment Confirmed!</h1>
          <p style="color:#0d1117;font-size:16px;line-height:1.6;margin:0 0 20px 0;">
            Thank you, ${lead.firstName || ''}! Your appointment for ${apptDate} has been confirmed.<br><br>
            We look forward to speaking with you then.
          </p>
          <p style="color:#6b7280;font-size:14px;margin:0;">
            Debt Advisors of America<br>
            (619) 353-0919
          </p>
        </div>
      </div>
    `);
  } catch (e) {
    return htmlResponse('An error occurred. Please contact us at (619) 353-0919 to confirm your appointment.');
  }
}

function htmlResponse(body: string): Response {
  return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Appointment Confirmation</title></head><body style="margin:0;">${body}</body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}