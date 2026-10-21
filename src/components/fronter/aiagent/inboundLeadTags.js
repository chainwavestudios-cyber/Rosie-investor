/**
 * inboundLeadTags.js — The contact-card tags available to the incoming-call
 * language. Every tag here is filled from the caller's card after the
 * caller-ID reverse lookup.
 *
 * Mirrors leadTagValues() in base44/shared/leadTemplate.ts — keep the two in
 * sync when a tag is added or removed.
 */
export const INBOUND_LEAD_TAGS = [
  { tag: 'first_name', label: 'First Name', example: 'Maria' },
  { tag: 'last_name', label: 'Last Name', example: 'Gonzalez' },
  { tag: 'full_name', label: 'Full Name', example: 'Maria Gonzalez' },
  { tag: 'phone', label: 'Primary Phone', example: '951-555-0142' },
  { tag: 'phone2', label: 'Secondary Phone', example: '951-555-0188' },
  { tag: 'email', label: 'Email', example: 'maria@example.com' },
  { tag: 'address', label: 'Street Address', example: '1420 Palm Ave' },
  { tag: 'city', label: 'City', example: 'Riverside' },
  { tag: 'state', label: 'State', example: 'CA' },
  { tag: 'zip', label: 'Zip Code', example: '92501' },
  { tag: 'region', label: 'Detected Inbound Region', example: 'riverside' },
  { tag: 'debt_amount', label: 'Debt Amount', example: '$24,500' },
  { tag: 'debt_types', label: 'Debt Types', example: 'Unsecured Credit Card, Unsecured Loans' },
  { tag: 'preferred_call_time', label: 'Best Time to Call', example: 'Evenings after 6pm' },
  { tag: 'employment_status', label: 'Employment Status', example: 'employed' },
  { tag: 'annual_income', label: 'Annual Income', example: '$62,000' },
  { tag: 'household_income', label: 'Household Income', example: '$88,000' },
  { tag: 'age', label: 'Age', example: '47' },
  { tag: 'home_value', label: 'Home Value', example: '$410,000' },
  { tag: 'home_equity', label: 'Home Equity', example: '$120,000' },
  { tag: 'tradelines', label: 'Tradelines', example: '6' },
  { tag: 'lead_number', label: 'Lead Number', example: '#F0001' },
  { tag: 'notice_id', label: 'Notice ID', example: 'NFS-99999-999' },
  { tag: 'agent_name', label: 'AI Agent Name', example: 'Adam' },
];