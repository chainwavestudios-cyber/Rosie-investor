/**
 * draftAppointmentNotes — the AI button beside the Description field of the
 * Schedule Event form.
 *
 * It reads the client's last call: the transcript, the intent report the intent
 * engine wrote when the call ended, and the key facts stored from earlier calls.
 * From that it writes the notes the agent should walk into the appointment with —
 * where the client stands, what matters to them, the numbers, what to cover, and
 * the next step.
 *
 * Returns { notes: string }.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

// Only the tail of the call is used, bounded so a very long call can never blow
// up the request.
const MAX_CALL_CHARS = 14000;

const SYSTEM = `You write the short internal notes an agent reads before an appointment with a debt-settlement client.

Rules:
- 3 to 6 short lines. Plain text, each line starting with "- ".
- Cover, in this order: where the client stands right now, what matters to them personally, the numbers they gave (debt, income, monthly payments), what to cover on the appointment, and the next step.
- Use ONLY what the CONTEXT below states. Never invent a fact, a number, a name or a promise.
- Quote the client's numbers exactly as given.
- Do not use em-dashes. No greeting, no signature, no preamble, no heading.`;

function formatCall(lines: any): string {
  if (!Array.isArray(lines)) return '';
  return lines
    .map((line: any) => `[${line?.speaker === 0 ? 'AGENT' : 'CLIENT'}]: ${line?.text || ''}`)
    .join('\n');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const { leadId, leadType = 'debt', appointmentDate, appointmentTitle } = await req.json();
    if (!leadId) return Response.json({ error: 'Missing leadId' });

    const isFronter = leadType === 'fronter';
    const lead = await (isFronter
      ? base44.asServiceRole.entities.FronterLead.get(leadId)
      : base44.asServiceRole.entities.DebtLead.get(leadId)
    ).catch(() => null);
    if (!lead) return Response.json({ error: 'Contact card not found' });

    const [calls, memories] = await Promise.all([
      (isFronter
        ? base44.asServiceRole.entities.FronterCallTranscript.filter({ leadId }, '-callDate', 2)
        : base44.asServiceRole.entities.DebtCallTranscript.filter({ leadId }, '-callDate', 2)
      ).catch(() => []),
      base44.asServiceRole.entities.LeadMemory.filter({ leadId }, '-created_date', 12).catch(() => []),
    ]);

    const lastCall = (calls || [])[0] || null;
    let lines: any = [];
    try {
      lines = JSON.parse((lastCall && lastCall.transcriptJson) || lead.transcriptJson || '[]');
    } catch { lines = []; }
    const callText = formatCall(lines).slice(-MAX_CALL_CHARS);

    const facts = (memories || [])
      .map((m: any) => `- ${m.factText}${m.context ? ` (${m.context})` : ''}`)
      .join('\n');
    const intentReport = (lastCall && (lastCall.intentReport || lastCall.followUpReport)) || lead.nextCallBriefing || '';

    if (!callText && !intentReport) {
      return Response.json({ error: 'No call transcript or call report is on file for this client yet.' });
    }

    const context = [
      `CLIENT: ${[lead.firstName, lead.lastName].filter(Boolean).join(' ')}`,
      lead.city || lead.state ? `LOCATION: ${[lead.city, lead.state].filter(Boolean).join(', ')}` : '',
      lead.debtAmount ? `DEBT ON FILE: $${Number(lead.debtAmount).toLocaleString()}` : '',
      lead.employmentStatus ? `EMPLOYMENT: ${lead.employmentStatus}` : '',
      lead.monthlyIncome ? `MONTHLY INCOME: $${Number(lead.monthlyIncome).toLocaleString()}` : '',
      lead.status ? `STATUS: ${lead.status}` : '',
      lead.notes ? `NOTES ALREADY ON THE CARD:\n${lead.notes}` : '',
      appointmentDate ? `APPOINTMENT BEING SCHEDULED: ${appointmentTitle || 'Follow-up call'} on ${appointmentDate}` : '',
      intentReport ? `INTENT REPORT FROM THE LAST CALL:\n${String(intentReport).slice(0, 4000)}` : '',
      facts ? `KEY FACTS FROM EARLIER CALLS:\n${facts}` : '',
      callText
        ? `LAST CALL TRANSCRIPT${lastCall?.callDate ? ` (${new Date(lastCall.callDate).toLocaleString('en-US', { timeZone: 'America/New_York' })})` : ''}:\n${callText}`
        : '',
    ].filter(Boolean).join('\n\n');

    const result: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${SYSTEM}\n\nCONTEXT:\n${context}`,
    });
    const notes = String(typeof result === 'string' ? result : (result?.text || '')).trim();
    if (!notes) return Response.json({ error: 'No notes could be written from this call.' });

    return Response.json({ notes });
  } catch (error) {
    console.error('[draftAppointmentNotes] Error:', error);
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});