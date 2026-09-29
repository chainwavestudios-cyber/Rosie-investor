/**
 * ComplianceMonitorTab.jsx — SuperManager/Admin view to monitor dialers.
 * Toggle compliance per user, view live compliance scores, and open compliance cards.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import ComplianceContactCard from './ComplianceContactCard';

const GOLD = '#10b981';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' };

export default function ComplianceMonitorTab() {
  const { user } = useDebtCoachAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userRecords, setUserRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [toggling, setToggling] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('complianceAdmin', { action: 'listUsers' });
      const data = res?.data || res;
      setUsers(data.users || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); const interval = setInterval(load, 10000); return () => clearInterval(interval); }, [load]);

  const loadUserRecords = useCallback(async (username) => {
    try {
      const res = await base44.functions.invoke('complianceAdmin', { action: 'getRecords', targetUsername: username });
      const data = res?.data || res;
      setUserRecords(data.records || []);
    } catch {}
  }, []);

  useEffect(() => { if (selectedUser) loadUserRecords(selectedUser.username); }, [selectedUser, loadUserRecords]);

  const toggleCompliance = async (u) => {
    setToggling(u.id);
    try {
      await base44.functions.invoke('complianceAdmin', {
        action: 'updateSettings',
        targetUserId: u.id, targetUsername: u.username, targetRole: u.role,
        isEnabled: !u.complianceEnabled,
        sensitivityLevel: u.sensitivity || 'balanced',
      });
      load();
    } catch {}
    setToggling(null);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedUser ? '320px 1fr' : '1fr', gap: '16px', alignItems: 'start' }}>
      {/* User list */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>👥 Monitored Users</div>
        </div>
        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {loading ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px' }}>Loading…</div> :
           users.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px', fontSize: '12px' }}>No users available to monitor.</div> :
           users.map(u => (
            <button key={u.id} onClick={() => setSelectedUser(u)} style={{ width: '100%', background: selectedUser?.id === u.id ? 'rgba(16,185,129,0.08)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '12px 16px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: selectedUser?.id === u.id ? GOLD : '#c4cdd8', fontSize: '13px', fontWeight: 'bold' }}>{u.username}</div>
                  <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>{u.role}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: u.complianceEnabled ? '#4ade80' : '#4a5568' }} />
                  <button onClick={(e) => { e.stopPropagation(); toggleCompliance(u); }} disabled={toggling === u.id} style={{ padding: '3px 10px', borderRadius: '3px', border: `1px solid ${u.complianceEnabled ? 'rgba(239,68,68,0.3)' : GOLD + '44'}`, background: u.complianceEnabled ? 'rgba(239,68,68,0.1)' : `${GOLD}18`, color: u.complianceEnabled ? '#ef4444' : GOLD, cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', opacity: toggling === u.id ? 0.5 : 1 }}>{u.complianceEnabled ? 'ON' : 'OFF'}</button>
                </div>
              </div>
              {u.complianceEnabled && <div style={{ color: '#6b7280', fontSize: '9px', marginTop: '4px' }}>Sensitivity: {u.sensitivity || 'balanced'}</div>}
            </button>
          ))}
        </div>
      </div>

      {/* Selected user records */}
      {selectedUser && (
        <div>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
            🛡 Compliance Records — {selectedUser.username} ({userRecords.length})
          </div>
          {userRecords.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>No compliance records for this user.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {userRecords.map(r => {
                const statusColor = { OPEN: '#ef4444', UNDER_REVIEW: '#f59e0b', REMEDIED: '#60a5fa', CLOSED: '#6b7280' }[r.status] || '#6b7280';
                return (
                  <button key={r.id} onClick={() => setSelectedRecord(r.id)} style={{ width: '100%', background: '#0d1b2a', border: `1px solid ${statusColor}22`, borderRadius: '6px', padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{r.complianceId}</span>
                        <span style={{ padding: '2px 8px', borderRadius: '2px', background: `${statusColor}18`, color: statusColor, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{r.status.replace('_', ' ')}</span>
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>{new Date(r.created_date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', textAlign: 'center' }}>
                      <div><div style={{ color: r.complianceScore >= 80 ? '#4ade80' : '#ef4444', fontSize: '16px', fontWeight: 'bold' }}>{r.complianceScore ?? '—'}%</div><div style={{ color: '#6b7280', fontSize: '8px' }}>Score</div></div>
                      <div><div style={{ color: '#ef4444', fontSize: '16px', fontWeight: 'bold' }}>{r.violationsCount || 0}</div><div style={{ color: '#6b7280', fontSize: '8px' }}>Violations</div></div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedRecord && <ComplianceContactCard recordId={selectedRecord} onClose={() => { setSelectedRecord(null); if (selectedUser) loadUserRecords(selectedUser.username); }} />}
    </div>
  );
}