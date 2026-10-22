// Child-field tags use underscores so existing script readers strip them safely.
export const DEBT_DETAIL_TABS = [
  { key: 'bills', label: 'Bills / Monthly Expenses', tag: 'tab_bills', fields: [
    { field: 'billsJson', label: 'All Monthly Bills (including custom expenses)' },
    ...Object.entries({ rent: 'Rent / Mortgage', auto: 'Auto Payment', autoInsurance: 'Auto Insurance', gas: 'Gas', groceries: 'Groceries', utilities: 'Utilities', phone: 'Phone Bill', internet: 'Internet', studentLoans: 'Student Loans', healthInsurance: 'Health Insurance', childcare: 'Childcare', misc: 'Miscellaneous' }).map(([key, label]) => ({ field: `billsJson_${key}`, label })),
  ] },
  { key: 'cosigners', label: 'Co-Signers', tag: 'tab_cosigners', fields: [
    { field: 'cosignersJson', label: 'All Co-Signer Details' },
    ...Object.entries({ name: 'Name', relationship: 'Relationship', phone: 'Phone', email: 'Email', accounts: 'Accounts Co-Signed', employed: 'Employment', notes: 'Notes' }).map(([key, label]) => ({ field: `cosignersJson_${key}`, label: `Co-Signer — ${label}` })),
  ] },
];

export const DEBT_LEDGER_FIELDS = Object.entries({ creditor: 'Creditor Name', balance: 'Balance', creditLimit: 'Credit Limit', interestRate: 'Interest Rate', monthlyPayment: 'Minimum / Monthly Payment', paymentSchedule: 'Payment Schedule', accountLast4: 'Account Last 4', notes: 'Account Notes' }).map(([key, label]) => ({ field: `debtLedgerJson_${key}`, label }));
export const DEBT_NONACCEPTED_FIELDS = Object.entries({ creditor: 'Creditor Name', balance: 'Balance', accountLast4: 'Account Last 4', notes: 'Notes / Reason' }).map(([key, label]) => ({ field: `nonAcceptedCreditorsJson_${key}`, label }));