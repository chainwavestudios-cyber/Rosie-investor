/**
 * MyComplianceTab.jsx — Dialer/Manager view of their own compliance records.
 * Shows all compliance IDs assigned to the logged-in user with filtering.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import ComplianceContactCard from './ComplianceContactCard';

const GOLD = '#10b981';
const STATUS_COLORS = { OPEN: '#ef4444', UNDER_REVIEW: '#f59e0b', REMEDIED: '#60a5fa', CLOSED: '#6b7280' };

export default function MyComplianceTab() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [stats, setStats] = useState({ total: 0, open: 0, avgScore: 100 });

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('complianceAdmin', { action: 'getRecords' });
      const data = res?.data || res;
      const recs = data.records || [];
      setRecords(recs);
      setStats({
        total: recs.length,
        open: recs.filter(r => r.status === 'OPEN').length,
        avgScore: recs.length > 0 ? Math.round(recs.reduce((s, r) => s + (r.complianceScore || 0), 0) / recs.length) : 100,
      });
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); const interval = setInterval(load, 15000); return () => clearInterval(interval); }, [load]);

  const filtered = statusFilter === 'ALL' ? records : records.filter(r => r.status === statusFilter);

  return (
    <div>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <StatCard label="Total Compliance IDs" value={stats.total} color={GOLD} />
        <StatCard label="Open Issues" value={stats.open} color="#ef4444" />
        <StatCard label="Average Score" value={`${stats.avgScore}%`} color={stats.avgScore >= 80 ? '#4ade80' : '#f59e0b'} />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {['ALL', 'OPEN', 'UNDER_REVIEW', 'REMEDIED', 'CLOSED'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '6px 14px', borderRadius: '4px', border: `1px solid ${statusFilter === s ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: statusFilter === s ? `${GOLD}18` : 'transparent', color: statusFilter === s ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{s === 'ALL' ? 'All' : s.replace('_', ' ')}</button>
        ))}
      </div>

      {loading ? <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Loading…</div> :
       filtered.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>No compliance records found. Keep up the good work!</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(r => {
            const statusColor = STATUS_COLORS[r.status] || '#6b7280';
            return (
              <button key={r.id} onClick={() => setSelectedRecord(r.id)} style={{ width: '100%', background: '#0d1b2a', border: `1px solid ${statusColor}22`, borderRadius: '6px', padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{r.complianceId}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '2px', background: `${statusColor}18`, color: statusColor, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{r.status.replace('_', ' ')}</span>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '11px' }}>{new Date(r.created_date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} · Monitor: {r.monitoredByUsername || '—'}</div>
                  {r.leadName && <div style={{ color: '#8a9ab8', fontSize: '11px' }}>Lead: {r.leadName}</div>}
                </div>
                <div style={{ display: 'flex', gap: '12px', textAlign: 'center' }}>
                  <div><div style={{ color: r.complianceScore >= 80 ? '#4ade80' : r.complianceScore >= 60 ? '#f59e0b' : '#ef4444', fontSize: '18px', fontWeight: 'bold' }}>{r.complianceScore ?? '—'}%</div><div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase' }}>Score</div></div>
                  <div><div style={{ color: '#ef4444', fontSize: '18px', fontWeight: 'bold' }}>{r.violationsCount || 0}</div><div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase' }}>Violations</div></div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedRecord && <ComplianceContactCard recordId={selectedRecord} onClose={() => { setSelectedRecord(null); load(); }} />}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '14px 20px' }}>
      <div style={{ color, fontSize: '20px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
    </div>
  );
}