/**
 * VaultEntryTable.jsx — Table of vault entries with filters and line-type badges.
 */
import { useState } from 'react';
import PhoneVerifyBadge from './PhoneVerifyBadge';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const PURPLE = '#a78bfa';
const AMBER = '#f59e0b';

const lineTypeColor = (lt) => {
  if (lt === 'mobile') return GOLD;
  if (lt === 'landline') return BLUE;
  if (lt === 'voip') return RED;
  return '#6b7280';
};

const statusColor = (s) => {
  if (s === 'validated') return GOLD;
  if (s === 'failed') return RED;
  return AMBER;
};

export default function VaultEntryTable({ entries }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = entries.filter(e => {
    if (filter === 'pending' && e.validationStatus !== 'pending') return false;
    if (filter === 'validated' && e.validationStatus !== 'validated') return false;
    if (filter === 'mobile' && e.phoneLineType !== 'mobile') return false;
    if (filter === 'landline' && e.phoneLineType !== 'landline') return false;
    if (filter === 'voip' && e.phoneLineType !== 'voip') return false;
    if (filter === 'distributed' && e.destination === 'none') return false;
    if (filter === 'available' && (e.validationStatus !== 'validated' || !e.phoneValid || e.phoneLineType === 'voip' || e.destination !== 'none')) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(`${e.firstName} ${e.lastName} ${e.phone}`.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const FILTERS = [
    { id: 'all', label: 'All', count: entries.length },
    { id: 'available', label: '✓ Available', color: GOLD, count: entries.filter(e => e.validationStatus === 'validated' && e.phoneValid && e.phoneLineType !== 'voip' && e.destination === 'none').length },
    { id: 'pending', label: '⏳ Pending', color: AMBER, count: entries.filter(e => e.validationStatus === 'pending').length },
    { id: 'mobile', label: '📱 Mobile', color: GOLD, count: entries.filter(e => e.phoneLineType === 'mobile').length },
    { id: 'landline', label: '☎️ Landline', color: BLUE, count: entries.filter(e => e.phoneLineType === 'landline').length },
    { id: 'voip', label: '📵 VoIP', color: RED, count: entries.filter(e => e.phoneLineType === 'voip').length },
    { id: 'distributed', label: '📤 Distributed', color: PURPLE, count: entries.filter(e => e.destination !== 'none').length },
  ];

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Filter bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: '4px 10px', background: filter === f.id ? `${f.color || GOLD}15` : 'rgba(255,255,255,0.03)', border: `1px solid ${filter === f.id ? (f.color || GOLD) + '44' : 'rgba(255,255,255,0.08)'}`, borderRadius: '12px', color: filter === f.id ? (f.color || GOLD) : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: filter === f.id ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>
            {f.label} ({f.count})
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone…" style={{ flex: 1, minWidth: 150, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '5px 10px', color: '#e8e0d0', fontSize: '11px', outline: 'none', fontFamily: 'Georgia, serif' }} />
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#0d1b2a' }}>
            <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Name</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Phone</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>City, State</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Status</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Line Type</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Carrier</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>Destination</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#4a5568', fontSize: '13px' }}>No entries match this filter.</td></tr>
            ) : filtered.slice(0, 200).map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '6px 12px', color: '#e8e0d0', fontSize: '12px', whiteSpace: 'nowrap' }}>{e.firstName} {e.lastName}</td>
                <td style={{ padding: '6px 12px', color: '#c4cdd8', fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {e.phoneE164 || e.phone}
                  {e.phoneValid && e.phoneLineType && e.phoneLineType !== 'voip' && e.phoneLineType !== 'unknown' && (
                    <span style={{ marginLeft: '4px' }}><PhoneVerifyBadge phoneValid={e.phoneValid} phoneLineType={e.phoneLineType} compact /></span>
                  )}
                </td>
                <td style={{ padding: '6px 12px', color: '#8a9ab8', fontSize: '11px', whiteSpace: 'nowrap' }}>{[e.city, e.state].filter(Boolean).join(', ') || '—'}</td>
                <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '9px', fontWeight: 'bold', background: `${statusColor(e.validationStatus)}15`, color: statusColor(e.validationStatus) }}>{e.validationStatus}</span>
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                  {e.phoneLineType && e.phoneLineType !== 'unknown' ? (
                    <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '9px', fontWeight: 'bold', background: `${lineTypeColor(e.phoneLineType)}15`, color: lineTypeColor(e.phoneLineType) }}>{e.phoneLineType}</span>
                  ) : <span style={{ color: '#4a5568', fontSize: '10px' }}>—</span>}
                </td>
                <td style={{ padding: '6px 12px', color: '#8a9ab8', fontSize: '11px', whiteSpace: 'nowrap' }}>{e.phoneCarrier || '—'}</td>
                <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                  {e.destination === 'fronter' ? <span style={{ color: GOLD, fontSize: '10px' }}>👤 {e.assignedTo}</span> :
                   e.destination === 'ai_dialer' ? <span style={{ color: PURPLE, fontSize: '10px' }}>🤖 AI Dialer</span> :
                   <span style={{ color: '#4a5568', fontSize: '10px' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > 200 && <div style={{ padding: '8px 16px', color: '#4a5568', fontSize: '10px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.04)' }}>Showing first 200 of {filtered.length} entries</div>}
    </div>
  );
}