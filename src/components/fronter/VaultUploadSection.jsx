/**
 * VaultUploadSection.jsx — CSV upload to the lead vault.
 * Parses CSV, maps fields, and creates LeadVaultEntry records (stored privately).
 */
import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const FIELDS = [
  { key: 'firstName', label: 'First Name', required: true },
  { key: 'lastName', label: 'Last Name', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'phoneLineType', label: 'Line Type' },
  { key: 'phoneCarrier', label: 'Carrier' },
  { key: 'dncFlag', label: 'DNC' },
  { key: 'phone2', label: 'Secondary Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'apt', label: 'Apt / Unit' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zipCode', label: 'Zip Code' },
  { key: 'debtAmount', label: 'Debt Amount ($)' },
  { key: 'estimatedDebt', label: 'Estimated Debt ($)' },
  { key: 'companyName', label: 'Company Name' },
  { key: 'dob', label: 'Date of Birth' },
  { key: 'age', label: 'Age' },
  { key: 'employmentStatus', label: 'Employment Status' },
  { key: 'annualIncome', label: 'Annual Income ($)' },
  { key: 'householdIncome', label: 'Household Income ($)' },
  { key: 'homeValue', label: 'Home Value ($)' },
  { key: 'homeEquity', label: 'Home Equity ($)' },
  { key: 'tradelines', label: 'Tradelines' },
  { key: 'preferredCallTime', label: 'Best Time to Call' },
  { key: 'hardshipQualification', label: 'Hardship Qualification' },
  { key: 'notes', label: 'Notes' },
];

const NUMERIC_FIELDS = new Set(['debtAmount', 'estimatedDebt', 'age', 'annualIncome', 'householdIncome', 'homeValue', 'homeEquity', 'tradelines']);

/** Normalise a Line Type cell to the vault's enum (mobile | landline | voip | unknown). */
function normalizeLineType(v) {
  const s = String(v || '').toLowerCase().trim();
  if (!s) return '';
  if (/(voip|voice over|internet|virtual|google voice)/.test(s)) return 'voip';
  if (/(mobile|cell|wireless|gsm|sms)/.test(s)) return 'mobile';
  if (/(land|wire|fixed|residential|home)/.test(s)) return 'landline';
  return 'unknown';
}

/** True when a DNC cell means the lead is on the Do-Not-Call list. */
function isDncFlag(v) {
  const s = String(v || '').toLowerCase().trim();
  if (!s) return false;
  if (/do not call/.test(s)) return true;
  if (/\b(n|no|none|not|false|0|clean|clear|exempt|n\/a)\b/.test(s)) return false;
  return /\b(y|yes|true|1|dnc|listed|registered|on)\b/.test(s);
}

function parseCSVLine(line) {
  const result = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += char;
  }
  result.push(current.trim());
  return result;
}

function autoMatch(header) {
  const h = header.toLowerCase().trim();
  if (['line type', 'linetype', 'line_type', 'phone type', 'phonetype', 'phone_type', 'type of line'].some(p => h === p || h.includes(p))) return 'phoneLineType';
  if (['dnc', 'do not call', 'dnc status', 'dnc flag', 'dnc listed'].some(p => h === p || h.includes(p))) return 'dncFlag';
  if (['carrier', 'carrier name', 'phone carrier', 'network'].some(p => h === p || h.includes(p))) return 'phoneCarrier';
  if (['first name', 'first', 'fname', 'first_name', 'given name'].some(p => h === p || h.includes(p))) return 'firstName';
  if (['last name', 'last', 'lname', 'last_name', 'surname', 'family name'].some(p => h === p || h.includes(p))) return 'lastName';
  if (['phone', 'phone number', 'tel', 'mobile', 'cell', 'cell phone', 'telephone'].some(p => h === p || h.includes(p))) return 'phone';
  if (['phone2', 'secondary phone', 'alt phone', 'alternate phone', 'second phone'].some(p => h === p || h.includes(p))) return 'phone2';
  if (['email', 'e-mail', 'email address'].some(p => h === p || h.includes(p))) return 'email';
  if (['apt', 'apartment', 'unit', 'suite', 'ste '].some(p => h === p || h.includes(p))) return 'apt';
  if (['address', 'street', 'addr', 'mailing'].some(p => h === p || h.includes(p))) return 'address';
  if (['city', 'town', 'municipality'].some(p => h === p || h.includes(p))) return 'city';
  if (['state', 'province', 'region'].some(p => h === p || h.includes(p))) return 'state';
  if (['zip', 'zip code', 'postal', 'postcode'].some(p => h === p || h.includes(p))) return 'zipCode';
  if (['estimated debt', 'est debt', 'estimate'].some(p => h === p || h.includes(p))) return 'estimatedDebt';
  if (['debt', 'amount', 'balance', 'debt amount', 'debt balance', 'total debt'].some(p => h === p || h.includes(p))) return 'debtAmount';
  if (['company', 'business', 'employer'].some(p => h === p || h.includes(p))) return 'companyName';
  if (['age'].some(p => h === p || h.includes(p))) return 'age';
  if (['employment', 'job status', 'work status'].some(p => h === p || h.includes(p))) return 'employmentStatus';
  if (['dob', 'd.o.b', 'date of birth', 'birthdate', 'birth date', 'birth'].some(p => h === p || h.includes(p))) return 'dob';
  if (['household income'].some(p => h === p || h.includes(p))) return 'householdIncome';
  if (['income', 'salary', 'earnings'].some(p => h === p || h.includes(p))) return 'annualIncome';
  if (['home value', 'house value', 'property value'].some(p => h === p || h.includes(p))) return 'homeValue';
  if (['home equity', 'equity'].some(p => h === p || h.includes(p))) return 'homeEquity';
  if (['tradeline', 'tradelines', 'open accounts', 'number of cards', 'credit line', 'credit_line', 'credit lines', 'lines of credit', 'credit cards'].some(p => h === p || h.includes(p))) return 'tradelines';
  if (['best time', 'preferred call', 'call time', 'time to call'].some(p => h === p || h.includes(p))) return 'preferredCallTime';
  if (['hardship'].some(p => h === p || h.includes(p))) return 'hardshipQualification';
  if (['note', 'notes', 'comment', 'comments', 'remark', 'description', 'desc'].some(p => h === p || h.includes(p))) return 'notes';
  return '';
}

