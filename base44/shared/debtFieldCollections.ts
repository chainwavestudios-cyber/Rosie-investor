// Validate collections before they can reach a contact-card write.
export const DEBT_COLLECTIONS = {
  debtLedgerJson: { creditor: 'string', balance: 'number', creditLimit: 'number', interestRate: 'number', monthlyPayment: 'number', paymentSchedule: 'string', accountLast4: 'string', notes: 'string' },
  nonAcceptedCreditorsJson: { creditor: 'string', balance: 'number', accountLast4: 'string', notes: 'string' },
  cosignersJson: { name: 'string', relationship: 'string', phone: 'string', email: 'string', accounts: 'string', employed: 'string', notes: 'string' },
  billsJson: null,
};
function parse(value, fallback) {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}
export function validateDebtCollection(field, raw) {
  const value = parse(raw, null);
  if (field === 'billsJson') {
    if (!value || Array.isArray(value) || typeof value !== 'object') return { valid: false, cleaned: null };
    const bills = {};
    for (const [key, amount] of Object.entries(value)) {
      const num = typeof amount === 'number' ? amount : typeof amount === 'string' && amount.trim() ? Number(amount.replace(/[$,\s]/g, '')) : NaN;
      if (/^[a-z][a-zA-Z0-9]{0,63}$/.test(key) && !['constructor', 'prototype', '__proto__'].includes(key) && Number.isFinite(num) && num >= 0) bills[key] = num;
    }
    return { valid: Object.keys(bills).length > 0, cleaned: JSON.stringify(bills) };
  }
  const shape = DEBT_COLLECTIONS[field];
  if (!shape || !Array.isArray(value)) return { valid: false, cleaned: null };
  const cleaned = value.slice(0, 100).flatMap(entry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = {};
    for (const [key, type] of Object.entries(shape)) {
      const val = entry[key];
      if (type === 'string' && typeof val === 'string' && val.trim()) row[key] = val.trim();
      if (type === 'number' && (typeof val === 'number' || typeof val === 'string' && val.trim())) {
        const num = Number(typeof val === 'string' ? val.replace(/[$,%\s]/g, '') : val);
        if (Number.isFinite(num) && num >= 0) row[key] = num;
      }
    }
    if (row.paymentSchedule && !['monthly', 'biweekly', 'weekly', 'irregular', 'past_due'].includes(row.paymentSchedule)) delete row.paymentSchedule;
    const identity = field === 'cosignersJson' ? 'name' : 'creditor';
    return row[identity] ? [row] : [];
  });
  return { valid: cleaned.length > 0, cleaned: JSON.stringify(cleaned) };
}
export function mergeDebtCollection(field, existing, incoming) {
  const patch = parse(incoming, field === 'billsJson' ? {} : []);
  if (field === 'billsJson') return JSON.stringify({ ...parse(existing, {}), ...patch });
  const rows = [...parse(existing, [])];
  const identity = field === 'cosignersJson' ? 'name' : 'creditor';
  for (const entry of patch) {
    const matching = rows.map((row, index) => ({ row, index })).filter(({ row }) => String(row[identity] || '').toLowerCase() === String(entry[identity] || '').toLowerCase());
    const match = matching.find(({ row }) => entry.accountLast4 && row.accountLast4 === entry.accountLast4) || (matching.length === 1 && (!entry.accountLast4 || !matching[0].row.accountLast4) ? matching[0] : null);
    if (match) rows[match.index] = { ...rows[match.index], ...entry };
    else rows.push(entry);
  }
  return JSON.stringify(rows);
}