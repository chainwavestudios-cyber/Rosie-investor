/**
 * twilioGetLines — returns live Twilio outbound numbers with fronter name tags.
 * Fetches the actual inventory from the Twilio API (so new lines appear
 * automatically), resolves each to its env-var key, and labels each with the
 * assigned fronter's display name (or "Unassigned").
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const AUTH_TOKEN   = Deno.env.get('TWILIO_AUTH_TOKEN')  || '';
const twilioAuth   = 'Basic ' + btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);

const ENV_KEYS = [
  'TWILIO_FROM_NUMBER', 'TWILIO_FROM_NUMBER_2', 'TWILIO_FROM_NUMBER_3',
  'TWILIO_FROM_NUMBER_4', 'TWILIO_FROM_NUMBER_5', 'TWILIO_FROM_NUMBER_6',
];

export default async function(req: Request): Promise<Response> {
  try {
    // 1. Fetch all voice-capable numbers from Twilio (live inventory)
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=100`,
      { headers: { Authorization: twilioAuth }, signal: AbortSignal.timeout(10000) }
    );
    if (!twilioRes.ok) {
      const err = await twilioRes.json().catch(() => ({}));
      return Response.json({ error: err.message || `Twilio error ${twilioRes.status}` }, { status: 500 });
    }
    const twilioData = await twilioRes.json();
    const twilioNumbers: string[] = (twilioData.incoming_phone_numbers || [])
      .filter((n: any) => n.capabilities?.voice)
      .map((n: any) => n.phone_number);

    // 2. Build env-var → number map for key resolution
    const envNumberToKey = new Map<string, string>();
    for (const key of ENV_KEYS) {
      const num = Deno.env.get(key) || '';
      if (num && /^\+\d{10,}$/.test(num)) envNumberToKey.set(num, key);
    }

    // 3. Fetch assignments + users for fronter name labels
    let assignments: any[] = [];
    let users: any[] = [];
    try {
      const base44 = createClientFromRequest(req);
      assignments = await base44.entities.FronterLineAssignment.list('-assignedAt', 100) || [];
      users = await base44.entities.DebtCoachUser.list('-created_date', 500) || [];
    } catch (e) {
      console.warn('[twilioGetLines] Could not load assignments/users:', e?.message);
    }

    const displayNames = new Map<string, string>();
    for (const u of users) {
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
      if (name) displayNames.set((u.username || '').toLowerCase(), name);
    }

    // 4. Build lines: each Twilio number → { key, number, label, assignedTo }
    const lines = twilioNumbers.map((number: string) => {
      const key = envNumberToKey.get(number) || number; // use phone number as key if no env var
      const assignment = assignments.find((a: any) => a.twilioNumber === number || a.twilioLineKey === key || a.twilioLineKey === number);
      const fronterName = assignment
        ? (displayNames.get((assignment.username || '').toLowerCase()) || assignment.username)
        : '';
      return {
        key,
        number,
        label: fronterName || 'Unassigned',
        assignedTo: assignment?.username || '',
      };
    });

    return Response.json({ lines });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}