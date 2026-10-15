/**
 * aiAgentHelpers.ts — Shared helpers for the AI Fronting Agent.
 * Extracts debt data from the conversation, sends credentials email,
 * and generates an AI input summary — mirroring the fronter's
 * @@DEBT_CONFIRM@@, @@SEND_EMAIL@@, and @@AI_INPUT@@ markers.
 */
import { callLLM } from './llmHelper.ts';

/**
 * Extract debt data (amount, types, per-type amounts) from the conversation.
 * Mirrors the debtConfirm backend function but works with the conversation
 * array format used by aiAgentRespond.
 */
export async function extractDebtData(req: Request, conversation: Array<{ role: string; content: string }>) {
  const transcriptStr = conversation
    .map((m) => `${m.role === 'user' ? 'CUSTOMER' : 'AGENT'}: ${m.content}`)
    .join('\n')
    .slice(0, 8000);

  const system = `You are an AI assistant analyzing a sales call transcript to confirm the customer's debt details in ONE pass.

Your job is to determine what the CUSTOMER explicitly stated or confirmed about:
1. Their TOTAL debt amount (dollar amount)
2. Their type(s) of debt
3. The PER-TYPE dollar amounts (blended) if mentioned

VALID DEBT TYPES:
- "Unsecured Credit Card" — credit card debt
- "Unsecured Loans" — personal/unsecured loans

RULES:
1. Only extract values the CUSTOMER explicitly stated or confirmed — NOT what the agent said.
2. For debtAmount: return the total dollar amount the customer stated (number only, no $ or commas).
3. For debtTypes: return an array of the debt types the customer has (from the valid types above).
4. For debtAmounts: return an array of { type, amount } for each debt type the customer gave a specific dollar amount for. If the customer only stated a total but not a per-type breakdown, return an empty array here.
5. If the customer did not clearly state or confirm a debt amount AND debt type, return confirmed: false.
6. The total debtAmount should equal the sum of all per-type amounts when a breakdown was given.

Return ONLY this JSON (no markdown):
{
  "confirmed": true/false,
  "debtAmount": number or null,
  "debtTypes": ["Unsecured Credit Card"] or ["Unsecured Loans"] or both,
  "debtAmounts": [{"type": "Unsecured Credit Card", "amount": 10000}, {"type": "Unsecured Loans", "amount": 5000}],
  "summary": "Brief summary of what the customer said about their debt"
}`;

  try {
    const data = await callLLM(req, {
      model: 'claude-sonnet-5',
      max_tokens: 1000,
      system,
      messages: [{ role: 'user', content: `Call transcript:\n${transcriptStr}` }],
    });
    const text = data?.content?.[0]?.text || '{}';
    const result = JSON.parse(text.replace(/```json|```/g, '').trim());
    const debtAmounts = result.debtAmounts || [];
    const debtTypes = result.debtTypes || debtAmounts.map((a: any) => a.type);
    return {
      confirmed: result.confirmed || false,
      debtAmount: result.debtAmount ?? null,
      debtTypes,
      debtTypesJson: debtTypes.length > 0 ? JSON.stringify(debtTypes) : null,
      debtAmountsJson: debtAmounts.length > 0 ? JSON.stringify(debtAmounts) : null,
      summary: result.summary || '',
    };
  } catch {
    return { confirmed: false, debtAmount: null, debtTypes: [], debtTypesJson: null, debtAmountsJson: null, summary: '' };
  }
}

/**
 * Extract all contact fields from the conversation (email, address, etc).
 * Mirrors the aiContactFiller backend function but works with the conversation
 * array format used by aiAgentRespond.
 */
