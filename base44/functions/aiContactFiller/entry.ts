/**
 * AIContactFiller — Reviews a call transcript and auto-populates the contact card.
 * Extracts all customer-provided info, compares against current lead data, and
 * returns: updates (new fields), overwrites (corrected fields with old/new values),
 * and missingFields (important fields still empty that weren't mentioned).
 *
 * Works for both FronterLead (leadType='fronter') and DebtLead (leadType='debt').
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { callLLM } from '../../shared/llmHelper.ts';

const FRONTER_FIELDS = `Extract these fields (only what the CUSTOMER explicitly states or confirms):
- firstName (string): Customer's first name
- lastName (string): Customer's last name
- phone (string): Primary phone number
- phone2 (string): Secondary phone number
- email (string): Email address
- address (string): Street address
- state (string): 2-letter state abbreviation
- zipCode (string): Zip code
- preferredCallTime (string): Best time to call (e.g. "after 5pm", "mornings")
- employmentStatus (enum: employed, self_employed, unemployed, retired, disabled, unknown)
- annualIncome (number): Annual income in dollars (number only)
- debtAmount (number): Total debt amount in dollars (number only)
- hardshipQualification (string): Description of financial hardship
- referralSource (string): Lead source or referral

IMPORTANT FIELDS TO CHECK (report as missingFields if still empty/null AND not mentioned in transcript):
- email, address, state, zipCode, employmentStatus, debtAmount, hardshipQualification`;

const DEBT_FIELDS = `Extract these fields (only what the CUSTOMER explicitly states or confirms):
- firstName (string): Customer's first name
- lastName (string): Customer's last name
- phone (string): Phone number
- email (string): Email address
- address (string): Street address
- city (string): City
- state (string): 2-letter state abbreviation
- zip (string): Zip code
- dateOfBirth (string): Date of birth (YYYY-MM-DD format)
- debtAmount (number): Total debt amount in dollars (number only)
- creditorCount (number): Number of creditors (number only)
- creditors (string): Comma-separated list of creditor names
- employmentStatus (enum: employed, self-employed, unemployed, retired, disabled)
- monthlyIncome (number): Monthly income in dollars (number only)
- creditScore (number): Credit score (number only)
- behindOnPayments (boolean): true if behind on payments, false if current
- monthsBehind (number): Months behind on payments (number only)
- hardshipWhen (string): When the hardship started
- hardshipWhy (string): Why the hardship happened
- hardshipHow (string): How the hardship impacted finances

IMPORTANT FIELDS TO CHECK (report as missingFields if still empty/null AND not mentioned in transcript):
- email, address, city, state, zip, dateOfBirth, debtAmount, employmentStatus, monthlyIncome, hardshipWhen, hardshipWhy`;

export default async function(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { transcript, leadType, currentLeadData } = body;

    if (!transcript || !Array.isArray(transcript) || transcript.length < 2) {
      return Response.json({ updates: {}, overwrites: [], missingFields: [] });
    }

    const isFronter = leadType === 'fronter';
    const fields = isFronter ? FRONTER_FIELDS : DEBT_FIELDS;
    const entityName = isFronter ? 'FronterLead' : 'DebtLead';

    // Build transcript string — speaker 0=agent, 1=customer (fronter) or role-based (debt)
    const transcriptStr = (transcript || []).map((t: any) => {
      const speaker = t.speaker === 0 ? 'AGENT' : t.speaker === 1 ? 'CUSTOMER' : (t.role || 'UNKNOWN').toUpperCase();
      return `[${speaker}]: ${t.text}`;
    }).join('\n').slice(0, 8000);

    // Clean current lead data — only send relevant fields to keep prompt focused
    const cleanLead: any = {};
    if (currentLeadData) {
      const keys = isFronter
        ? ['firstName','lastName','phone','phone2','email','address','state','zipCode','preferredCallTime','employmentStatus','annualIncome','debtAmount','hardshipQualification','referralSource']
        : ['firstName','lastName','phone','email','address','city','state','zip','dateOfBirth','debtAmount','creditorCount','creditors','employmentStatus','monthlyIncome','creditScore','behindOnPayments','monthsBehind','hardshipWhen','hardshipWhy','hardshipHow'];
      for (const k of keys) {
        if (currentLeadData[k] !== undefined && currentLeadData[k] !== null && currentLeadData[k] !== '') {
          cleanLead[k] = currentLeadData[k];
        }
      }
    }

    const system = `You are an AI assistant analyzing a sales call transcript to auto-populate a contact card (${entityName}). Extract all information the CUSTOMER explicitly provided during the call.

${fields}

RULES:
1. Only extract values the CUSTOMER explicitly stated or confirmed — NOT what the agent said or read.
2. Do NOT make up data. If the customer didn't mention something, don't include it.
3. Compare extracted values against the current lead data provided.
4. "updates" = fields with NEW values (currently empty/null) OR CORRECTED values (customer corrected existing data).
5. "overwrites" = only fields where the existing value is non-empty AND is being replaced with a different value. Each overwrite must include the oldValue (from current data) and newValue (from transcript).
6. "missingFields" = important fields that are STILL empty/null in the current data AND were NOT mentioned in this transcript. These are fields the agent should have collected but missed.
7. For enum fields (employmentStatus), use the exact enum values.
8. For boolean fields (behindOnPayments), use true/false.
9. For number fields, return numbers only (no $ signs or commas).
10. For name corrections, if the customer corrects their name later in the call, use the corrected version.

CRITICAL — SPELLED-OUT TEXT RECONSTRUCTION:
Customers often spell out their email, name, or address letter by letter, sometimes using phonetic alphabet. You MUST reconstruct these into the final value.
- "j as in john, o as in ocean, h as in hotel, n at gmail dot com" → email: "john@gmail.com"
- "s m i t h" → lastName: "Smith"
- "b as in bravo, o as in oscar, b as in bravo" → "Bob"
- "at the rate" or "at" → "@"
- "dot" → "."
- "underscore" → "_"
- "dash" or "hyphen" → "-"
- Numbers spelled out: "seven seven seven" → "777"
- If the customer spells something phonetically ("f as in foxtrot"), reconstruct the full word/value from the sequence of letters.
- Pay special attention to emails — they are VERY frequently spelled out letter-by-letter. Always reconstruct the full email address from spelled letters.
- Pay special attention to last names — they are frequently spelled out. Always reconstruct the full last name from spelled letters.

Return ONLY this JSON (no markdown):
{
  "updates": { "fieldName": "newValue", ... },
  "overwrites": [
    { "fieldName": "email", "oldValue": "old@email.com", "newValue": "new@email.com" },
    ...
  ],
  "missingFields": ["fieldName1", "fieldName2", ...]
}`;

    const data = await callLLM(req, {
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: `Current lead data:\n${JSON.stringify(cleanLead)}\n\nCall transcript:\n${transcriptStr}` }],
    });

    const text = data?.content?.[0]?.text || '{}';
    try {
      const result = JSON.parse(text.replace(/```json|```/g, '').trim());
      return Response.json({
        updates: result.updates || {},
        overwrites: result.overwrites || [],
        missingFields: result.missingFields || [],
      });
    } catch {
      return Response.json({ updates: {}, overwrites: [], missingFields: [] });
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes('CREDIT_EXHAUSTED')) {
      return Response.json({ error: msg, creditError: true }, { status: 500 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}