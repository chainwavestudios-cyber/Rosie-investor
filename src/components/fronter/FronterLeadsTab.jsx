/**
 * FronterLeadsTab.jsx — Lead list for the fronter.
 * Fronter calls directly off the list. After a call, the lead moves to the
 * back of the list and shows last-called time. Leads are removed after 3 calls.
 * Fronter can update status from prospect → lead (agreed to speak to agent).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import FronterDialer from './FronterDialer';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function FronterLeadsTab({ username, lineKey, lineNumber, isAdmin = false, availableLines = [], adminLineKey = '', onLineChange }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeLead, setActiveLead] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [fronters, setFronters] = useState([]);
  const [leadForm, setLeadForm] = useState({ firstName: '', lastName: '', phone: '', assignedTo: '', notes: '' });
  const [bulkText, setBulkText] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Admin sees all active leads; fronter sees only their own
      const all = isAdmin
        ? await base44.entities.FronterLead.list('-created_date', 500)
        : await base44.entities.FronterLead.filter({ assignedTo: username }, '-created_date', 500);
      // Sort: un-called first, then by oldest call (back of list), exclude removed
      const active = (all || []).filter(l => l.status !== 'removed' && l.status !== 'transferred' && (l.callCount || 0) < 3);
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
  }, [username, refreshKey, isAdmin]);

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
          await base44.entities.FronterLead.create({
            leadNumber: `#F${String(num++).padStart(4, '0')}`,
            firstName: parts[0], lastName: parts[1], phone: parts[2],
            status: 'prospect', assignedTo: leadForm.assignedTo, assignedAt: new Date().toISOString(),
            assignedBy: username, uploadedBy: username, notes: parts[3] || '',
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
      await base44.entities.FronterLead.update(leadId, { status });
      setRefreshKey(k => k + 1);
      if (activeLead?.id === leadId) setActiveLead(null);
    } catch {}
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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '14px', alignItems: 'start' }}>
      {/* Lead list */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📋 {isAdmin ? 'All Leads' : 'My Leads'} — {leads.length} remaining</div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {isAdmin && availableLines.length > 0 && (
              <select value={adminLineKey} onChange={e => onLineChange?.(e.target.value)} style={{ ...inp, width: 'auto', fontSize: '10px', padding: '4px 8px' }}>
                {availableLines.map(l => <option key={l.key} value={l.key}>{l.label} ({l.number})</option>)}
              </select>
            )}
            {isAdmin && <button onClick={() => setShowUpload(p => !p)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>+ Upload</button>}
            <button onClick={() => setRefreshKey(k => k + 1)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>↻ Refresh</button>
          </div>
        </div>

        {/* Admin upload panel */}
        {isAdmin && showUpload && (
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
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Bulk Upload (CSV: First, Last, Phone, Notes)</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }} />
                <button onClick={() => fileRef.current?.click()} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>📁 Upload CSV</button>
              </div>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={4} placeholder="John,Smith,555-123-4567,interested&#10;Jane,Doe,555-987-6543," style={{ ...inp, resize: 'vertical', marginBottom: '8px' }} />
              <button onClick={bulkUpload} disabled={!bulkText.trim() || !leadForm.assignedTo} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: (!bulkText.trim() || !leadForm.assignedTo) ? 0.5 : 1 }}>Upload & Assign</button>
            </div>
          </div>
        )}
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
          ) : leads.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>No leads assigned to you. Ask your admin to upload and assign leads.</div>
          ) : (
            leads.map((l, i) => (
              <div key={l.id} onClick={() => setActiveLead(l)} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: activeLead?.id === l.id ? 'rgba(16,185,129,0.06)' : 'transparent', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#4a5568', fontSize: '11px', minWidth: '24px' }}>{i + 1}.</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{l.firstName} {l.lastName}</div>
                  <div style={{ color: '#6b7280', fontSize: '11px' }}>{l.phone}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', background: l.status === 'lead' ? 'rgba(16,185,129,0.15)' : 'rgba(96,165,250,0.15)', color: l.status === 'lead' ? GOLD : '#60a5fa' }}>{l.status}</span>
                  <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '3px' }}>
                    {(l.callCount || 0)}/3 calls · {fmtTime(l.lastCalledAt)}
                  </div>
                </div>
              </div>
            ))
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
            />

            {/* Status update */}
            <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Update Status</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {activeLead.status === 'prospect' && (
                  <button onClick={() => updateStatus(activeLead.id, 'lead')} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✓ Agree to Speak → Lead</button>
                )}
                <button onClick={() => updateStatus(activeLead.id, 'transferred')} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Transferred</button>
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
            <div style={{ color: '#4a5568', fontSize: '13px' }}>Select a lead from the list to start calling</div>
          </div>
        )}
      </div>
    </div>
  );
}