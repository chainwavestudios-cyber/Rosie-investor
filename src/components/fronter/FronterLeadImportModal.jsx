/**
 * FronterLeadImportModal.jsx — CSV import wizard with field mapping.
 * Upload a CSV, match each column to the right contact card field, preview, and import.
 * All imported leads start as 'prospect' status.
 */
import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const FIELDS = [
  { key: 'firstName', label: 'First Name', required: true },
  { key: 'lastName', label: 'Last Name', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'address', label: 'Address' },
  { key: 'debtAmount', label: 'Debt Amount ($)' },
  { key: 'notes', label: 'Notes' },
];

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  return lines.map(parseCSVLine);
}

function autoMatchHeader(header) {
  const h = header.toLowerCase().trim();
  if (['first name', 'first', 'fname', 'first_name', 'given name'].some(p => h === p || h.includes(p))) return 'firstName';
  if (['last name', 'last', 'lname', 'last_name', 'surname', 'family name'].some(p => h === p || h.includes(p))) return 'lastName';
  if (['phone', 'phone number', 'tel', 'mobile', 'cell', 'cell phone', 'telephone'].some(p => h === p || h.includes(p))) return 'phone';
  if (['address', 'street', 'addr', 'mailing'].some(p => h === p || h.includes(p))) return 'address';
  if (['debt', 'amount', 'balance', 'debt amount', 'debt balance', 'total debt'].some(p => h === p || h.includes(p))) return 'debtAmount';
  if (['note', 'notes', 'comment', 'comments', 'remark', 'description', 'desc'].some(p => h === p || h.includes(p))) return 'notes';
  return '';
}

