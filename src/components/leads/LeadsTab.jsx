import { useState, useEffect, useRef, useCallback, createRef } from 'react';
import { base44 } from '@/api/base44Client';
import LeadContactCard from './LeadContactCard';
import TwilioDialer from './TwilioDialer';
import PredictiveDialer from './PredictiveDialer';
import WebsiteEngagementTab from './WebsiteEngagementTab';
import GlobalScriptEditor from '@/components/scripts/GlobalScriptEditor';
import SiteVisitsTab from './SiteVisitsTab';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const STATUS_FILTERS = [
  { id: 'all', label: 'All Leads' },
  { id: 'prospect', label: '🚀 Prospect' },
  { id: 'not_available', label: '📵 Not Available' },
  { id: 'callback_later', label: '📅 Call Back Later' },
  { id: 'converted', label: '✅ Converted' },
  { id: 'abandoned', label: '⚠️ Abandoned' },
];

const STATUS_COLORS = {
  lead: '#60a5fa', not_available: '#8a9ab8',
  callback_later: '#a78bfa', prospect: '#a78bfa', not_interested: '#ef4444',
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

// ─── New Lead Modal ───────────────────────────────────────────────────────
function NewLeadModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'', phone2:'', state:'', address:'', bestTimeToCall:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'8px 12px', color:'#e8e0d0', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };
  const ls = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'4px' };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('First and last name are required.'); return; }
    setSaving(true); setError('');
    try {
      const lead = await base44.entities.Lead.create({ ...form, status: 'lead' });
      onCreated && onCreated(lead);
      onClose();
    } catch(e) { setError('Error: ' + e.message); }
    setSaving(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'4px', width:'100%', maxWidth:'520px', boxShadow:'0 40px 100px rgba(0,0,0,0.8)', fontFamily:'Georgia, serif' }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ color:GOLD, margin:0, fontSize:'13px', letterSpacing:'2px', textTransform:'uppercase' }}>+ New Lead</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'20px' }}>×</button>
        </div>
        <div style={{ padding:'24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          {[['firstName','First Name *'],['lastName','Last Name *'],['phone','Phone'],['phone2','Alt Phone'],['email','Email'],['state','State']].map(([k,label]) => (
            <div key={k}>
              <label style={ls}>{label}</label>
              <input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={inp} placeholder={label.replace(' *','')} />
            </div>
          ))}
          <div style={{ gridColumn:'1/-1' }}>
            <label style={ls}>Address</label>
            <input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} style={inp} placeholder="Street address…" />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={ls}>Best Time to Call</label>
            <input value={form.bestTimeToCall} onChange={e=>setForm({...form,bestTimeToCall:e.target.value})} style={inp} placeholder="e.g. mornings, after 3pm…" />
          </div>
          {error && <div style={{ gridColumn:'1/-1', color:'#ef4444', fontSize:'12px' }}>{error}</div>}
          <div style={{ gridColumn:'1/-1', display:'flex', gap:'10px' }}>
            <button onClick={handleSave} disabled={saving} style={{ flex:1, background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'11px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>
              {saving ? 'Saving…' : 'Create Lead'}
            </button>
            <button onClick={onClose} style={{ padding:'11px 20px', background:'transparent', color:'#6b7280', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
          </div>
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
  const [showNewLead, setShowNewLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [dialerLead, setDialerLead] = useState(null);
  const [showDialer, setShowDialer] = useState(false);
  const [showPredictive, setShowPredictive] = useState(false);
  const [contactLists, setContactLists] = useState([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('leads'); // 'leads' or 'lists'
  const [editingListId, setEditingListId] = useState(null);
  const [editingListName, setEditingListName] = useState('');
  const [sidebarView, setSidebarView] = useState('leads'); // 'leads' | 'activity' | 'email'
  const [emailFilter, setEmailFilter] = useState('all'); // 'all' | 'sent' | 'opened' | 'clicked'
  const [emailLogs, setEmailLogs] = useState([]);
  const [leadHistory, setLeadHistory] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [archivedLeads, setArchivedLeads] = useState([]);
  const dialerRef = useRef(null);
  const [isDialerPaused, setIsDialerPaused] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);

  useEffect(() => {
    loadLeads();
    loadActivity();
    base44.entities.ContactList.list('-created_date', 100).then(setContactLists).catch(() => {});
  }, []);

  const loadActivity = async () => {
    setActivityLoading(true);
    try {
      const [history, logs] = await Promise.all([
        base44.entities.LeadHistory.list('-created_date', 150).catch(() => []),
        base44.entities.EmailLog.list('-sentAt', 200).catch(() => []),
      ]);
      // Get lead names
      const allLeads = await base44.entities.Lead.list('-created_date', 2000);
      const leadsMap = {};
      allLeads.forEach(l => { leadsMap[l.id] = l; });
      setLeadHistory(history.map(h => ({ ...h, lead: leadsMap[h.leadId] })));
      setEmailLogs(logs.map(l => ({ ...l, lead: leadsMap[l.leadId] })));
    } catch(e) { console.error(e); }
    setActivityLoading(false);
  };

  const loadLeads = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.Lead.list('-created_date', 2000);
      // Exclude permanently not_interested, sort: never-called first (by created_date), then called leads sorted by lastCalledAt asc (oldest call = first to call again)
      // Exclude permanently not_interested; keep converted at end
      // Exclude migrated and not_interested from main list
      const active = all.filter(l => l.status !== 'not_interested' && !l.migratedToPortal && !l.convertedToInvestorUserId);
      // Archived/migrated leads
      const archived = all.filter(l => l.migratedToPortal || l.convertedToInvestorUserId);
      const converted = active.filter(l => l.status === 'converted').sort((a,b) => new Date(b.created_date) - new Date(a.created_date));
      const nonConverted = active.filter(l => l.status !== 'converted');
      const neverCalled = nonConverted.filter(l => !l.lastCalledAt).sort((a,b) => new Date(a.created_date) - new Date(b.created_date));
      const called = nonConverted.filter(l => l.lastCalledAt).sort((a,b) => new Date(a.lastCalledAt) - new Date(b.lastCalledAt));
      setLeads([...neverCalled, ...called, ...converted]);
      setArchivedLeads(archived || []);
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

  // Called by PredictiveDialer the instant a human answers — opens contact card immediately
  const handleLeadConnected = async (lead) => {
    if (!lead) return;
    // Fetch fresh lead data so card has latest info
    try {
      const fresh = await base44.entities.Lead.filter({ id: lead.id });
      setSelectedLead(fresh?.[0] || lead);
    } catch {
      setSelectedLead(lead);
    }
  };

  const handleDeleteList = async (listId) => {
    if (!window.confirm('Delete this list and all its leads?')) return;
    try {
      const leadsInList = await base44.entities.Lead.filter({ contactListId: listId });
      for (const lead of leadsInList) {
        try { await base44.entities.Lead.delete(lead.id); } catch {}
      }
      await base44.entities.ContactList.delete(listId);
      setContactLists(prev => prev.filter(l => l.id !== listId));
      loadLeads();
    } catch(e) { console.error('Delete failed:', e); }
  };

  const handleResetList = async (listId) => {
    if (!window.confirm('Reset all leads in this list (clear all statuses & call counts)?')) return;
    try {
      const leadsInList = await base44.entities.Lead.filter({ contactListId: listId });
      for (const lead of leadsInList) {
        try {
          await base44.entities.Lead.update(lead.id, {
            status: 'lead',
            lastCalledAt: null,
            callAttempts: 0,
            callbackAt: null,
          });
        } catch {}
      }
      loadLeads();
    } catch(e) { console.error('Reset failed:', e); }
  };

  const handleUpdateListName = async (listId, newName) => {
    if (!newName.trim()) return;
    try {
      await base44.entities.ContactList.update(listId, { name: newName.trim() });
      setContactLists(prev => prev.map(l => l.id === listId ? {...l, name: newName.trim()} : l));
      setEditingListId(null);
      setEditingListName('');
    } catch(e) { console.error('Update failed:', e); }
  };

  const filteredLeads = leads.filter(l => {
    if (filter !== 'all' && l.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${l.firstName} ${l.lastName} ${l.email} ${l.phone} ${l.state}`.toLowerCase().includes(q);
    }
    return true;
  });

  useEffect(() => { setPage(1); }, [filter, search]);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  const counts = {};
  STATUS_FILTERS.forEach(f => {
    counts[f.id] = f.id === 'all' ? leads.length : leads.filter(l => l.status === f.id).length;
  });
  const uncalledCount = leads.filter(l => !l.lastCalledAt).length;

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const pagedLeads = filteredLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inp = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'8px 14px', color:'#e8e0d0', fontSize:'13px', outline:'none', fontFamily:'Georgia, serif' };

  const fmtTime = (dt) => {
    if (!dt) return '—';
    const d = new Date(dt);
    const diff = Date.now() - d;
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    return d.toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  };

  const ACTIVITY_ICONS = {
    note: '📬', call: '📞', connected: '🟢', not_available: '📵',
    prospect: '🚀', voicemail: '📳', not_interested: '❌', converted: '✅',
    email_open: '📬', email_click: '🔗',
  };
  const ACTIVITY_COLORS = {
    note: '#4ade80', call: GOLD, connected: '#4ade80', not_available: '#8a9ab8',
    prospect: '#a78bfa', voicemail: '#f59e0b', not_interested: '#ef4444', converted: '#4ade80',
    email_open: '#4ade80', email_click: '#60a5fa',
  };

  const getHistoryType = (h) => {
    if (h.type === 'note' && h.content?.includes('Email opened')) return 'email_open';
    if (h.type === 'note' && h.content?.includes('link clicked')) return 'email_click';
    return h.type;
  };

  const filteredEmailLogs = emailLogs.filter(l => {
    if (emailFilter === 'all') return true;
    if (emailFilter === 'sent') return ['sent','delivered'].includes(l.status);
    if (emailFilter === 'opened') return l.status === 'opened';
    if (emailFilter === 'clicked') return l.status === 'clicked';
    return true;
  });

  return (
    <>
    {selectedLead && (
      <LeadContactCard
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdate={loadLeads}
        onDialNumber={handleDialNumber}
        dialerRef={dialerRef}
        isDialerPaused={isDialerPaused}
        onResume={() => {
          setSelectedLead(null);
          setIsDialerPaused(false);
          setIsCallActive(false);
          dialerRef.current?.resumeDialer();
        }}
      />
    )}
    <div style={{ fontFamily:'Georgia, serif', display:'flex', gap:'0', minHeight:'600px' }}>

      {/* ── SIDEBAR ── */}
      <div style={{ width:'200px', flexShrink:0, borderRight:'1px solid rgba(255,255,255,0.07)', paddingRight:'0' }}>
        {/* Sidebar nav */}
        <div style={{ padding:'0 0 12px 0' }}>
          {[
            { id:'leads',    icon:'📋', label:'Leads' },
            { id:'lists',    icon:'📁', label:`Lists (${contactLists.length})` },
            { id:'activity', icon:'⚡', label:'Activity Feed' },
            { id:'email',    icon:'✉️',  label:'Email Activity' },
            { id:'sitevisits', icon:'🌐', label:'Site Visits' },
            { id:'engagement', icon:'📊', label:'Web Engagement' },
            { id:'archived',   icon:'📦', label:`Archived (${archivedLeads.length})` },
            { id:'scripts',    icon:'📝', label:'Scripts' },
          ].map(item => (
            <button key={item.id} onClick={() => { setSidebarView(item.id); setTab(item.id === 'lists' ? 'lists' : 'leads'); }}
              style={{ display:'block', width:'100%', textAlign:'left', background: sidebarView===item.id ? 'rgba(184,147,58,0.1)' : 'transparent', border:'none', borderLeft: sidebarView===item.id ? `3px solid ${GOLD}` : '3px solid transparent', padding:'10px 14px', color: sidebarView===item.id ? GOLD : '#6b7280', fontSize:'12px', cursor:'pointer', letterSpacing:'0.5px', transition:'all 0.15s' }}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        {/* Dialer buttons */}
        <div style={{ padding:'12px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'8px' }}>Dialers</div>
          <button onClick={() => setShowDialer(true)} style={{ display:'block', width:'100%', background:'rgba(74,222,128,0.1)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.25)', borderRadius:'2px', padding:'8px 10px', cursor:'pointer', fontSize:'11px', marginBottom:'6px', textAlign:'left' }}>📞 Direct Dialer</button>
          <button onClick={() => setShowPredictive(p => !p)} style={{ display:'block', width:'100%', background: showPredictive ? 'rgba(184,147,58,0.2)' : 'rgba(167,139,250,0.1)', color: showPredictive ? GOLD : '#a78bfa', border:`1px solid ${showPredictive ? 'rgba(184,147,58,0.4)' : 'rgba(167,139,250,0.25)'}`, borderRadius:'2px', padding:'8px 10px', cursor:'pointer', fontSize:'11px', marginBottom:'6px', textAlign:'left' }}>⚡ {showPredictive ? 'Hide Predictive' : 'Predictive Dialer'}</button>
          <button onClick={() => setShowNewLead(true)} style={{ display:'block', width:'100%', background:'rgba(96,165,250,0.1)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.25)', borderRadius:'2px', padding:'8px 10px', cursor:'pointer', fontSize:'11px', marginBottom:'6px', textAlign:'left' }}>+ New Lead</button>
          <button onClick={() => setShowUpload(true)} style={{ display:'block', width:'100%', background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'8px 10px', cursor:'pointer', fontSize:'11px', fontWeight:'700', textAlign:'left' }}>📊 Import CSV</button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex:1, paddingLeft:'24px', minWidth:0 }}>

      {showUpload && <CSVUploadModal onClose={() => setShowUpload(false)} onImported={loadLeads} />}
      {showNewLead && <NewLeadModal onClose={() => setShowNewLead(false)} onCreated={loadLeads} />}
      {showDialer && (
        <TwilioDialer
          initialLead={dialerLead}
          onClose={() => { setShowDialer(false); setDialerLead(null); setIsCallActive(false); }}
          onCallLogged={handleCallLogged}
          onCallStart={() => setIsCallActive(true)}
          onCallEnd={() => setIsCallActive(false)}
        />
      )}

      {/* LEADS TAB */}
      {sidebarView === 'leads' && tab === 'leads' && (
      <>
      {/* Header */}
      <div style={{ marginBottom:'16px' }}>
        <h2 style={{ color:'#e8e0d0', margin:'0 0 4px', fontSize:'20px', fontWeight:'normal' }}>Leads</h2>
        <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>Never-called leads appear first. Abandoned calls need manual callback.</p>
      </div>

      {/* Predictive Dialer Panel */}
      {showPredictive && (
        <div style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(184,147,58,0.25)', borderRadius:'8px', padding:'20px', marginBottom:'20px' }}>
          <PredictiveDialer
            ref={dialerRef}
            contactLists={contactLists}
            onClose={() => setShowPredictive(false)}
            onCallLogged={handleCallLogged}
            onLeadConnected={handleLeadConnected}
            onPaused={() => { setIsDialerPaused(true); setIsCallActive(true); }}
            onResumed={() => { setIsDialerPaused(false); setIsCallActive(false); }}
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
          <div style={{ color:'#4a5568', fontSize:'14px' }}>{leads.length === 0 ? 'No leads yet. Click "+ New Lead" or import a CSV to get started.' : 'No leads match this filter.'}</div>
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
              {pagedLeads.map(lead => {
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
                    <td style={{ padding:'12px' }}>
                      <div style={{ color:'#e8e0d0', fontWeight:'bold' }}>{name}</div>
                      {(lead.engagementScore > 0 || lead.badgeEmailOpened || lead.badgeConsumerWebsite || lead.badgeInvestorPage) && (
                        <div style={{ display:'flex', gap:'4px', marginTop:'3px', flexWrap:'wrap' }}>
                          {lead.engagementScore > 0 && <span style={{ background:'rgba(184,147,58,0.15)', color:GOLD, border:'1px solid rgba(184,147,58,0.3)', borderRadius:'20px', padding:'1px 7px', fontSize:'9px', fontWeight:'bold' }}>⭐ {lead.engagementScore}</span>}
                          {lead.badgeEmailOpened && <span style={{ background:'rgba(74,222,128,0.12)', color:'#4ade80', borderRadius:'20px', padding:'1px 7px', fontSize:'9px' }}>📬</span>}
                          {lead.badgeConsumerWebsite && <span style={{ background:'rgba(96,165,250,0.12)', color:'#60a5fa', borderRadius:'20px', padding:'1px 7px', fontSize:'9px' }}>🌐</span>}
                          {lead.badgeInvestorPage && <span style={{ background:'rgba(167,139,250,0.12)', color:'#a78bfa', borderRadius:'20px', padding:'1px 7px', fontSize:'9px' }}>💼</span>}
                        </div>
                      )}
                    </td>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'8px', marginTop:'20px' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ background:'rgba(255,255,255,0.05)', color: page===1?'#4a5568':'#e8e0d0', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'6px 14px', cursor:page===1?'not-allowed':'pointer', fontSize:'12px' }}>← Prev</button>
          <span style={{ color:'#8a9ab8', fontSize:'12px' }}>Page {page} of {totalPages} &nbsp;·&nbsp; {filteredLeads.length} leads</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ background:'rgba(255,255,255,0.05)', color:page===totalPages?'#4a5568':'#e8e0d0', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'6px 14px', cursor:page===totalPages?'not-allowed':'pointer', fontSize:'12px' }}>Next →</button>
        </div>
      )}
      </>
      )}

      {/* ACTIVITY FEED */}
      {sidebarView === 'activity' && (
        <div>
          <div style={{ marginBottom:'16px' }}>
            <h2 style={{ color:'#e8e0d0', margin:'0 0 4px', fontSize:'20px', fontWeight:'normal' }}>Lead Activity Feed</h2>
            <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>All calls, connections, status changes and email events.</p>
          </div>
          {activityLoading && <div style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading…</div>}
          {!activityLoading && leadHistory.length === 0 && <div style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No activity yet.</div>}
          <div style={{ maxHeight:'70vh', overflowY:'auto' }}>
            {leadHistory.map((h, i) => {
              const type = getHistoryType(h);
              const icon = ACTIVITY_ICONS[type] || '📌';
              const color = ACTIVITY_COLORS[type] || '#8a9ab8';
              const name = h.lead ? `${h.lead.firstName} ${h.lead.lastName}` : h.leadId;
              return (
                <div key={h.id || i}
                  onClick={() => h.lead && setSelectedLead(h.lead)}
                  style={{ display:'grid', gridTemplateColumns:'24px 1fr 120px', gap:'0 10px', alignItems:'center', padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor: h.lead ? 'pointer' : 'default', transition:'background 0.1s' }}
                  onMouseEnter={e => { if(h.lead) e.currentTarget.style.background='rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <span style={{ fontSize:'13px', textAlign:'center' }}>{icon}</span>
                  <div>
                    <span style={{ color:'#e8e0d0', fontSize:'12px', fontWeight:'bold', marginRight:'6px' }}>{name}</span>
                    <span style={{ color, fontSize:'10px' }}>{type.replace('_',' ')}</span>
                    {h.content && <span style={{ color:'#4a5568', fontSize:'10px', marginLeft:'6px' }}>· {h.content.slice(0,80)}</span>}
                  </div>
                  <div style={{ color:'#6b7280', fontSize:'10px', textAlign:'right' }}>{fmtTime(h.createdAt || h.created_date)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EMAIL ACTIVITY */}
      {sidebarView === 'email' && (
        <div>
          <div style={{ marginBottom:'16px' }}>
            <h2 style={{ color:'#e8e0d0', margin:'0 0 4px', fontSize:'20px', fontWeight:'normal' }}>Email Activity</h2>
            <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>Track sent, opened, and clicked emails.</p>
          </div>
          {/* Filter tabs */}
          <div style={{ display:'flex', gap:'0', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:'16px' }}>
            {[['all','All'],['sent','Sent'],['opened','Opened'],['clicked','Clicked']].map(([id,label]) => (
              <button key={id} onClick={() => setEmailFilter(id)}
                style={{ background:'none', border:'none', borderBottom:emailFilter===id?`2px solid ${GOLD}`:'2px solid transparent', color:emailFilter===id?GOLD:'#6b7280', padding:'8px 14px', cursor:'pointer', fontSize:'11px', letterSpacing:'1px' }}>
                {label} ({emailLogs.filter(l => id==='all'||(['sent','delivered'].includes(l.status)&&id==='sent')||(l.status===id)).length})
              </button>
            ))}
          </div>
          {activityLoading && <div style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading…</div>}
          {!activityLoading && filteredEmailLogs.length === 0 && <div style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No emails match this filter.</div>}
          <div style={{ maxHeight:'70vh', overflowY:'auto' }}>
            {filteredEmailLogs.map((log, i) => {
              const statusColors = { sent:'#8a9ab8', delivered:'#60a5fa', opened:'#4ade80', clicked:'#f59e0b', bounced:'#ef4444', spam:'#ef4444' };
              const statusIcons = { sent:'📤', delivered:'✉️', opened:'📬', clicked:'🔗', bounced:'⚠️', spam:'🚫' };
              const sc = statusColors[log.status] || '#8a9ab8';
              const si = statusIcons[log.status] || '✉️';
              const name = log.lead ? `${log.lead.firstName} ${log.lead.lastName}` : log.toName || log.toEmail;
              return (
                <div key={log.id || i}
                  onClick={() => log.lead && setSelectedLead(log.lead)}
                  style={{ display:'grid', gridTemplateColumns:'24px 1fr 80px 120px', gap:'0 10px', alignItems:'center', padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor: log.lead ? 'pointer' : 'default', background: log.status==='opened'?'rgba(74,222,128,0.04)': log.status==='clicked'?'rgba(245,158,11,0.04)':'transparent' }}
                  onMouseEnter={e => { if(log.lead) e.currentTarget.style.opacity='0.8'; }}
                  onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                  <span style={{ fontSize:'13px', textAlign:'center' }}>{si}</span>
                  <div>
                    <span style={{ color:'#e8e0d0', fontSize:'12px', fontWeight:'bold', marginRight:'6px' }}>{name}</span>
                    <span style={{ color:'#4a5568', fontSize:'10px' }}>{log.toEmail}</span>
                    {log.clickedUrl && <span style={{ color:'#60a5fa', fontSize:'9px', display:'block', marginTop:'1px' }}>{log.clickedUrl.slice(0,60)}</span>}
                  </div>
                  <span style={{ color:sc, fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.5px', textAlign:'center' }}>{log.status}</span>
                  <div style={{ color:'#6b7280', fontSize:'10px', textAlign:'right' }}>{fmtTime(log.openedAt || log.clickedAt || log.sentAt)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SITE VISITS */}
      {sidebarView === 'sitevisits' && (
        <SiteVisitsTab onOpenLead={async (leadId) => {
          try {
            const leads = await base44.entities.Lead.filter({ id: leadId });
            if (leads?.[0]) setSelectedLead(leads[0]);
          } catch {}
        }} />
      )}

      {/* WEBSITE ENGAGEMENT */}
      {sidebarView === 'engagement' && (
        <WebsiteEngagementTab onOpenLead={(lead) => setSelectedLead(lead)} />
      )}

      {/* ARCHIVED LEADS */}
      {sidebarView === 'archived' && (
        <div>
          <div style={{ marginBottom:'16px' }}>
            <h2 style={{ color:'#e8e0d0', margin:'0 0 4px', fontSize:'20px', fontWeight:'normal' }}>📦 Archived Leads</h2>
            <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>Leads that have been migrated to CRM. Read-only.</p>
          </div>
          {archivedLeads.length === 0 && <div style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No archived leads yet.</div>}
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr style={{ borderBottom:'2px solid rgba(184,147,58,0.3)' }}>
                  {['Name','Email','Phone','State','Migrated'].map(h => (
                    <th key={h} style={{ color:GOLD, padding:'10px 12px', textAlign:'left', fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {archivedLeads.map(lead => (
                  <tr key={lead.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', opacity:0.7 }}>
                    <td style={{ padding:'10px 12px', color:'#8a9ab8' }}>{lead.firstName} {lead.lastName}</td>
                    <td style={{ padding:'10px 12px', color:'#8a9ab8', fontSize:'12px' }}>{lead.email || '—'}</td>
                    <td style={{ padding:'10px 12px', color:'#8a9ab8', fontFamily:'monospace', fontSize:'12px' }}>{lead.phone || '—'}</td>
                    <td style={{ padding:'10px 12px', color:'#8a9ab8', fontSize:'12px' }}>{lead.state || '—'}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ background:'rgba(74,222,128,0.1)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.25)', borderRadius:'3px', padding:'2px 8px', fontSize:'10px' }}>✅ Migrated to CRM</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SCRIPTS */}
      {sidebarView === 'scripts' && (
        <GlobalScriptEditor />
      )}

      {/* LISTS TAB */}
      {sidebarView === 'lists' && tab === 'lists' && (
      <div>
        <div style={{ marginBottom:'24px' }}>
          <h2 style={{ color:'#e8e0d0', margin:'0 0 4px', fontSize:'20px', fontWeight:'normal' }}>Contact Lists</h2>
          <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>Manage your lead lists. Edit names, reset stats, or delete entire lists.</p>
        </div>
        {contactLists.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px', background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', color:'#4a5568' }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>📁</div>
            <div style={{ fontSize:'14px' }}>No lists yet. Import a CSV to create one.</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'12px' }}>
            {contactLists.map(list => (
              <div key={list.id} style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'16px' }}>
                {editingListId === list.id ? (
                  <div>
                    <input
                      value={editingListName}
                      onChange={e => setEditingListName(e.target.value)}
                      style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'2px', padding:'8px 12px', color:'#e8e0d0', fontSize:'13px', width:'100%', boxSizing:'border-box', marginBottom:'8px', outline:'none', fontFamily:'Georgia,serif' }}
                    />
                    <div style={{ display:'flex', gap:'6px' }}>
                      <button onClick={() => handleUpdateListName(list.id, editingListName)} style={{ flex:1, background:'linear-gradient(135deg,#4ade80,#22c55e)', color:'#000', border:'none', borderRadius:'2px', padding:'6px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>Save</button>
                      <button onClick={() => setEditingListId(null)} style={{ flex:1, background:'rgba(255,255,255,0.05)', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', padding:'6px', cursor:'pointer', fontSize:'11px' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ color:'#e8e0d0', fontSize:'15px', fontWeight:'bold', marginBottom:'8px' }}>{list.name}</div>
                    <div style={{ color:'#6b7280', fontSize:'12px', marginBottom:'12px' }}>
                      📄 {list.leadCount || 0} leads · Imported {list.importedAt ? new Date(list.importedAt).toLocaleDateString() : 'unknown'}
                    </div>
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                      <button onClick={() => { setEditingListId(list.id); setEditingListName(list.name); }} style={{ flex:1, background:'rgba(96,165,250,0.15)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'2px', padding:'6px', cursor:'pointer', fontSize:'10px', letterSpacing:'0.5px' }}>✎ Edit</button>
                      <button onClick={() => handleResetList(list.id)} style={{ flex:1, background:'rgba(245,158,11,0.15)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'2px', padding:'6px', cursor:'pointer', fontSize:'10px', letterSpacing:'0.5px' }}>↻ Reset</button>
                      <button onClick={() => handleDeleteList(list.id)} style={{ flex:1, background:'rgba(239,68,68,0.15)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'2px', padding:'6px', cursor:'pointer', fontSize:'10px', letterSpacing:'0.5px' }}>✕ Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}
      </div>
      {/* AI Assistant integrated into Script tab */}
    </div>
    </>
  );
}