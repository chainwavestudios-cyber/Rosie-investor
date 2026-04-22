import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import LeadContactCard from './LeadContactCard';
import TwilioDialer from './TwilioDialer';
import PredictiveDialer from './PredictiveDialer';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const STATUS_FILTERS = [
  { id: 'all', label: 'All Leads' },
  { id: 'interested', label: '⭐ Interested' },
  { id: 'not_available', label: '📵 Not Available' },
  { id: 'callback_later', label: '📅 Call Back Later' },
  { id: 'prospect', label: '🚀 Prospect' },
  { id: 'converted', label: '✅ Converted' },
  { id: 'abandoned', label: '⚠️ Abandoned' },
];

const STATUS_COLORS = {
  lead: '#60a5fa', interested: '#f59e0b', not_available: '#8a9ab8',
  callback_later: '#a78bfa', prospect: '#60a5fa', investor: '#4ade80', not_interested: '#ef4444',
  converted: '#4ade80', abandoned: '#ef4444',
};

// ─── CSV Upload ───────────────────────────────────────────────────────────
function CSVUploadModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({ firstName:'', lastName:'', email:'', phone:'', state:'' });
  const [step, setStep] = useState('listName'); // listName | upload | map | preview | done
  const [listName, setListName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [deleteOld, setDeleteOld] = useState(false);
  const fileRef = useRef(null);

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    const hdrs = lines[0].split(',').map(h => h.trim().replace(/"/g,''));
    const data = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g,''));
      const obj = {};
      hdrs.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
    return { hdrs, data };
  };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { hdrs, data } = parseCSV(ev.target.result);
      setHeaders(hdrs);
      setRows(data);
      // Auto-map common names
      const autoMap = { firstName:'', lastName:'', email:'', phone:'', state:'' };
      hdrs.forEach(h => {
        const hl = h.toLowerCase();
        if (/first.*name|firstname/i.test(hl)) autoMap.firstName = h;
        else if (/last.*name|lastname/i.test(hl)) autoMap.lastName = h;
        else if (/email/i.test(hl)) autoMap.email = h;
        else if (/phone|mobile|cell/i.test(hl)) autoMap.phone = h;
        else if (/state|st$/i.test(hl)) autoMap.state = h;
      });
      setMapping(autoMap);
      setStep('map');
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!listName.trim()) return;
    setImporting(true);
    let count = 0;
    let skipped = 0;
    const BATCH = 50;

    // Delete old leads if requested
    if (deleteOld) {
      const oldLeads = await base44.entities.Lead.list('-created_date', 5000);
      for (const lead of oldLeads) {
        try { await base44.entities.Lead.delete(lead.id); } catch {}
      }
    }

    // Create the contact list
    const listRecord = await base44.entities.ContactList.create({
      name: listName.trim(),
      importedAt: new Date().toISOString(),
      leadCount: 0,
    });

    // Fetch existing leads (from THIS list only) to build dedup sets
    const existing = await base44.entities.Lead.filter({ contactListId: listRecord.id });
    const existingPhones = new Set(existing.map(l => (l.phone || '').replace(/\D/g,'')).filter(Boolean));
    const existingEmails = new Set(existing.map(l => (l.email || '').toLowerCase().trim()).filter(Boolean));

    const validRows = rows.filter(row => {
      const phone = (row[mapping.phone] || '').replace(/\D/g,'');
      const email = (row[mapping.email] || '').toLowerCase().trim();
      const hasName = row[mapping.firstName] || row[mapping.lastName];
      if (!hasName) return false;
      if (phone && existingPhones.has(phone)) { skipped++; return false; }
      if (email && existingEmails.has(email)) { skipped++; return false; }
      return true;
    });

    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH).map(row => ({
        firstName: row[mapping.firstName] || '',
        lastName: row[mapping.lastName] || '',
        email: row[mapping.email] || '',
        phone: row[mapping.phone] || '',
        state: row[mapping.state] || '',
        status: 'lead',
        contactListId: listRecord.id,
      }));
      try {
        await base44.entities.Lead.bulkCreate(batch);
        count += batch.length;
        setImportCount(count);
      } catch {
        for (const lead of batch) {
          try { await base44.entities.Lead.create(lead); count++; setImportCount(count); } catch {}
        }
      }
    }

    // Update ContactList with final count
    try { await base44.entities.ContactList.update(listRecord.id, { leadCount: count }); } catch {}

    setSkippedCount(skipped);
    setImporting(false);
    setStep('done');
    onImported && onImported();
  };

  const FIELDS = [['firstName','First Name'],['lastName','Last Name'],['email','Email'],['phone','Phone'],['state','State']];
  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'8px 12px', color:'#e8e0d0', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'4px', width:'100%', maxWidth:'600px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 40px 100px rgba(0,0,0,0.8)', fontFamily:'Georgia, serif' }}>
        <div style={{ padding:'24px 28px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ color:GOLD, margin:0, fontSize:'13px', letterSpacing:'2px', textTransform:'uppercase' }}>Import Leads from CSV</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'20px' }}>×</button>
        </div>
        <div style={{ padding:'28px' }}>
          {step === 'listName' && (
            <div>
              <div style={{ color:'#8a9ab8', fontSize:'13px', marginBottom:'16px' }}>Give this import list a name.</div>
              <input value={listName} onChange={e=>setListName(e.target.value)} placeholder="e.g., Q2 2025 Leads, Cold Calls List…" style={{ ...inp, marginBottom:'16px' }} />
              <div style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'2px', padding:'12px', marginBottom:'16px', color:'#f59e0b', fontSize:'12px' }}>
                <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer' }}>
                  <input type="checkbox" checked={deleteOld} onChange={e=>setDeleteOld(e.target.checked)} style={{ cursor:'pointer' }} />
                  Delete all existing leads first (clean slate)
                </label>
              </div>
              <button onClick={() => setStep('upload')} disabled={!listName.trim()} style={{ width:'100%', background:!listName.trim()?'rgba(184,147,58,0.2)':'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px', cursor:!listName.trim()?'not-allowed':'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>Continue</button>
            </div>
          )}
          {step === 'upload' && (
            <div>
              <div style={{ border:'2px dashed rgba(184,147,58,0.3)', borderRadius:'4px', padding:'48px', textAlign:'center', cursor:'pointer' }} onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }} />
                <div style={{ fontSize:'48px', marginBottom:'12px' }}>📊</div>
                <div style={{ color:'#8a9ab8', fontSize:'14px', marginBottom:'6px' }}>Click to upload a CSV file</div>
                <div style={{ color:'#4a5568', fontSize:'12px' }}>Supports comma-separated files with headers</div>
              </div>
            </div>
          )}

          {step === 'map' && (
            <div>
              <div style={{ color:'#8a9ab8', fontSize:'12px', marginBottom:'20px' }}>Map your CSV columns to lead fields. Found <strong style={{ color:GOLD }}>{rows.length} rows</strong>.</div>
              {FIELDS.map(([key, label]) => (
                <div key={key} style={{ marginBottom:'14px' }}>
                  <label style={{ display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>{label}</label>
                  <select value={mapping[key]} onChange={e => setMapping({...mapping,[key]:e.target.value})} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">— Skip —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
              {/* Preview */}
              {rows.length > 0 && (
                <div style={{ marginTop:'20px', background:'rgba(0,0,0,0.2)', borderRadius:'4px', padding:'14px', overflowX:'auto' }}>
                  <div style={{ color:'#4a5568', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>Preview (first 3 rows)</div>
                  {rows.slice(0,3).map((row, i) => (
                    <div key={i} style={{ display:'flex', gap:'12px', padding:'6px 0', borderTop:i>0?'1px solid rgba(255,255,255,0.04)':'none', fontSize:'12px', color:'#8a9ab8', flexWrap:'wrap' }}>
                      <span>{row[mapping.firstName]} {row[mapping.lastName]}</span>
                      <span>|</span><span>{row[mapping.email]||'—'}</span>
                      <span>|</span><span>{row[mapping.phone]||'—'}</span>
                      <span>|</span><span>{row[mapping.state]||'—'}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display:'flex', gap:'12px', marginTop:'24px' }}>
                <button onClick={handleImport} disabled={importing || !mapping.firstName} style={{ flex:1, background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>{importing ? `Importing… (${importCount})` : `Import ${rows.length} Leads`}</button>
                <button onClick={onClose} style={{ padding:'12px 20px', background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign:'center', padding:'32px 0' }}>
              <div style={{ fontSize:'52px', marginBottom:'16px' }}>✅</div>
              <h3 style={{ color:'#4ade80', fontFamily:'Georgia,serif', fontWeight:'normal', marginBottom:'8px' }}>Import Complete!</h3>
              <p style={{ color:'#8a9ab8', fontSize:'14px' }}>Successfully imported <strong style={{ color:GOLD }}>{importCount}</strong> leads.</p>
              {skippedCount > 0 && <p style={{ color:'#6b7280', fontSize:'13px', marginTop:'4px' }}>Skipped <strong style={{ color:'#f59e0b' }}>{skippedCount}</strong> duplicates (matched by phone or email).</p>}
              <button onClick={onClose} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'12px 32px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', marginTop:'16px' }}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Leads Tab ───────────────────────────────────────────────────────
export default function LeadsTab() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [dialerLead, setDialerLead] = useState(null);
  const [showDialer, setShowDialer] = useState(false);
  const [showPredictive, setShowPredictive] = useState(false);
  const [contactLists, setContactLists] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadLeads();
    base44.entities.ContactList.list('-created_date', 100).then(setContactLists).catch(() => {});
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.Lead.list('-created_date', 2000);
      // Exclude permanently not_interested, sort: never-called first (by created_date), then called leads sorted by lastCalledAt asc (oldest call = first to call again)
      // Exclude permanently not_interested; keep converted at end
      const active = all.filter(l => l.status !== 'not_interested');
      const converted = active.filter(l => l.status === 'converted').sort((a,b) => new Date(b.created_date) - new Date(a.created_date));
      const nonConverted = active.filter(l => l.status !== 'converted');
      const neverCalled = nonConverted.filter(l => !l.lastCalledAt).sort((a,b) => new Date(a.created_date) - new Date(b.created_date));
      const called = nonConverted.filter(l => l.lastCalledAt).sort((a,b) => new Date(a.lastCalledAt) - new Date(b.lastCalledAt));
      setLeads([...neverCalled, ...called, ...converted]);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const handleDialNumber = (lead) => {
    setDialerLead(lead);
    setShowDialer(true);
    setSelectedLead(lead); // open contact card at the same time
  };

  // Called after a call ends — stamp lastCalledAt and re-sort
  const handleCallLogged = async (leadId) => {
    const now = new Date().toISOString();
    try { await base44.entities.Lead.update(leadId, { lastCalledAt: now }); } catch {}
    await loadLeads();
  };

  const filteredLeads = leads.filter(l => {
    if (filter !== 'all' && l.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${l.firstName} ${l.lastName} ${l.email} ${l.phone} ${l.state}`.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {};
  STATUS_FILTERS.forEach(f => {
    counts[f.id] = f.id === 'all' ? leads.length : leads.filter(l => l.status === f.id).length;
  });
  const uncalledCount = leads.filter(l => !l.lastCalledAt).length;

  const inp = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'8px 14px', color:'#e8e0d0', fontSize:'13px', outline:'none', fontFamily:'Georgia, serif' };

  return (
    <div style={{ fontFamily:'Georgia, serif' }}>
      {showUpload && <CSVUploadModal onClose={() => setShowUpload(false)} onImported={loadLeads} />}
      {selectedLead && (
        <LeadContactCard
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={loadLeads}
          onDialNumber={handleDialNumber}
        />
      )}
      {showDialer && (
        <TwilioDialer
          initialLead={dialerLead}
          onClose={() => { setShowDialer(false); setDialerLead(null); }}
          onCallLogged={handleCallLogged}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h2 style={{ color:'#e8e0d0', margin:'0 0 4px', fontSize:'20px', fontWeight:'normal' }}>Leads</h2>
          <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>Never-called leads appear first. Abandoned calls need manual callback.</p>
        </div>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
          <button onClick={() => setShowDialer(true)} style={{ background:'rgba(74,222,128,0.12)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'2px', padding:'9px 18px', cursor:'pointer', fontSize:'12px' }}>📞 Direct Dialer</button>
          <button onClick={() => setShowPredictive(p => !p)} style={{ background: showPredictive ? 'rgba(184,147,58,0.25)' : 'rgba(167,139,250,0.12)', color: showPredictive ? GOLD : '#a78bfa', border:`1px solid ${showPredictive ? 'rgba(184,147,58,0.5)' : 'rgba(167,139,250,0.3)'}`, borderRadius:'2px', padding:'9px 18px', cursor:'pointer', fontSize:'12px' }}>⚡ {showPredictive ? 'Hide' : 'Predictive Dialer'}</button>
          <button onClick={() => setShowUpload(true)} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'10px 20px', cursor:'pointer', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', fontWeight:'700' }}>📊 Import CSV</button>
        </div>
      </div>

      {/* Predictive Dialer Panel */}
      {showPredictive && (
        <div style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(184,147,58,0.25)', borderRadius:'8px', padding:'20px', marginBottom:'20px' }}>
          <PredictiveDialer
            contactLists={contactLists}
            onClose={() => setShowPredictive(false)}
            onCallLogged={handleCallLogged}
          />
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:'0', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:'20px', overflowX:'auto' }}>
        {STATUS_FILTERS.map(f => {
          const isAbandoned = f.id === 'abandoned';
          const hasAbandoned = isAbandoned && (counts['abandoned'] || 0) > 0;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{ background: hasAbandoned && filter !== f.id ? 'rgba(239,68,68,0.06)' : 'none', border:'none', borderBottom:filter===f.id?`2px solid ${isAbandoned ? '#ef4444' : GOLD}`:'2px solid transparent', color:filter===f.id?(isAbandoned?'#ef4444':GOLD):(hasAbandoned?'#ef4444':'#6b7280'), padding:'10px 16px', cursor:'pointer', fontSize:'12px', letterSpacing:'1px', whiteSpace:'nowrap' }}>
              {f.label} <span style={{ fontSize:'11px' }}>({counts[f.id]||0})</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ marginBottom:'16px' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, email, phone, state…" style={{ ...inp, width:'100%', boxSizing:'border-box' }} />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#6b7280' }}>Loading…</div>
      ) : filteredLeads.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px' }}>
          <div style={{ fontSize:'48px', marginBottom:'12px' }}>📋</div>
          <div style={{ color:'#4a5568', fontSize:'14px' }}>{leads.length === 0 ? 'No leads yet. Import a CSV to get started.' : 'No leads match this filter.'}</div>
        </div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid rgba(184,147,58,0.3)' }}>
                {['Status','Name','Email','Phone','State','Last Called','Callback',''].map(h => (
                  <th key={h} style={{ color:GOLD, padding:'10px 12px', textAlign:'left', fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(lead => {
                const sc = STATUS_COLORS[lead.status] || '#8a9ab8';
                const name = `${lead.firstName} ${lead.lastName}`;
                return (
                  <tr key={lead.id}
                    style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer', transition:'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,147,58,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => setSelectedLead(lead)}>
                    <td style={{ padding:'12px' }}>
                      <span style={{ background:`${sc}22`, color:sc, border:`1px solid ${sc}55`, padding:'3px 10px', borderRadius:'2px', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                        {lead.status?.replace('_',' ')}
                      </span>
                      {lead.status === 'abandoned' && (
                        <div style={{ color:'#ef4444', fontSize:'9px', marginTop:'3px', letterSpacing:'0.5px' }}>⚠ Needs callback</div>
                      )}
                    </td>
                    <td style={{ padding:'12px', color:'#e8e0d0', fontWeight:'bold' }}>{name}</td>
                    <td style={{ padding:'12px', color:'#8a9ab8', fontSize:'12px' }}>{lead.email || '—'}</td>
                    <td style={{ padding:'12px' }}>
                      {lead.phone ? (
                        <button onClick={e => { e.stopPropagation(); handleDialNumber(lead); }}
                          style={{ background:'rgba(74,222,128,0.1)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.25)', borderRadius:'2px', padding:'4px 10px', cursor:'pointer', fontSize:'12px', fontFamily:'monospace' }}>
                          📞 {lead.phone}
                        </button>
                      ) : '—'}
                    </td>
                    <td style={{ padding:'12px', color:'#8a9ab8', fontSize:'12px' }}>{lead.state || '—'}</td>
                    <td style={{ padding:'12px', color:'#f59e0b', fontSize:'11px' }}>
                      {lead.lastCalledAt ? new Date(lead.lastCalledAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : <span style={{ color:'#4a5568' }}>Never</span>}
                    </td>
                    <td style={{ padding:'12px', color:'#a78bfa', fontSize:'11px' }}>
                      {lead.callbackAt ? new Date(lead.callbackAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '—'}
                    </td>
                    <td style={{ padding:'12px' }}>
                      <button onClick={e => { e.stopPropagation(); setSelectedLead(lead); }}
                        style={{ background:'rgba(184,147,58,0.15)', color:GOLD, border:'1px solid rgba(184,147,58,0.3)', borderRadius:'2px', padding:'5px 12px', cursor:'pointer', fontSize:'11px' }}>
                        Open →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}