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
  { key: 'phone2', label: 'Secondary Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'state', label: 'State' },
  { key: 'zipCode', label: 'Zip Code' },
  { key: 'debtAmount', label: 'Debt Amount ($)' },
  { key: 'notes', label: 'Notes' },
];

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
  if (['first name', 'first', 'fname', 'first_name', 'given name'].some(p => h === p || h.includes(p))) return 'firstName';
  if (['last name', 'last', 'lname', 'last_name', 'surname', 'family name'].some(p => h === p || h.includes(p))) return 'lastName';
  if (['phone', 'phone number', 'tel', 'mobile', 'cell', 'cell phone', 'telephone'].some(p => h === p || h.includes(p))) return 'phone';
  if (['phone2', 'secondary phone', 'alt phone', 'alternate phone', 'second phone'].some(p => h === p || h.includes(p))) return 'phone2';
  if (['email', 'e-mail', 'email address'].some(p => h === p || h.includes(p))) return 'email';
  if (['address', 'street', 'addr', 'mailing'].some(p => h === p || h.includes(p))) return 'address';
  if (['state'].some(p => h === p || h.includes(p))) return 'state';
  if (['zip', 'zip code', 'postal', 'postcode'].some(p => h === p || h.includes(p))) return 'zipCode';
  if (['debt', 'amount', 'balance', 'debt amount', 'debt balance', 'total debt'].some(p => h === p || h.includes(p))) return 'debtAmount';
  if (['note', 'notes', 'comment', 'comments', 'remark', 'description', 'desc'].some(p => h === p || h.includes(p))) return 'notes';
  return '';
}

export default function VaultUploadSection({ adminUsername, onUploaded }) {
  const [csvText, setCsvText] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [batchLabel, setBatchLabel] = useState('');
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
      for (const row of rows) {
        const rec = { batchLabel: batchLabel || 'Upload', uploadedBy: adminUsername };
        headers.forEach((h, i) => {
          const field = mapping[i];
          if (!field) return;
          let val = (row[i] || '').trim();
          if (field === 'debtAmount') val = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
          rec[field] = val;
        });
        if (rec.firstName && rec.lastName && rec.phone) { records.push(rec); success++; }
        else failed++;
      }
      for (let i = 0; i < records.length; i += 400) {
        await base44.entities.LeadVaultEntry.bulkCreate(records.slice(i, i + 400));
      }
      setResult({ success, failed, total: rows.length });
      if (success > 0) onUploaded?.();
    } catch (e) {
      alert('Upload error: ' + (e?.message || String(e)));
    }
    setUploading(false);
  };

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '20px' }}>
      <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>📁 Upload to Vault</div>

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