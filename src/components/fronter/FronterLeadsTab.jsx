/**
 * FronterLeadsTab.jsx — Lead list for the fronter.
 * Fronter calls directly off the list. After a call, the lead moves to the
 * back of the list and shows last-called time. Leads are removed after 3 calls.
 * Fronter can update status from prospect → lead (agreed to speak to agent).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import FronterDialer from './FronterDialer';
import FronterContactCard from './FronterContactCard';
import FronterLeadImportModal from './FronterLeadImportModal';
import FronterAgentStatsBar from './FronterAgentStatsBar';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function FronterLeadsTab({ username, lineKey, lineNumber, isAdmin = false, availableLines = [], adminLineKey = '', onLineChange, mode = 'prospects', onCallConnected, fronterFirstName }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeLead, setActiveLead] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [fronters, setFronters] = useState([]);
  const [leadForm, setLeadForm] = useState({ firstName: '', lastName: '', phone: '', assignedTo: '', notes: '' });
  const [bulkText, setBulkText] = useState('');
  const [dialTrigger, setDialTrigger] = useState(0);
  const [contactCardLead, setContactCardLead] = useState(null);
  const [fronterFilter, setFronterFilter] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Admin sees all active leads; fronter sees only their own
      const all = isAdmin
        ? await base44.entities.FronterLead.list('-created_date', 500)
        : await base44.entities.FronterLead.filter({ assignedTo: username }, '-created_date', 500);
      // Prospects: ONLY status === 'prospect' (never show converted leads)
      // Leads: status === 'lead' or 'transferred'
      let active = mode === 'leads'
        ? (all || []).filter(l => l.status === 'transferred' || (l.status === 'lead' && ['interested', 'appointment', 'transferred'].includes(l.lastCallResult)))
        : (all || []).filter(l => l.status === 'prospect' && (l.callCount || 0) < 3);
      // Admin fronter filter
      if (isAdmin && fronterFilter) {
        active = active.filter(l => l.assignedTo === fronterFilter);
      }
      const sorted = [...active].sort((a, b) => {
        if (!a.lastCalledAt && b.lastCalledAt) return -1;
        if (a.lastCalledAt && !b.lastCalledAt) return 1;
        if (a.lastCalledAt && b.lastCalledAt) return new Date(a.lastCalledAt) - new Date(b.lastCalledAt);
        return 0;
      });
      setLeads(sorted);
      if (isAdmin) {
        const users = await base44.entities.DebtCoachUser.list('-created_date', 500);
        setFronters((users || []).filter(u => (u.role === 'fronter' || u.role === 'super_admin') && u.isActive));
      }
    } catch {}
    setLoading(false);
  }, [username, refreshKey, isAdmin, fronterFilter]);

  // ── Lead upload (admin) ──
  const addLead = async () => {
    if (!leadForm.firstName.trim() || !leadForm.lastName.trim() || !leadForm.phone.trim() || !leadForm.assignedTo) return;
    try {
      const count = await base44.entities.FronterLead.list('-created_date', 1);
      const num = count?.[0]?.leadNumber ? parseInt(count[0].leadNumber.replace(/\D/g, '')) + 1 : 1;
      await base44.entities.FronterLead.create({
        leadNumber: `#F${String(num).padStart(4, '0')}`,
        firstName: leadForm.firstName.trim(), lastName: leadForm.lastName.trim(), phone: leadForm.phone.trim(),
        status: 'prospect', assignedTo: leadForm.assignedTo, assignedAt: new Date().toISOString(),
        assignedBy: username, uploadedBy: username, notes: leadForm.notes,
      });
      setLeadForm({ firstName: '', lastName: '', phone: '', assignedTo: leadForm.assignedTo, notes: '' });
      setRefreshKey(k => k + 1);
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
  };

  const bulkUpload = async () => {
    if (!bulkText.trim() || !leadForm.assignedTo) { alert('Enter lead data and select a fronter'); return; }
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    let success = 0;
    const existing = await base44.entities.FronterLead.list('-created_date', 1);
    let num = existing?.[0]?.leadNumber ? parseInt(existing[0].leadNumber.replace(/\D/g, '')) + 1 : 1;
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        try {
          const debtAmount = parts[3] ? parseFloat(parts[3].replace(/[^0-9.]/g, '')) || 0 : 0;
          await base44.entities.FronterLead.create({
            leadNumber: `#F${String(num++).padStart(4, '0')}`,
            firstName: parts[0], lastName: parts[1], phone: parts[2],
            debtAmount: debtAmount || undefined,
            status: 'prospect', assignedTo: leadForm.assignedTo, assignedAt: new Date().toISOString(),
            assignedBy: username, uploadedBy: username, notes: parts[4] || '',
          });
          success++;
        } catch {}
      }
    }
    setBulkText('');
    alert(`${success} leads uploaded and assigned to ${leadForm.assignedTo}`);
    setRefreshKey(k => k + 1);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    const text = await file.text();
    setBulkText(text);
  };

  useEffect(() => { load(); }, [load]);

  const handleLeadCalled = (leadId, newCount) => {
    setRefreshKey(k => k + 1);
    if (activeLead?.id === leadId) setActiveLead(null);
  };

  const updateStatus = async (leadId, status) => {
    try {
      const updates = { status };
      if (status === 'transferred') updates.transferredAt = new Date().toISOString();
      await base44.entities.FronterLead.update(leadId, updates);
      setRefreshKey(k => k + 1);
      if (activeLead?.id === leadId) setActiveLead(null);
    } catch {}
  };

  const convertToLead = async (leadId, result) => {
    try {
      const updates = { status: 'lead', lastCallResult: result, lastCalledAt: new Date().toISOString() };
      if (result === 'transferred') { updates.transferredAt = new Date().toISOString(); updates.status = 'transferred'; }
      await base44.entities.FronterLead.update(leadId, updates);
      setRefreshKey(k => k + 1);
      if (activeLead?.id === leadId) setActiveLead(null);
    } catch {}
  };

  const markCallResult = async (leadId, result) => {
    try {
      const l = leads.find(x => x.id === leadId);
      const newCount = (l?.callCount || 0) + 1;
      const updates = { callCount: newCount, lastCalledAt: new Date().toISOString(), lastCallResult: result };
      if (result === 'not_interested') updates.status = 'removed';
      if (newCount >= 3) updates.status = 'removed';
      await base44.entities.FronterLead.update(leadId, updates);
      setRefreshKey(k => k + 1);
      if (activeLead?.id === leadId) setActiveLead(null);
    } catch {}
  };

  const handleDialLog = async (dialLead) => {
    try {
      const log = JSON.parse(dialLead.notesLogJson || '[]');
      const now = new Date().toISOString();
      log.push({ text: `📞 Dialed ${dialLead.phone}`, timestamp: now, author: username, type: 'dial' });
      await base44.entities.FronterLead.update(dialLead.id, { notesLogJson: JSON.stringify(log), lastCalledAt: now });
      setRefreshKey(k => k + 1);
    } catch {}
  };

  const handleNextLead = () => {
    if (!contactCardLead || leads.length === 0) return;
    const idx = leads.findIndex(l => l.id === contactCardLead.id);
    const nextIdx = (idx + 1) % leads.length;
    setContactCardLead(leads[nextIdx]);
  };

  const fmtTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Compute status counts and filtered leads
  const statusCounts = mode === 'leads'
    ? { all: leads.length, transferred: leads.filter(l => l.status === 'transferred').length, interested: leads.filter(l => l.lastCallResult === 'interested').length, appointment: leads.filter(l => l.lastCallResult === 'appointment').length }
    : { all: leads.length, never_called: leads.filter(l => !l.lastCalledAt).length, called: leads.filter(l => l.lastCalledAt).length };
  const FILTER_TABS = mode === 'leads'
    ? [{ id: 'all', label: 'All Leads' }, { id: 'transferred', label: 'Transferred' }, { id: 'interested', label: 'Interested' }, { id: 'appointment', label: 'Appointment' }]
    : [{ id: 'all', label: 'All Prospects' }, { id: 'never_called', label: 'Never Called' }, { id: 'called', label: 'Called' }];
  let displayLeads = leads;
  if (statusFilter !== 'all') {
    if (mode === 'leads') {
      if (statusFilter === 'transferred') displayLeads = leads.filter(l => l.status === 'transferred');
      else displayLeads = leads.filter(l => l.lastCallResult === statusFilter);
    } else {
      if (statusFilter === 'never_called') displayLeads = leads.filter(l => !l.lastCalledAt);
      else displayLeads = leads.filter(l => l.lastCalledAt);
    }
  }
  if (search) {
    const q = search.toLowerCase();
    displayLeads = displayLeads.filter(l => `${l.firstName} ${l.lastName} ${l.phone}`.toLowerCase().includes(q));
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ color: '#e8e0d0', margin: '0 0 4px', fontSize: '20px', fontWeight: 'normal' }}>{mode === 'leads' ? 'Leads' : 'Prospects'}</h2>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
            Never-called {mode === 'leads' ? 'leads' : 'prospects'} appear first · Auto-refreshes every 10s
            <span style={{ marginLeft: '8px', display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', verticalAlign: 'middle' }} />
          </p>
        </div>
      </div>

      {/* Agent stats bar — admin only */}
      {isAdmin && <FronterAgentStatsBar />}

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '16px', overflowX: 'auto' }}>
        {FILTER_TABS.map(t => (
          <button key={t.id} onClick={() => setStatusFilter(t.id)} style={{ background: 'none', border: 'none', borderBottom: statusFilter === t.id ? `2px solid ${GOLD}` : '2px solid transparent', color: statusFilter === t.id ? GOLD : '#6b7280', padding: '10px 16px', cursor: 'pointer', fontSize: '12px', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
            {t.label} <span style={{ fontSize: '11px' }}>({statusCounts[t.id] || 0})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone…" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 14px', color: '#e8e0d0', fontSize: '13px', outline: 'none', fontFamily: 'Georgia, serif' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '14px', alignItems: 'start' }}>
      {/* Lead list */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📋 {mode === 'leads' ? (isAdmin ? 'All Leads' : 'My Leads') : (isAdmin ? 'All Prospects' : 'My Prospects')} — {displayLeads.length} {mode === 'leads' ? 'total' : 'remaining'}</div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {isAdmin && (
              <select value={fronterFilter} onChange={e => setFronterFilter(e.target.value)} style={{ ...inp, width: 'auto', fontSize: '10px', padding: '4px 8px' }}>
                <option value="">All Fronters</option>
                {fronters.map(f => <option key={f.id} value={f.username}>{f.username}</option>)}
              </select>
            )}
            {isAdmin && availableLines.length > 0 && (
              <select value={adminLineKey} onChange={e => onLineChange?.(e.target.value)} style={{ ...inp, width: 'auto', fontSize: '10px', padding: '4px 8px' }}>
                {availableLines.map(l => <option key={l.key} value={l.key}>{l.label} ({l.number})</option>)}
              </select>
            )}
            {isAdmin && mode === 'prospects' && <button onClick={() => setShowUpload(p => !p)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>+ Upload</button>}
            <button onClick={() => setRefreshKey(k => k + 1)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>↻ Refresh</button>
          </div>
        </div>

        {/* Admin upload panel */}
        {isAdmin && mode === 'prospects' && showUpload && (
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(16,185,129,0.04)' }}>
            <div style={{ marginBottom: '10px' }}>
              <label style={ls}>Assign Leads To</label>
              <select value={leadForm.assignedTo} onChange={e => setLeadForm(p => ({ ...p, assignedTo: e.target.value }))} style={{ ...inp, maxWidth: '300px' }}>
                <option value="">— Select fronter —</option>
                {fronters.map(f => <option key={f.id} value={f.username}>{f.username}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div><label style={ls}>First Name</label><input value={leadForm.firstName} onChange={e => setLeadForm(p => ({ ...p, firstName: e.target.value }))} style={inp} /></div>
              <div><label style={ls}>Last Name</label><input value={leadForm.lastName} onChange={e => setLeadForm(p => ({ ...p, lastName: e.target.value }))} style={inp} /></div>
              <div><label style={ls}>Phone</label><input value={leadForm.phone} onChange={e => setLeadForm(p => ({ ...p, phone: e.target.value }))} placeholder="555-123-4567" style={inp} /></div>
            </div>
            <div style={{ marginBottom: '8px' }}><label style={ls}>Notes (optional)</label><input value={leadForm.notes} onChange={e => setLeadForm(p => ({ ...p, notes: e.target.value }))} style={inp} /></div>
            <button onClick={addLead} disabled={!leadForm.firstName || !leadForm.lastName || !leadForm.phone || !leadForm.assignedTo} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: (!leadForm.firstName || !leadForm.assignedTo) ? 0.5 : 1 }}>Add Lead</button>

            <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>+ Bulk Paste Import</div>
              <div style={{ color: '#8a9ab8', fontSize: '10px', marginBottom: '6px' }}>Format: <span style={{ color: GOLD, fontFamily: 'monospace' }}>First Name, Last Name, Phone, Debt Amount, Notes</span> — one lead per line</div>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={5} placeholder={'John,Smith,555-123-4567,15000,Interested in debt relief\nJane,Doe,555-987-6543,25000,Callback tomorrow'} style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: '11px', marginBottom: '8px' }} />
              <button onClick={bulkUpload} disabled={!bulkText.trim() || !leadForm.assignedTo} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: bulkText.trim() && leadForm.assignedTo ? 'pointer' : 'not-allowed', fontSize: '11px', fontWeight: 'bold', opacity: bulkText.trim() && leadForm.assignedTo ? 1 : 0.5 }}>📋 Bulk Upload</button>
            </div>

            <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Bulk Import with Field Mapping</div>
              <button onClick={() => setShowImportModal(true)} disabled={!leadForm.assignedTo} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: leadForm.assignedTo ? 'pointer' : 'not-allowed', fontSize: '11px', fontWeight: 'bold', opacity: leadForm.assignedTo ? 1 : 0.5 }}>📁 Import CSV (Map Fields)</button>
              <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '6px' }}>Upload a CSV and match each column to the right contact card field. All imported leads start as Prospect.</div>
            </div>
          </div>
        )}
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
          ) : displayLeads.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>No {mode === 'leads' ? 'leads' : 'prospects'} assigned to you. Ask your admin to upload and assign leads.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${GOLD}33` }}>
                    {['#', 'Name', 'Phone', 'Debt', 'Status', ...(mode === 'leads' ? ['Disposition'] : []), 'Calls', ...(isAdmin ? ['Owner'] : []), 'Last Called', 'Actions'].map(h => (
                      <th key={h} style={{ color: GOLD, padding: '10px 12px', textAlign: 'left', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayLeads.map((l, i) => {
                    const sc = l.status === 'lead' ? GOLD : l.status === 'transferred' ? '#a78bfa' : '#60a5fa';
                    return (
                      <tr key={l.id}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.1s', background: contactCardLead?.id === l.id ? 'rgba(16,185,129,0.06)' : 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = contactCardLead?.id === l.id ? 'rgba(16,185,129,0.06)' : 'transparent'}
                        onClick={() => setContactCardLead(l)}>
                        <td style={{ padding: '10px 12px', color: '#4a5568', fontSize: '11px' }}>{i + 1}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ color: '#e8e0d0', fontWeight: 'bold' }}>{l.firstName} {l.lastName}</div>
                          {l.leadNumber && <div style={{ color: '#4a5568', fontSize: '10px' }}>{l.leadNumber}</div>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <button onClick={e => { e.stopPropagation(); setActiveLead(l); setDialTrigger(n => n + 1); }} style={{ background: 'rgba(16,185,129,0.1)', color: GOLD, border: '1px solid rgba(16,185,129,0.25)', borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontFamily: 'monospace' }}>📞 {l.phone}</button>
                        </td>
                        <td style={{ padding: '10px 12px', color: l.debtAmount ? GOLD : '#4a5568', fontSize: '12px' }}>{l.debtAmount ? `$${Number(l.debtAmount).toLocaleString()}` : '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ display: 'inline-block', background: `${sc}22`, color: sc, border: `1px solid ${sc}55`, padding: '3px 10px', borderRadius: '4px', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{l.status}</span>
                        </td>
                        {mode === 'leads' && <td style={{ padding: '10px 12px' }}><span style={{ color: l.lastCallResult === 'transferred' ? '#a78bfa' : GOLD, fontSize: '11px', fontWeight: 'bold' }}>{l.lastCallResult ? l.lastCallResult.replace(/_/g, ' ') : '—'}</span></td>}
                        <td style={{ padding: '10px 12px', color: '#8a9ab8', fontSize: '12px', textAlign: 'center' }}>{l.callCount || 0}/3</td>
                        {isAdmin && <td style={{ padding: '10px 12px' }}><span style={{ color: '#60a5fa', fontSize: '11px', fontWeight: 'bold' }}>{l.assignedTo || '—'}</span></td>}
                        <td style={{ padding: '10px 12px', fontSize: '11px' }}>
                          {l.lastCalledAt ? <span style={{ color: '#f59e0b' }}>{fmtTime(l.lastCalledAt)}</span> : <span style={{ color: '#4a5568' }}>Never</span>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <button onClick={e => { e.stopPropagation(); setContactCardLead(l); }} style={{ background: 'rgba(16,185,129,0.15)', color: GOLD, border: '1px solid rgba(16,185,129,0.3)', borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px' }}>Open →</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Active lead + dialer */}
      <div>
        {activeLead ? (
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold' }}>{activeLead.firstName} {activeLead.lastName}</div>
                <div style={{ color: '#6b7280', fontSize: '12px' }}>{activeLead.phone}</div>
              </div>
              <button onClick={() => setActiveLead(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>

            <div style={{ marginBottom: '12px', display: 'flex', gap: '6px' }}>
              <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', background: activeLead.status === 'lead' ? 'rgba(16,185,129,0.15)' : 'rgba(96,165,250,0.15)', color: activeLead.status === 'lead' ? GOLD : '#60a5fa' }}>{activeLead.status}</span>
              <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '10px', background: 'rgba(255,255,255,0.05)', color: '#8a9ab8' }}>{activeLead.callCount || 0}/3 calls</span>
            </div>

            {activeLead.lastCalledAt && (
              <div style={{ color: '#4a5568', fontSize: '11px', marginBottom: '10px' }}>Last called: {new Date(activeLead.lastCalledAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
            )}

            {/* Dialer */}
            <FronterDialer
              lead={activeLead}
              username={username}
              lineKey={lineKey}
              lineNumber={lineNumber}
              onLeadCalled={handleLeadCalled}
              autoDialTrigger={dialTrigger}
              onDial={handleDialLog}
              onCallConnected={onCallConnected}
            />

            {/* Status update */}
            <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Convert to Lead</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {activeLead.status === 'prospect' && (
                  <>
                    <button onClick={() => convertToLead(activeLead.id, 'transferred')} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✓ Transferred (Lead)</button>
                    <button onClick={() => convertToLead(activeLead.id, 'interested')} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✓ Interested</button>
                    <button onClick={() => convertToLead(activeLead.id, 'appointment')} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✓ Appointment (Lead)</button>
                  </>
                )}
              </div>
              <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', margin: '10px 0 6px' }}>Call Result</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => markCallResult(activeLead.id, 'not_interested')} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '4px', padding: '7px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>✗ Not Interested</button>
                <button onClick={() => markCallResult(activeLead.id, 'voicemail')} style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '4px', padding: '7px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>📞 Voicemail</button>
                <button onClick={() => markCallResult(activeLead.id, 'hung_up')} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '4px', padding: '7px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>📵 Hung Up</button>
                <button onClick={() => markCallResult(activeLead.id, 'no_answer')} style={{ background: 'rgba(138,154,184,0.1)', color: '#8a9ab8', border: '1px solid rgba(138,154,184,0.25)', borderRadius: '4px', padding: '7px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>🚫 No Answer</button>
              </div>
            </div>

            {activeLead.notes && (
              <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Notes</div>
                <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{activeLead.notes}</div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ color: '#4a5568', fontSize: '13px' }}>Select a {mode === 'leads' ? 'lead' : 'prospect'} from the list to start calling</div>
          </div>
        )}
      </div>

      {/* CSV import modal */}
      {showImportModal && (
        <FronterLeadImportModal
          assignedTo={leadForm.assignedTo}
          assignedBy={username}
          onClose={() => setShowImportModal(false)}
          onImported={() => { setShowImportModal(false); setRefreshKey(k => k + 1); }}
        />
      )}

      {/* Contact card modal */}
      {contactCardLead && (
        <FronterContactCard
          lead={contactCardLead}
          username={username}
          fronterFirstName={fronterFirstName}
          onClose={() => setContactCardLead(null)}
          onSave={(updated) => { setRefreshKey(k => k + 1); setContactCardLead(prev => ({ ...prev, ...updated })); }}
          onDial={(l) => { setActiveLead(l); setDialTrigger(n => n + 1); }}
          onNext={handleNextLead}
          isAdmin={isAdmin}
        />
      )}
      </div>
    </div>
  );
}