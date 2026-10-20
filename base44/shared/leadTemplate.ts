/**
 * leadTemplate.ts — Contact-card (FronterLead) tag substitution for the AI agent.
 *
 * Used by mediaStreamRelay for incoming-call language: Adam's opening line and
 * the inbound system prompt are rendered against the card the caller-ID reverse
 * lookup produced. Unknown tags are left untouched so script markers such as
 * {{contingency_time}} are never stripped.
 *
 * Mirrors the tag list shown in the admin Incoming Calls tab
 * (src/components/fronter/aiagent/inboundLeadTags.js) — keep the two in sync.
 */
export interface LeadTemplateOptions {
  /** AI agent persona name, exposed as {{agent_name}}. */
  agentName?: string;
  /** Inbound region detected for the caller, exposed as {{region}}. */
  region?: string;
  /** Spoken-name fallback for inbound callers whose card has no first name. */
  fallbackFirstName?: string;
}

const text = (value: any): string => (value === null || value === undefined ? '' : String(value));

const money = (value: any): string => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '';
};

const debtTypes = (value: any): string => {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((entry: any) => (typeof entry === 'string' ? entry : entry?.type || '')).filter(Boolean).join(', ');
    }
  } catch {
    // Not JSON — fall through to the raw value.
  }
  return text(value);
};

/** Every tag value available to the incoming-call language, keyed by tag name. */
export function leadTagValues(lead: any, options: LeadTemplateOptions = {}): Record<string, string> {
  const card = lead || {};
  const cardFirst = text(card.firstName);
  const first = options.fallbackFirstName && (!cardFirst || cardFirst === 'Inbound') ? options.fallbackFirstName : cardFirst;
  const last = text(card.lastName);

  return {
    first_name: first,
    last_name: last,
    full_name: [first, last].filter(Boolean).join(' '),
    phone: text(card.phone),
    phone2: text(card.phone2),
    email: text(card.email),
    address: text(card.address),
    city: text(card.city),
    state: text(card.state),
    zip: text(card.zipCode),
    region: text(options.region || card.inboundRegion),
    debt_amount: money(card.debtAmount),
    debt_types: debtTypes(card.debtTypesJson),
    preferred_call_time: text(card.preferredCallTime),
    employment_status: text(card.employmentStatus),
    annual_income: money(card.annualIncome),
    household_income: money(card.householdIncome),
    age: text(card.age),
    home_value: money(card.homeValue),
    home_equity: money(card.homeEquity),
    tradelines: text(card.tradelines),
    lead_number: text(card.leadNumber),
    agent_name: text(options.agentName),
  };
}

/** Replaces every {{tag}} with the contact-card value. Unknown tags are left as typed. */
export function renderLeadTemplate(template: string, lead: any, options: LeadTemplateOptions = {}): string {
  if (!template) return template;
  const values = leadTagValues(lead, options);
  return String(template).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key) => {
    const name = String(key).toLowerCase();
    return Object.prototype.hasOwnProperty.call(values, name) ? values[name] || '' : match;
  });
}