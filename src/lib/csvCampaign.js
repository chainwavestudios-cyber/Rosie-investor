/**
 * csvCampaign.js — reading a contacts CSV in the browser and mapping its columns
 * to Settlement IQ fields.
 *
 * Handles what real exports throw at it: a UTF-8 BOM, CRLF line endings, quoted
 * fields with commas or newlines inside them, and headers spelled a dozen ways.
 * The sending itself never happens here — this only prepares and describes rows.
 */

/** The Settlement IQ fields a CSV column can be mapped onto. */
export const CAMPAIGN_FIELDS = [
  { key: 'email', label: 'Email address', required: true },
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Company' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'source', label: 'Lead source' },
  { key: 'status', label: 'Status' },
];

/** Header spellings seen in the wild, per field. */
const SYNONYMS = {
  email: ['email', 'e-mail', 'emailaddress', 'emailaddress1', 'mail', 'workemail', 'primaryemail', 'contactemail'],
  firstName: ['firstname', 'first', 'fname', 'givenname', 'firstnm', 'contactfirstname', 'ownerfirstname'],
  lastName: ['lastname', 'last', 'lname', 'surname', 'familyname', 'lastnm', 'contactlastname'],
  phone: ['phone', 'phonenumber', 'mobile', 'cell', 'cellphone', 'telephone', 'tel', 'phone1', 'primaryphone', 'contactphone'],
  company: ['company', 'companyname', 'business', 'businessname', 'organization', 'org', 'employer'],
  city: ['city', 'town', 'municipality'],
  state: ['state', 'st', 'province', 'region'],
  source: ['leadsource', 'source', 'referral', 'referralsource', 'campaign', 'channel', 'origin', 'leadorigin'],
  status: ['status', 'leadstatus', 'stage', 'pipeline', 'disposition'],
};

const norm = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

/** Split CSV text into a grid of cells, honoring quotes and escaped quotes. */
export function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') { cell += '"'; i += 1; } else { quoted = false; }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',' || char === ';' || char === '\t') { row.push(cell); cell = ''; continue; }
    if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    if (char === '\r') continue;
    cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((cells) => cells.some((value) => String(value).trim() !== ''));
}

/** The file as headers + row objects, with blank rows dropped. */
export function readCsv(text) {
  const grid = parseCsv(text);
  if (!grid.length) return { headers: [], rows: [] };
  const headers = grid[0].map((header, i) => String(header || '').trim() || `Column ${i + 1}`);
  const rows = grid.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, i) => { record[header] = String(cells[i] ?? '').trim(); });
    return record;
  });
  return { headers, rows };
}

/** Best guess at which column holds each field — used to pre-fill the mapping. */
export function suggestMapping(headers) {
  const mapping = {};
  const taken = new Set();
  for (const field of CAMPAIGN_FIELDS) {
    const wanted = SYNONYMS[field.key] || [];
    const hit = headers.find((header) => !taken.has(header) && wanted.includes(norm(header)));
    if (hit) { mapping[field.key] = hit; taken.add(hit); }
  }
  // Nothing matched an email column — fall back to any header that looks like one.
  if (!mapping.email) {
    const hit = headers.find((header) => !taken.has(header) && norm(header).includes('email'));
    if (hit) mapping.email = hit;
  }
  return mapping;
}

/** A row as the plain object the importer expects, using the confirmed mapping. */
export function applyMapping(row, mapping) {
  const mapped = {};
  for (const field of CAMPAIGN_FIELDS) {
    const column = mapping[field.key];
    if (column) mapped[field.key] = String(row[column] ?? '').trim();
  }
  const used = new Set(Object.values(mapping).filter(Boolean));
  const extra = {};
  for (const [column, value] of Object.entries(row)) {
    const text = String(value ?? '').trim();
    if (!used.has(column) && text) extra[column] = text;
  }
  return { ...mapped, custom: extra };
}

/** Loose sanity check for the upload step, before any server validation. */
export function looksLikeEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(value || '').trim().toLowerCase());
}

/** The rejection export: every excluded row with the reason it was excluded. */
export function rejectionCsv(rows) {
  const header = ['Email', 'FirstName', 'LastName', 'Reason'];
  const lines = [header.join(',')];
  for (const row of rows) {
    const cells = [row.email, row.firstName, row.lastName, row.reason].map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`);
    lines.push(cells.join(','));
  }
  return lines.join('\r\n');
}

/** Triggers a browser download for generated CSV text. */
export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}