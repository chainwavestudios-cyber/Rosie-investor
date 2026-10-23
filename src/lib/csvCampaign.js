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
  { key: 'fullName', label: 'Full name (split into first / last)', derived: true },
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Company' },
  { key: 'fullAddress', label: 'Full address (split into street / city / state / ZIP)', derived: true },
  { key: 'address', label: 'Street address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'ZIP' },
  { key: 'source', label: 'Lead source' },
  { key: 'debtAmount', label: 'Debt amount ($)' },
  { key: 'leadDate', label: 'Lead date (when the lead came in)' },
  { key: 'status', label: 'Status' },
];

/** Header spellings seen in the wild, per field. */
const SYNONYMS = {
  email: ['email', 'e-mail', 'emailaddress', 'emailaddress1', 'mail', 'workemail', 'primaryemail', 'contactemail'],
  fullName: ['fullname', 'name', 'contactname', 'customername', 'clientname', 'ownername', 'displayname', 'leadname', 'full'],
  firstName: ['firstname', 'first', 'fname', 'givenname', 'firstnm', 'contactfirstname', 'ownerfirstname'],
  lastName: ['lastname', 'last', 'lname', 'surname', 'familyname', 'lastnm', 'contactlastname'],
  phone: ['phone', 'phonenumber', 'mobile', 'cell', 'cellphone', 'telephone', 'tel', 'phone1', 'primaryphone', 'contactphone'],
  company: ['company', 'companyname', 'business', 'businessname', 'organization', 'org', 'employer'],
  fullAddress: ['fulladdress', 'completeaddress', 'mailingaddress', 'addressfull', 'fulladdressline', 'propertyaddress'],
  address: ['address', 'street', 'streetaddress', 'addressline1', 'address1', 'homeaddress', 'addr', 'mailingline'],
  city: ['city', 'town', 'municipality'],
  state: ['state', 'st', 'province', 'region'],
  zip: ['zip', 'zipcode', 'postalcode', 'postcode', 'zip5', 'zipcode5'],
  source: ['leadsource', 'source', 'referral', 'referralsource', 'campaign', 'channel', 'origin', 'leadorigin'],
  debtAmount: ['debtamount', 'debt', 'totaldebt', 'debtbalance', 'unsecureddebt', 'creditcarddebt', 'amountowed', 'debtvalue', 'balance', 'amount'],
  leadDate: ['leaddate', 'datecreated', 'createddate', 'createdat', 'dateadded', 'leaddateadded', 'signupdate', 'entrydate', 'optindate', 'inquirydate'],
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

/** The US states a written-out state name is shortened to. */
const US_STATES = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY',
  louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'puerto rico': 'PR',
};
const STATE_CODES = new Set(Object.values(US_STATES));

const HONORIFIC = /^(mr|mrs|ms|miss|dr|prof|sir|madam)\.?\s+/i;

/** One "Full name" cell split into its two halves. */
export function splitFullName(value) {
  let text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return { firstName: '', lastName: '' };
  text = text.replace(HONORIFIC, '');
  // "Smith, John" and surname-first exports read the same way once the comma is honored.
  const comma = text.indexOf(',');
  if (comma > 0) {
    const last = text.slice(0, comma).trim();
    const first = text.slice(comma + 1).replace(/\s+/g, ' ').trim();
    if (first) return { firstName: first, lastName: last };
  }
  const parts = text.split(' ').filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/** A state cell that is either "CA", "ca." or "California". */
function stateCode(piece) {
  const text = String(piece ?? '').replace(/[.\s]+$/, '').trim();
  if (!text) return '';
  const upper = text.toUpperCase();
  if (upper.length === 2 && STATE_CODES.has(upper)) return upper;
  const key = text.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
  return US_STATES[key] || '';
}

/**
 * One "Full address" cell split into street, city, state and ZIP. Handles the
 * shapes real lists carry: "123 Main St, Riverside, CA 92501", the same without a
 * ZIP, a state written out in full, an apartment on its own comma, "Riverside, CA
 * 92501" with no street at all, and a bare street address that splits into
 * nothing but itself.
 */
export function parseAddressLine(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  const out = { address: '', city: '', state: '', zip: '' };
  if (!text) return out;

  let parts = text.split(',').map((part) => part.trim()).filter(Boolean);

  const zipAt = parts.findIndex((part) => /\b\d{5}(?:-\d{4})?\b/.test(part));
  if (zipAt >= 0) {
    out.zip = (parts[zipAt].match(/\b(\d{5}(?:-\d{4})?)\b/) || [])[1] || '';
    parts[zipAt] = parts[zipAt].replace(/\b\d{5}(?:-\d{4})?\b/, '').trim();
    if (!parts[zipAt]) parts.splice(zipAt, 1);
  }

  // The state is the piece that names one — never the first piece, which is the street.
  const stateAt = parts.findIndex((part, index) => index > 0 && stateCode(part));
  if (stateAt >= 0) {
    out.state = stateCode(parts[stateAt]);
    parts.splice(stateAt, 1);
  }

  // With a state or ZIP present, the last piece left is the city even when the list
  // carried no street at all ("Riverside, CA 92501").
  if (parts.length > 1 || (parts.length === 1 && (out.state || out.zip))) {
    out.city = parts[parts.length - 1];
    parts = parts.slice(0, -1);
  }
  out.address = parts.join(', ');
  return out;
}

/** A money cell as a plain number ("$12,500.00" → "12500"), or '' when it holds no figure. */
export function parseAmountCell(value) {
  const digits = String(value ?? '').replace(/[^0-9.]/g, '');
  const number = Number(digits);
  return digits && Number.isFinite(number) ? String(number) : '';
}

/** A date cell as YYYY-MM-DD — ISO, US "10/01/2026", "October 1, 2026" — or the text as typed. */
export function parseDateCell(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const us = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(text);
  if (us) {
    let year = Number(us[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return `${year}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  return text;
}

/** The fields whose cell needs cleaning before it is saved. */
const CELL_CLEANERS = { debtAmount: parseAmountCell, leadDate: parseDateCell };

/** A row as the plain object the importer expects, using the confirmed mapping. */
export function applyMapping(row, mapping) {
  const mapped = {};
  for (const field of CAMPAIGN_FIELDS) {
    if (field.derived) continue;
    const column = mapping[field.key];
    if (!column) continue;
    const raw = String(row[column] ?? '').trim();
    if (!raw) continue;
    const clean = CELL_CLEANERS[field.key];
    const value = clean ? clean(raw) : raw;
    if (value) mapped[field.key] = value;
  }

  // A combined column is split for the operator; nothing it produces overwrites a
  // field that was mapped to a column of its own.
  if (mapping.fullName) {
    const split = splitFullName(row[mapping.fullName]);
    if (!mapped.firstName) mapped.firstName = split.firstName;
    if (!mapped.lastName) mapped.lastName = split.lastName;
  }
  const addressColumn = mapping.fullAddress || mapping.address;
  if (addressColumn) {
    // A street-address column that turns out to hold commas is really a full address.
    const text = String(row[addressColumn] ?? '');
    if (mapping.fullAddress || text.includes(',')) {
      const parsed = parseAddressLine(text);
      if (!mapped.address) mapped.address = parsed.address;
      if (!mapped.city) mapped.city = parsed.city;
      if (!mapped.state) mapped.state = parsed.state;
      if (!mapped.zip) mapped.zip = parsed.zip;
    }
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