export async function extractContactData(req: Request, conversation: Array<{ role: string; content: string }>, currentLeadData: any) {
  const transcriptStr = conversation
    .map((m) => `${m.role === 'user' ? 'CUSTOMER' : 'AGENT'}: ${m.content}`)
    .join('\n')
    .slice(0, 8000);

  const cleanLead: any = {};
  if (currentLeadData) {
    const keys = ['firstName', 'lastName', 'phone', 'phone2', 'email', 'address', 'city', 'state', 'zipCode', 'preferredCallTime', 'employmentStatus', 'annualIncome', 'debtAmount', 'hardshipQualification', 'referralSource'];
    for (const k of keys) {
      if (currentLeadData[k] !== undefined && currentLeadData[k] !== null && currentLeadData[k] !== '') {
        cleanLead[k] = currentLeadData[k];
      }
    }
  }

  const system = `You are an AI assistant analyzing a sales call transcript to auto-populate a contact card. Extract all information the CUSTOMER explicitly provided during the call.

Extract these fields (only what the CUSTOMER explicitly states or confirms):
- firstName (string): Customer's first name
- lastName (string): Customer's last name
- phone (string): Primary phone number
- phone2 (string): Secondary phone number
- email (string): Email address
- address (string): Street address
- city (string): City
- state (string): 2-letter state abbreviation
- zipCode (string): Zip code
- preferredCallTime (string): Best time to call
- employmentStatus (enum: employed, self_employed, unemployed, retired, disabled, unknown)
- annualIncome (number): Annual income in dollars (number only)
- debtAmount (number): Total debt amount in dollars (number only)

RULES:
1. Only extract values the CUSTOMER explicitly stated or confirmed — NOT what the agent said.
2. Do NOT make up data. If the customer didn't mention something, don't include it.
3. Compare extracted values against the current lead data provided.
4. "updates" = fields with NEW values (currently empty/null) OR CORRECTED values.
5. For number fields, return numbers only (no $ signs or commas).

CRITICAL — SPELLED-OUT TEXT RECONSTRUCTION:
Customers often spell out their email, name, or address letter by letter. You MUST reconstruct these into the final value.
- "j as in john, o as in ocean, h as in hotel, n at gmail dot com" → email: "john@gmail.com"
- "at the rate" or "at" → "@"
- "dot" → "."

Return ONLY this JSON (no markdown):
{
  "updates": { "fieldName": "newValue", ... },
  "overwrites": [],
  "missingFields": []
}`;

  try {
    const data = await callLLM(req, {
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: `Current lead data:\n${JSON.stringify(cleanLead)}\n\nCall transcript:\n${transcriptStr}` }],
    });
    const text = data?.content?.[0]?.text || '{}';
    const result = JSON.parse(text.replace(/```json|```/g, '').trim());
    return { updates: result.updates || {}, overwrites: result.overwrites || [], missingFields: result.missingFields || [] };
  } catch {
    return { updates: {}, overwrites: [], missingFields: [] };
  }
}

/**
 * Generate a concise summary of the conversation for the lead's notes.
 * Mirrors the aiInputSummary backend function.
 */
export async function generateCallSummary(req: Request, conversation: Array<{ role: string; content: string }>) {
  const transcriptStr = conversation
    .map((m) => `${m.role === 'user' ? 'CUSTOMER' : 'AGENT'}: ${m.content}`)
    .join('\n')
    .slice(0, 8000);

  const system = `You are an AI assistant analyzing a live sales call transcript. Summarize what has happened so far in the call.

Focus on:
1. Key information the customer has shared (debt amount, debt type, employment, income, contact details, etc.)
2. Where the conversation is at right now
3. Any objections, concerns, or questions raised by the customer
4. The outcome of the call

Rules:
- Keep the summary concise (3-5 sentences) and written in plain English.
- Only include information the CUSTOMER actually stated — not what the agent said.
- Do not use em-dashes. Use commas or periods instead.`;

  try {
    const data = await callLLM(req, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system,
      messages: [{ role: 'user', content: `Call transcript so far:\n${transcriptStr}` }],
    });
    return data?.content?.[0]?.text || '';
  } catch {
    return '';
  }
}

/**
 * Send credentials email to the lead using the Gmail connector.
 * Loads the first FronterEmailTemplate and sends it.
 */
