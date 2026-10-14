/**
 * fronterContactFields.js — Contact card field definitions for the FronterLead
 * entity. Used by the script editor (field-tag dropdown) and AI Review (tag
 * parsing) so the AI knows which transcript lines belong to which contact
 * card field.
 *
 * Tags inserted into scripts use the format: [[AI:fieldName]]
 * When AI Review runs, it passes the script (with tags) to aiContactFiller,
 * which tells the LLM that the lines near a tag are relevant for that field.
 */
export const FRONTER_CONTACT_FIELDS = [
  { field: 'firstName',          label: 'First Name' },
  { field: 'lastName',           label: 'Last Name' },
  { field: 'phone',              label: 'Primary Phone' },
  { field: 'phone2',             label: 'Secondary Phone' },
  { field: 'email',              label: 'Email' },
  { field: 'address',            label: 'Address' },
  { field: 'city',               label: 'City' },
  { field: 'state',              label: 'State' },
  { field: 'zipCode',            label: 'Zip Code' },
  { field: 'preferredCallTime',  label: 'Best Time to Call' },
  { field: 'employmentStatus',  label: 'Employment Status' },
  { field: 'annualIncome',       label: 'Annual Income' },
  { field: 'debtAmount',         label: 'Debt Amount' },
  { field: 'hardshipQualification', label: 'Hardship' },
  { field: 'referralSource',    label: 'Lead Source' },
];

// Regex to find [[AI:fieldName]] tags in script content
export const AI_TAG_REGEX = /\[\[AI:(\w+)\]\]/gi;

// Extract all tagged field names from a script string (in order of appearance)
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