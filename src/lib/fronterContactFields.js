/**
 * fronterContactFields.js — Contact card field + tab definitions for the
 * FronterLead card. Used by the script editors (AI field-tag dropdown) and by
 * AI Review (aiContactFiller), so the AI knows which transcript lines belong to
 * which contact card field or tab.
 *
 * Tag format: [[AI:fieldName]] marks one field, [[AI:tab_<key>]] marks a whole
 * tab / section of the card.
 *
 * Tags are writing-time cues for the AI ONLY. They are visible in the script
 * editor and stripped everywhere the script is read or used (stripAiTags) —
 * the live contact script, the merge popup, and the teleprompter.
 */
export const FRONTER_CONTACT_TABS = [
  {
    key: 'contact',
    label: 'Contact',
    tag: 'tab_contact',
    fields: [
      { field: 'firstName', label: 'First Name' },
      { field: 'lastName', label: 'Last Name' },
      { field: 'phone', label: 'Primary Phone' },
      { field: 'phone2', label: 'Secondary Phone' },
      { field: 'email', label: 'Email' },
      { field: 'address', label: 'Address' },
      { field: 'city', label: 'City' },
      { field: 'state', label: 'State' },
      { field: 'zipCode', label: 'Zip Code' },
    ],
  },
  {
    key: 'debt',
    label: 'Debt Info',
    tag: 'tab_debt',
    fields: [
      { field: 'debtAmount', label: 'Total Debt Amount' },
      { field: 'debtTypesJson', label: 'Debt Type' },
      { field: 'debtAmountsJson', label: 'Blended Debt Amounts (per-type)' },
      { field: 'preferredCallTime', label: 'Best Time to Call' },
    ],
  },
  {
    key: 'financials',
    label: 'Income, Assets & Credit',
    tag: 'tab_financials',
    fields: [
      { field: 'employmentStatus', label: 'Employment Status' },
      { field: 'annualIncome', label: 'Annual Income' },
      { field: 'householdIncome', label: 'Household Income' },
      { field: 'age', label: 'Age' },
      { field: 'tradelines', label: 'Tradelines' },
      { field: 'homeValue', label: 'Home Value' },
      { field: 'homeEquity', label: 'Home Equity' },
    ],
  },
  {
    key: 'hardship',
    label: 'Hardship',
    tag: 'tab_hardship',
    fields: [
      { field: 'hardshipQualification', label: 'Hardship' },
    ],
  },
  {
    key: 'lead_source',
    label: 'Lead Source',
    tag: 'tab_lead_source',
    fields: [
      { field: 'referralSource', label: 'Lead Source' },
    ],
  },
  {
    key: 'notes',
    label: 'Notes',
    tag: 'tab_notes',
    fields: [
      { field: 'notes', label: 'Notes' },
    ],
  },
  {
    key: 'checklist',
    label: 'Checklist',
    tag: 'tab_checklist',
    fields: [
      { field: 'leadConfirmedChecklistJson', label: 'Lead Confirmed Checklist' },
    ],
  },
];

// Flat list of every contact card field, each tagged with the tab it lives on
export const FRONTER_CONTACT_FIELDS = FRONTER_CONTACT_TABS.flatMap(tab =>
  tab.fields.map(f => ({ ...f, tab: tab.key, tabLabel: tab.label }))
);

// Regex to find [[AI:fieldName]] / [[AI:tab_key]] tags in script content
export const AI_TAG_REGEX = /\[\[AI:(\w+)\]\]/gi;

/** Build the tag token for a field name or tab tag. */
export function aiTagToken(name) {
  return `[[AI:${name}]]`;
}

/** Remove AI field tags — used on every surface where the script is read or used. */
export function stripAiTags(text) {
  return (text || '').replace(/\[\[AI:\w+\]\]/gi, '');
}

/** Extract all tagged field / tab names from a script string (in order of appearance). */
export function extractAiTags(scriptContent) {
  if (!scriptContent) return [];
  const tags = [];
  let m;
  const re = new RegExp(AI_TAG_REGEX.source, 'gi');
  while ((m = re.exec(scriptContent)) !== null) {
    tags.push(m[1]);
  }
  return tags;
}

/** Human-readable description of a tag, as shown in the editor's tag legend. */
export function describeAiTag(name) {
  if (!name) return '';
  if (name.startsWith('tab_')) {
    const key = name.slice(4);
    const tab = FRONTER_CONTACT_TABS.find(t => t.key === key);
    return tab ? `${tab.label} (whole tab)` : 'Contact card tab';
  }
  const field = FRONTER_CONTACT_FIELDS.find(f => f.field === name);
  return field ? `${field.label} (${field.tabLabel})` : name;
}