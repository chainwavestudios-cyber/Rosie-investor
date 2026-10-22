/**
 * debtContactFields.js — Contact card field + tab definitions for the DebtLead
 * card (Debt Call Coach). Used by the script editors (AI field-tag dropdown) and
 * read by AI Review (aiContactFiller), so the AI knows which transcript lines
 * belong to which contact card field or tab.
 *
 * Tag format: [[AI:fieldName]] marks one field, [[AI:tab_<key>]] marks a whole
 * tab / section of the card.
 *
 * Tags are writing-time cues for the AI ONLY. They are visible in the script
 * editor and stripped everywhere the script is read or used (stripAiTags) —
 * the live script, the teleprompter and the closing view.
 */
import { DEBT_DETAIL_TABS, DEBT_LEDGER_FIELDS, DEBT_NONACCEPTED_FIELDS } from '@/lib/debtContactDetailFields';

export const DEBT_CONTACT_TABS = [
  {
    key: 'contact',
    label: 'Overview',
    tag: 'tab_contact',
    fields: [
      { field: 'firstName', label: 'First Name' },
      { field: 'lastName', label: 'Last Name' },
      { field: 'leadNumber', label: 'Notice / Lead Number' },
      { field: 'phone', label: 'Phone' },
      { field: 'email', label: 'Email' },
      { field: 'address', label: 'Address' },
      { field: 'city', label: 'City' },
      { field: 'state', label: 'State' },
      { field: 'zip', label: 'Zip' },
      { field: 'dateOfBirth', label: 'Date of Birth' },
      { field: 'age', label: 'Age' },
      { field: 'status', label: 'Status' },
    ],
  },
  {
    key: 'debt',
    label: 'Debt Details',
    tag: 'tab_debt',
    fields: [
      { field: 'debtAmount', label: 'Total Debt Amount' },
      { field: 'creditorCount', label: 'Number of Creditors' },
      { field: 'creditors', label: 'Creditors List' },
      { field: 'behindOnPayments', label: 'Behind on Payments' },
      { field: 'monthsBehind', label: 'Months Behind' },
      { field: 'programEnrolled', label: 'Enrolled in Program' },
      { field: 'enrollmentDate', label: 'Enrollment Date' },
    ],
  },
  {
    key: 'ledger',
    label: 'Debt Ledger',
    tag: 'tab_ledger',
    fields: [
      { field: 'debtLedgerJson', label: 'Debt Ledger (all creditor details)' },
      ...DEBT_LEDGER_FIELDS,
    ],
  },
  {
    key: 'nonaccepted',
    label: 'Non-Accepted',
    tag: 'tab_nonaccepted',
    fields: [
      { field: 'nonAcceptedCreditorsJson', label: 'Non-Accepted Creditors (with reasons)' },
      ...DEBT_NONACCEPTED_FIELDS,
    ],
  },
  {
    key: 'financials',
    label: 'Debt / Financial Information',
    tag: 'tab_financials',
    fields: [
      { field: 'employmentStatus', label: 'Employment Status' },
      { field: 'monthlyIncome', label: 'Monthly Income' },
      { field: 'creditScore', label: 'Credit Score' },
      { field: 'householdIncome', label: 'Household Income' },
      { field: 'homeValue', label: 'Home Value' },
      { field: 'homeEquity', label: 'Home Equity' },
      { field: 'tradelines', label: 'Number of Tradelines' },
    ],
  },
  ...DEBT_DETAIL_TABS,
  {
    key: 'hardship',
    label: 'Hardship',
    tag: 'tab_hardship',
    fields: [
      { field: 'hardshipWhen', label: 'Hardship — When it started' },
      { field: 'hardshipWhy', label: 'Hardship — Why it happened' },
      { field: 'hardshipHow', label: 'Hardship — How it affects them' },
    ],
  },
  {
    key: 'appointment',
    label: 'Appointment',
    tag: 'tab_appointment',
    fields: [
      { field: 'appointmentDate', label: 'Appointment Date' },
      { field: 'appointmentTitle', label: 'Appointment Title' },
      { field: 'callbackAt', label: 'Callback Time' },
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
];

// Flat list of every contact card field, each tagged with the tab it lives on
export const DEBT_CONTACT_FIELDS = DEBT_CONTACT_TABS.flatMap(tab =>
  tab.fields.map(f => ({ ...f, tab: tab.key, tabLabel: tab.label }))
);

/** Build the tag token for a field name or tab tag. */
export function debtAiTagToken(name) {
  return `[[AI:${name}]]`;
}

/** Human-readable description of a tag, as shown in the editor's tag legend. */
export function describeDebtAiTag(name) {
  if (!name) return '';
  if (name.startsWith('tab_')) {
    const key = name.slice(4);
    const tab = DEBT_CONTACT_TABS.find(t => t.key === key);
    return tab ? `${tab.label} (whole tab)` : 'Contact card tab';
  }
  const field = DEBT_CONTACT_FIELDS.find(f => f.field === name);
  return field ? `${field.label} (${field.tabLabel})` : name;
}