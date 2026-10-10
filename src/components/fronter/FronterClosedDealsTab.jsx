/**
 * FronterClosedDealsTab.jsx — Shows leads with status 'closed_deal'.
 * Super admins can mark a lead as Closed Deal from here or from the contact card.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import FronterContactCard from '@/components/fronter/FronterContactCard';
import { renderFormatted } from '@/components/debt/ScriptRichText';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const PURPLE = '#a78bfa';

function fmtET(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function FronterClosedDealsTab({ username, isAdmin, fronterFirstName }) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [contactCardLead, setContactCardLead] = useState(null);
  const [search, setSearch] = useState('');
  const [fronterFilter, setFronterFilter] = useState('');
  const [fronters, setFronters] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = isAdmin
        ? await base44.entities.FronterLead.filter({ status: 'closed_deal' }, '-closedDealAt', 500)
        : await base44.entities.FronterLead.filter({ status: 'closed_deal', assignedTo: username }, '-closedDealAt', 500);
      let filtered = all || [];
      if (isAdmin && fronterFilter) filtered = filtered.filter(l => l.assignedTo === fronterFilter);
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(l => `${l.firstName} ${l.lastName} ${l.phone}`.toLowerCase().includes(q));
      }
      setDeals(filtered);
      if (isAdmin) {
        const users = await base44.entities.DebtCoachUser.list('-created_date', 500);
        setFronters((users || []).filter(u => (u.role === 'fronter' || u.role === 'super_admin') && u.isActive));
      }
    } catch {}
    setLoading(false);
  }, [username, isAdmin, fronterFilter, search, refreshKey]);

  useEffect(() => { load(); }, [load]);

  const handleNextDeal = () => {
    if (!contactCardLead || deals.length === 0) return;
    const idx = deals.findIndex(l => l.id === contactCardLead.id);
    const nextIdx = (idx + 1) % deals.length;
    setContactCardLead(deals[nextIdx]);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ color: '#e8e0d0', margin: '0 0 4px', fontSize: '20px', fontWeight: 'normal' }}>💎 Closed Deals</h2>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
            Deals that have been signed and executed
            <span style={{ marginLeft: '8px', display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 6px #a78bfa' }} />
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isAdmin && (
            <select value={fronterFilter} onChange={e => setFronterFilter(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '12px', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
              <option value="">All Fronters</option>
              {fronters.map(f => <option key={f.id} value={f.username}>{f.username}</option>)}
            </select>
          )}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone…" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 12px', color: '#e8e0d0', fontSize: '12px', outline: 'none', fontFamily: 'Georgia, serif', minWidth: '200px' }} />
          <button onClick={() => setRefreshKey(k => k + 1)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>↻ Refresh</button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px' }}>Loading…</div>
      ) : deals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>💎</div>
          <div style={{ color: '#4a5568', fontSize: '14px' }}>No closed deals yet. When a deal is signed and executed, it will appear here.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${PURPLE}33` }}>
                {['Status', 'Name', 'Phone', 'Debt', 'Fronts', 'Closed At', ''].map(h => (
                  <th key={h} style={{ color: PURPLE, padding: '10px 12px', textAlign: 'left', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map(l => (
                <tr key={l.id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => setContactCardLead(l)}>
                  <td style={{ padding: '12px' }}>
                    <span style={{ display: 'inline-block', background: `${PURPLE}22`, color: PURPLE, border: `1px solid ${PURPLE}55`, padding: '3px 10px', borderRadius: '4px', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>💎 Closed Deal</span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ color: '#e8e0d0', fontWeight: 'bold' }}>{l.firstName} {l.lastName}</div>
                    {l.leadNumber && <div style={{ color: '#4a5568', fontSize: '10px' }}>{l.leadNumber}</div>}
                  </td>
                  <td style={{ padding: '12px', color: '#8a9ab8', fontSize: '12px', fontFamily: 'monospace' }}>{l.phone || '—'}</td>
                  <td style={{ padding: '12px', color: l.debtAmount ? GOLD : '#4a5568', fontSize: '12px' }}>{l.debtAmount ? `$${Number(l.debtAmount).toLocaleString()}` : '—'}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ color: '#60a5fa', fontSize: '11px', fontWeight: 'bold' }}>{l.assignedTo || '—'}</span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '11px', color: PURPLE }}>{l.closedDealAt ? fmtET(l.closedDealAt) : '—'}</td>
                  <td style={{ padding: '12px' }}>
                    <button onClick={e => { e.stopPropagation(); setContactCardLead(l); }} style={{ background: `${PURPLE}18`, color: PURPLE, border: `1px solid ${PURPLE}44`, borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px' }}>Open →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {contactCardLead && (
        <FronterContactCard
          lead={contactCardLead}
          username={username}
          fronterFirstName={fronterFirstName}
          onClose={() => setContactCardLead(null)}
          onSave={(updated) => { setRefreshKey(k => k + 1); setContactCardLead(prev => ({ ...prev, ...updated })); }}
          onNext={handleNextDeal}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}