export default function VaultUploadSection({ adminUsername, onUploaded }) {
  const [csvText, setCsvText] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [batchLabel, setBatchLabel] = useState('');
  const [preset, setPreset] = useState({ dnc: false, validated: false, appended: false });
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const processCSV = (text) => {
    setCsvText(text);
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) { setHeaders([]); setRows([]); return; }
    const parsed = lines.map(parseCSVLine);
    const hdrs = parsed[0];
    const dataRows = parsed.slice(1).filter(r => r.some(c => c.trim()));
    setHeaders(hdrs);
    setRows(dataRows);
    const auto = {};
    hdrs.forEach((h, i) => { auto[i] = autoMatch(h); });
    setMapping(auto);
    setResult(null);
  };

  const handleFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    if (!batchLabel) setBatchLabel(file.name.replace(/\.(csv|txt)$/i, ''));
    processCSV(text);
  };

  const hasParsed = headers.length > 0;
  const mappedFields = new Set(Object.values(mapping).filter(Boolean));
  const canUpload = mappedFields.has('firstName') && mappedFields.has('lastName') && mappedFields.has('phone') && rows.length > 0 && !uploading;

  const handleUpload = async () => {
    if (!canUpload) return;
    setUploading(true);
    let success = 0, failed = 0;
    try {
      const records = [];
      const stamp = new Date().toISOString();
      for (const row of rows) {
        const rec = { batchLabel: batchLabel || 'Upload', uploadedBy: adminUsername };
        headers.forEach((h, i) => {
          const field = mapping[i];
          if (!field) return;
          let val = (row[i] || '').trim();
          if (NUMERIC_FIELDS.has(field)) val = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
          rec[field] = val;
        });
        // Steps already done before upload — mark them complete so the batch is ready to distribute.
        if (preset.appended) {
          rec.tracerfyStatus = 'completed';
          rec.tracerfyHit = true;
          rec.tracerfyProcessedAt = stamp;
        }
        if (preset.validated) {
          rec.validationStatus = 'validated';
          rec.phoneValid = true;
          rec.phoneLineType = rec.phoneLineType || 'unknown';
          rec.validatedAt = stamp;
          rec.pipelineStatus = 'ready';
        }
        if (preset.dnc) {
          rec.dncScrubStatus = 'scrubbed';
          rec.dncFederal = false;
          rec.dncState = false;
          rec.litigator = false;
          rec.llrClean = true;
          rec.llrScrubbedAt = stamp;
        }
        // Values from the file's own columns win over the "already done" presets.
        if (rec.phoneLineType !== undefined) {
          const lt = normalizeLineType(rec.phoneLineType);
          if (lt) rec.phoneLineType = lt; else delete rec.phoneLineType;
        }
        if (rec.phoneCarrier !== undefined) {
          rec.phoneCarrier = String(rec.phoneCarrier || '').trim();
          if (!rec.phoneCarrier) delete rec.phoneCarrier;
        }
        if (rec.dncFlag !== undefined) {
          if (isDncFlag(rec.dncFlag)) {
            rec.dncFederal = true;
            rec.dncScrubStatus = 'scrubbed';
            rec.llrClean = false;
            rec.llrScrubbedAt = stamp;
          }
          delete rec.dncFlag;
        }
        if (rec.firstName && rec.lastName && rec.phone) { records.push(rec); success++; }
        else failed++;
      }
      for (let i = 0; i < records.length; i += 400) {
        await base44.entities.LeadVaultEntry.bulkCreate(records.slice(i, i + 400));
      }
      setResult({ success, failed, total: rows.length });
      if (success > 0) onUploaded?.();
      // These leads gave their verbal opt-in on the call, so log an email opt-in
      // for any of them (and any earlier lead) still missing one.
      if (success > 0) {
        base44.functions.invoke('emailOptIn', { action: 'generate', vault: true, loggedBy: adminUsername }).catch(() => {});
      }
    } catch (e) {
      alert('Upload error: ' + (e?.message || String(e)));
    }
    setUploading(false);
  };

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '20px' }}>
      <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>📁 Upload to Vault</div>

      <div style={{ marginBottom: '12px', padding: '9px 10px', background: `${BLUE}0d`, border: `1px solid ${BLUE}33`, borderRadius: '6px' }}>
        <div style={{ color: BLUE, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Already Done On This File</div>
        {[['dnc', 'DNC Scrubbed'], ['validated', 'Validated'], ['appended', 'Appended']].map(([k, label]) => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#e8e0d0', fontSize: '12px', marginBottom: '4px', cursor: 'pointer' }}>
            <input type="checkbox" checked={preset[k]} onChange={e => setPreset(p => ({ ...p, [k]: e.target.checked }))} style={{ accentColor: GOLD, cursor: 'pointer' }} />
            {label}
          </label>
        ))}
        <div style={{ color: '#4a5568', fontSize: '9px', lineHeight: 1.4 }}>Ticked = marked complete for every lead in this file, so they land ready to distribute. Unticked steps still need to be run in their panels.</div>
      </div>

      {!hasParsed && !result && (
        <div>
          <div style={{ marginBottom: '10px' }}>
            <label style={ls}>Batch Label (optional)</label>
            <input value={batchLabel} onChange={e => setBatchLabel(e.target.value)} placeholder="e.g. October List" style={inp} />
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          <button onClick={() => fileRef.current?.click()} style={{ width: '100%', background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '14px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>📁 Choose CSV File</button>
          <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', margin: '10px 0' }}>— or paste CSV text —</div>
          <textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={6} placeholder="First Name,Last Name,Phone,Debt Amount" style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: '11px' }} />
          <button onClick={() => processCSV(csvText)} disabled={!csvText.trim()} style={{ width: '100%', marginTop: '8px', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px', cursor: csvText.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 'bold', opacity: csvText.trim() ? 1 : 0.4 }}>Parse CSV →</button>
        </div>
      )}

      {hasParsed && !result && (
        <div>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>🔗 Map Columns</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
            {headers.map((h, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px' }}>
                <div><div style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold' }}>{h || `Col ${i + 1}`}</div><div style={{ color: '#4a5568', fontSize: '9px', fontFamily: 'monospace' }}>{rows[0]?.[i] || '—'}</div></div>
                <div style={{ color: '#4a5568', fontSize: '12px', textAlign: 'center' }}>→</div>
                <select value={mapping[i] || ''} onChange={e => setMapping(p => ({ ...p, [i]: e.target.value }))} style={inp}>
                  <option value="">— Skip —</option>
                  {FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', background: mappedFields.has('firstName') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: mappedFields.has('firstName') ? GOLD : '#ef4444' }}>{mappedFields.has('firstName') ? '✓' : '✗'} First Name</span>
            <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', background: mappedFields.has('lastName') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: mappedFields.has('lastName') ? GOLD : '#ef4444' }}>{mappedFields.has('lastName') ? '✓' : '✗'} Last Name</span>
            <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', background: mappedFields.has('phone') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: mappedFields.has('phone') ? GOLD : '#ef4444' }}>{mappedFields.has('phone') ? '✓' : '✗'} Phone</span>
            <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '10px', background: 'rgba(96,165,250,0.15)', color: BLUE }}>{rows.length} rows</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { setHeaders([]); setRows([]); setMapping({}); setCsvText(''); }} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>← Back</button>
            <button onClick={handleUpload} disabled={!canUpload} style={{ flex: 1, background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px', cursor: canUpload ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold', opacity: canUpload ? 1 : 0.4 }}>{uploading ? '⏳ Uploading…' : `📥 Upload ${rows.length} Leads to Vault`}</button>
          </div>
        </div>
      )}

      {result && (
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>{result.failed > 0 ? '⚠️' : '✓'}</div>
          <div style={{ color: GOLD, fontSize: '16px', fontWeight: 'bold', marginBottom: '6px' }}>Upload Complete</div>
          <div style={{ color: '#8a9ab8', fontSize: '12px', marginBottom: '16px' }}>
            <span style={{ color: GOLD, fontWeight: 'bold' }}>{result.success}</span> leads staged in vault — pending validation.
            {result.failed > 0 && <><br/><span style={{ color: '#ef4444' }}>{result.failed} rows skipped (missing required fields)</span></>}
          </div>
          <button onClick={() => { setResult(null); setHeaders([]); setRows([]); setCsvText(''); setBatchLabel(''); }} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 24px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Done</button>
        </div>
      )}
    </div>
  );
}