export default function FronterLeadImportModal({ assignedTos, assignedBy, onClose, onImported }) {
  const [csvText, setCsvText] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const processCSV = (text) => {
    setCsvText(text);
    const parsed = parseCSV(text);
    if (parsed.length === 0) { setHeaders([]); setRows([]); return; }
    const hdrs = parsed[0];
    const dataRows = parsed.slice(1).filter(r => r.some(c => c.trim()));
    setHeaders(hdrs);
    setRows(dataRows);
    const auto = {};
    hdrs.forEach((h, i) => { auto[i] = autoMatchHeader(h); });
    setMapping(auto);
    setResult(null);
  };

  const handleFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    processCSV(text);
  };

  const hasParsed = headers.length > 0;
  const mappedFields = new Set(Object.values(mapping).filter(Boolean));
  const hasFirstName = mappedFields.has('firstName');
  const hasLastName = mappedFields.has('lastName');
  const hasPhone = mappedFields.has('phone');
  const canImport = hasFirstName && hasLastName && hasPhone && rows.length > 0 && !importing;

  const handleImport = async () => {
    if (!assignedTos || assignedTos.length === 0) { alert('Select at least one fronter to assign leads to first.'); return; }
    if (!canImport) return;
    setImporting(true);
    let success = 0, failed = 0;
    try {
      const existing = await base44.entities.FronterLead.list('-created_date', 1);
      let num = existing?.[0]?.leadNumber ? parseInt(existing[0].leadNumber.replace(/\D/g, '')) + 1 : 1;

      const records = [];
      for (const row of rows) {
        const rec = {
          status: 'prospect',
          assignedAt: new Date().toISOString(),
          assignedBy,
          uploadedBy: assignedBy,
        };
        headers.forEach((h, i) => {
          const field = mapping[i];
          if (!field) return;
          let val = (row[i] || '').trim();
          if (field === 'debtAmount') val = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
          rec[field] = val;
        });
        if (rec.firstName && rec.lastName && rec.phone) {
          rec.leadNumber = `#F${String(num++).padStart(4, '0')}`;
          records.push(rec);
          success++;
        } else {
          failed++;
        }
      }

      // Round-robin assign across selected fronters (split evenly)
      records.forEach((rec, i) => { rec.assignedTo = assignedTos[i % assignedTos.length]; });

      // Bulk create in batches of 400
      for (let i = 0; i < records.length; i += 400) {
        await base44.entities.FronterLead.bulkCreate(records.slice(i, i + 400));
      }
      setResult({ success, failed, total: rows.length });
      if (success > 0) onImported?.();
    } catch (e) {
      alert('Import error: ' + (e?.message || String(e)));
    }
    setImporting(false);
  };

  const placeholderText = 'First Name,Last Name,Phone,Address,Debt Amount,Notes\nJohn,Smith,555-123-4567,123 Main St,15000,Interested\nJane,Doe,555-987-6543,456 Oak Ave,25000,callback tomorrow';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', width: '100%', maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📁 Import Leads from CSV</div>
            <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '2px' }}>Assigning to: <span style={{ color: BLUE, fontWeight: 'bold' }}>{(assignedTos && assignedTos.length > 0) ? assignedTos.join(', ') : '— select fronter(s) first —'}</span></div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px', padding: 0 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* Step 1: Upload */}
          {!hasParsed && (
            <div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                <button onClick={() => fileRef.current?.click()} style={{ flex: 1, background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '14px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>📁 Choose CSV File</button>
              </div>
              <div style={{ color: '#4a5568', fontSize: '11px', textAlign: 'center', marginBottom: '14px' }}>— or paste CSV text below —</div>
              <textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={8} placeholder={placeholderText} style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: '11px' }} />
              <button onClick={() => processCSV(csvText)} disabled={!csvText.trim()} style={{ width: '100%', marginTop: '10px', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px', cursor: csvText.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 'bold', opacity: csvText.trim() ? 1 : 0.4 }}>Parse CSV →</button>
            </div>
          )}

          {/* Step 2: Map fields + preview */}
          {hasParsed && !result && (
            <div>
              <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>🔗 Map Columns to Contact Card Fields</div>
              <div style={{ color: '#4a5568', fontSize: '10px', marginBottom: '14px' }}>Match each CSV column to the right field. Required: First Name, Last Name, Phone. All imported leads start as Prospect.</div>

              {/* Mapping table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
                {headers.map((h, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px' }}>
                    <div>
                      <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{h || `Column ${i + 1}`}</div>
                      <div style={{ color: '#4a5568', fontSize: '9px', fontFamily: 'monospace' }}>{rows[0]?.[i] || '(empty)'}</div>
                    </div>
                    <div style={{ color: '#4a5568', fontSize: '14px', textAlign: 'center' }}>→</div>
                    <select value={mapping[i] || ''} onChange={e => setMapping(p => ({ ...p, [i]: e.target.value }))} style={inp}>
                      <option value="">— Skip —</option>
                      {FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Preview (first 3 rows)</div>
              <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', marginBottom: '14px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${GOLD}33` }}>
                      {headers.map((h, i) => {
                        const field = mapping[i];
                        const fld = FIELDS.find(f => f.key === field);
                        return <th key={i} style={{ color: field ? GOLD : '#4a5568', padding: '6px 8px', textAlign: 'left', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{fld?.label || h || `Col ${i + 1}`}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 3).map((r, ri) => (
                      <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {headers.map((h, i) => <td key={i} style={{ padding: '6px 8px', color: '#c4cdd8', whiteSpace: 'nowrap', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r[i] || '—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Validation */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', background: hasFirstName ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: hasFirstName ? GOLD : RED }}>{hasFirstName ? '✓' : '✗'} First Name</span>
                <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', background: hasLastName ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: hasLastName ? GOLD : RED }}>{hasLastName ? '✓' : '✗'} Last Name</span>
                <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', background: hasPhone ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: hasPhone ? GOLD : RED }}>{hasPhone ? '✓' : '✗'} Phone</span>
                <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '10px', background: 'rgba(96,165,250,0.15)', color: BLUE }}>{rows.length} rows detected</span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => { setHeaders([]); setRows([]); setMapping({}); setCsvText(''); }} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>← Back</button>
                <button onClick={handleImport} disabled={!canImport} style={{ flex: 1, background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px', cursor: canImport ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold', opacity: canImport ? 1 : 0.4 }}>
                  {importing ? '⏳ Importing…' : `✓ Import ${rows.length} Leads as Prospect`}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Result */}
          {result && (
            <div style={{ textAlign: 'center', padding: '30px 20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>{result.failed > 0 ? '⚠️' : '✓'}</div>
              <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold', marginBottom: '6px' }}>Import Complete</div>
              <div style={{ color: '#8a9ab8', fontSize: '13px', marginBottom: '20px' }}>
                <span style={{ color: GOLD, fontWeight: 'bold' }}>{result.success}</span> leads imported as Prospect and split across: <span style={{ color: BLUE, fontWeight: 'bold' }}>{(assignedTos || []).join(', ')}</span>
                {result.failed > 0 && <><br/><span style={{ color: RED }}>{result.failed} rows skipped (missing required fields)</span></>}
              </div>
              <button onClick={onClose} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '12px 28px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}