export async function sendCredentialsEmail(base44: any, leadData: any, sentBy: string = 'ai_agent') {
  if (!leadData?.email) return { sent: false, reason: 'no_email' };

  try {
    // Load the first email template — list() returns a page object {items, ...}, not an array
    const templatesRes = await base44.entities.FronterEmailTemplate.list('sortOrder', 10);
    const templateList = templatesRes?.items || (Array.isArray(templatesRes) ? templatesRes : []);
    const template = templateList[0];
    if (!template) return { sent: false, reason: 'no_template' };

    // Fill template variables
    const fillName = leadData.firstName || '';
    const fillEmail = leadData.email || '';
    const subject = (template.subject || '').replace(/{{firstName}}/g, fillName).replace(/{{email}}/g, fillEmail);
    const html = (template.body || '').replace(/{{firstName}}/g, fillName).replace(/{{email}}/g, fillEmail);

    // Get Gmail access token
    const { accessToken } = await base44.connectors.getConnection('gmail');
    if (!accessToken) return { sent: false, reason: 'no_gmail_token' };

    // Build simple RFC 2822 MIME message
    const mimeMessage = [
      `To: ${leadData.email}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=UTF-8',
      'MIME-Version: 1.0',
      '',
      html,
    ].join('\r\n');

    const bytes = new TextEncoder().encode(mimeMessage);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64url }),
    });

    if (!response.ok) {
      console.error('[aiAgentHelpers] Gmail API error:', await response.text());
      return { sent: false, reason: 'gmail_api_error' };
    }

    return { sent: true, templateLabel: template.label || 'credentials' };
  } catch (e) {
    console.error('[aiAgentHelpers] Email send failed:', e?.message || String(e));
    return { sent: false, reason: 'exception', error: e?.message || String(e) };
  }
}

/**
 * Prepare a lead for transfer — extract debt/contact data, send credentials
 * email, generate AI input summary, and update the lead record.
 * Shared by aiAgentRespond (Gather flow) and mediaStreamRelay (Media Stream flow).
 */
export async function prepareTransfer(req: Request, base44: any, leadData: any, config: any, conversation: Array<{ role: string; content: string }>) {
  const leadId = leadData.id;
  const now = new Date().toISOString();
  const primaryNumber = config.transferPhoneNumber || '+16193530919';

  // 1. Extract debt data + contact data
  const [debtData, contactData] = await Promise.all([
    extractDebtData(req, conversation),
    extractContactData(req, conversation, leadData),
  ]);

  const leadUpdates: any = {
    status: 'transferred',
    lastCallResult: 'transferred',
    transferredAt: now,
    transferredTo: `Chris Bongiorno (${primaryNumber})`,
    lastCalledAt: now,
  };

  if (contactData.updates && Object.keys(contactData.updates).length > 0) {
    Object.assign(leadUpdates, contactData.updates);
  }

  if (debtData.confirmed) {
    if (debtData.debtAmount != null) leadUpdates.debtAmount = debtData.debtAmount;
    if (debtData.debtTypesJson) leadUpdates.debtTypesJson = debtData.debtTypesJson;
    if (debtData.debtAmountsJson) leadUpdates.debtAmountsJson = debtData.debtAmountsJson;
  }

  // 2. Send credentials email
  let emailSent = false;
  if (config.preTransferEmailEnabled !== false) {
    const emailLeadData = { ...leadData, ...contactData.updates };
    const emailResult = await sendCredentialsEmail(base44, emailLeadData, 'ai_agent');
    emailSent = emailResult.sent;
    if (emailSent) {
      leadUpdates.credsSentAt = now;
      leadUpdates.credsSentTemplate = emailResult.templateLabel || 'credentials';
      if (leadData.status === 'prospect') {
        leadUpdates.status = 'lead';
      }
    }
    console.log('[prepareTransfer] Email sent:', emailSent, emailResult.reason || '');
  }

  // 3. Generate AI input summary
  const summary = await generateCallSummary(req, conversation);
  if (summary) {
    let notesLog: any[] = [];
    try { notesLog = JSON.parse(leadData.notesLogJson || '[]'); } catch {}
    notesLog.push({ text: `🤖 AI Input Summary: ${summary}`, timestamp: now, author: 'AI', type: 'ai_input' });
    if (debtData.confirmed && debtData.summary) {
      notesLog.push({ text: `💰 Debt Confirm: ${debtData.summary}`, timestamp: now, author: 'AI', type: 'debt_confirm' });
    }
    leadUpdates.notesLogJson = JSON.stringify(notesLog);
  }

  // 4. Update lead
  try {
    await base44.entities.FronterLead.update(leadId, leadUpdates);
  } catch (e) {
    console.warn('[prepareTransfer] Failed to update lead:', e?.message);
  }

  return { leadUpdates, emailSent, summary, debtData, contactData };
}

/**
 * The full 5-step AI agent script as a system prompt.
 * This mirrors the fronter's script exactly, with instructions for the LLM
 * to follow it conversationally.
 */
export const FRONTER_SCRIPT_SYSTEM_PROMPT = `You are a debt relief fronting agent named Alex calling on behalf of Debt Solutions.

CRITICAL — STRICT SCRIPT ADHERENCE:
You must say EXACTLY the scripted lines below, word for word. Do NOT improvise, rephrase, add information, or deviate from the script. The prospect must hear the exact words written.
The ONLY thing you may add is a brief acknowledgment (one short sentence like "I understand" or "Got it") before saying the next scripted line, and only if the prospect just said something that needs acknowledging.
Do NOT invent context. Do NOT say "we recently sent out information" or anything about prior contact. This is a cold call. You are reaching out for the first time.
Do NOT mention any company name. If asked who you are with, say "Debt Solutions." If asked about the company, say "top-rated licensed senior debt advisors" or "BBB A+ rated companies." NEVER say "Debt Advisors of America" or any specific company name.

Track which step you are on based on the conversation history. Say only the line(s) for the current step, then wait for the prospect to respond.

STEP 1: Introduction & Verification
- Say: "Hi, may I speak with {{first_name}} please?"
- After they respond, say: "Hi {{first_name}}, this is Alex with Debt Solutions. I hope I'm not catching you at a bad time?"

STEP 2: Pitch & Qualification
- Say: "Great, I'll be quick! We connect people in your area with top-rated licensed senior debt advisors to qualify for relief programs that eliminate interest to 0% and significantly lower monthly payments — with zero upfront fees."
- Say: "Just to confirm — are you currently paying high-interest rates on any unsecured credit cards or personal loans?"
- After they confirm, say: "Got it. Roughly how much total debt are you managing — is it around $10k to $20k, over $30k, or $50k-plus? Ballpark is fine."
- If total debt is clearly UNDER $10,000, say: "I appreciate your time, but our programs are designed for debt amounts of $10,000 or more. If your situation changes, please don't hesitate to reach out. Have a great day." Then say "ENDCALL".
- If debt is $10,000 or more, continue to Step 3.

STEP 3: Debt Breakdown & Confirmation
- Say: "Are those unsecured credit cards like Amex or store cards, personal loans, or a mix of both?"
- If they say credit cards only, confirm the total briefly and move to Step 4.
- If they say a mix, say: "About how much of that is in credit cards versus personal loans?"
- After they give the breakdown, confirm it briefly and move to Step 4.

STEP 4: Program Value & Handoff
- Say: "We work with top BBB A+ rated companies. These regulated programs typically reduce principle balances by 30 to 40 percent and drop interest rates to zero. A program like that would be a big help for you right now, correct?"
- After they agree, say: "I'm going to transfer you directly to licensed Sr Debt Advisors at one of the top Debt financial services companies in America — a BBB A+ rated firm who also was runner up on the Nationwide Torch Ethics award in 2025. He's one of our best senior advisors."
- Say: "First, is {{email}} still your best email? You'll receive a confirmation email with all company credentials and reviews as you enter his queue."
- After they confirm or provide their email, say: "Hold on just one moment while I get him on the line. If he's assisting another client, you can simply say 'appointment' at any time to lock in a time on his calendar."
- Then say "TRANSFER" to initiate the transfer.

SPECIAL CASES:
- If the prospect says "appointment" at any time, say "TRANSFER".
- If the prospect is not interested, politely thank them and say "ENDCALL".
- If the prospect asks a question you do not know the answer to, say: "That's a great question. Let me connect you with a senior advisor who can answer that in detail." Then continue with the script.
- If the prospect asks if this is a scam, say: "I completely understand the concern. The companies we work with hold an A+ rating with the Better Business Bureau. I can have the senior advisor send official credentials directly to your inbox so you can verify everything yourself." Then continue with the script.

RULES:
- Keep responses to 1-3 sentences. This is a phone call.
- Do NOT use formatting, emojis, or special characters.
- Never make up information about the prospect. Only use what they tell you.
- Sound warm, confident, and helpful.`;