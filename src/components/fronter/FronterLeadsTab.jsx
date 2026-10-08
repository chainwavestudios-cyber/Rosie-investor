/**
 * FronterLeadsTab.jsx — Lead list for the fronter.
 * Fronter calls directly off the list. After a call, the lead moves to the
 * back of the list and shows last-called time. Leads are removed after 3 calls.
 * Fronter can update status from prospect → lead (agreed to speak to agent).
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import FronterDialer from './FronterDialer';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function FronterLeadsTab({ username, lineKey, lineNumber }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeLead, setActiveLead] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.FronterLead.filter({ assignedTo: username }, '-created_date', 500);
      // Sort: un-called first, then by oldest call (back of list), exclude removed
      const active = (all || []).filter(l => l.status !== 'removed' && l.status !== 'transferred' && (l.callCount || 0) < 3);
      const sorted = [...active].sort((a, b) => {
        // Never-called leads first
        if (!a.lastCalledAt && b.lastCalledAt) return -1;
        if (a.lastCalledAt && !b.lastCalledAt) return 1;
        // Then by oldest called (back of list)
        if (a.lastCalledAt && b.lastCalledAt) return new Date(a.lastCalledAt) - new Date(b.lastCalledAt);
        return 0;
      });
      setLeads(sorted);
    } catch {}
    setLoading(false);
  }, [username, refreshKey]);

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
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📋 My Leads — {leads.length} remaining</div>
          <button onClick={() => setRefreshKey(k => k + 1)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>↻ Refresh</button>
        </div>
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