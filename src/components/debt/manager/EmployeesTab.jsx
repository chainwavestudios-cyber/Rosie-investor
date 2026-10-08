/**
 * EmployeesTab.jsx — Lists all employees (dialers, managers, super_managers, admins) except super_admin.
 * Replaces DialersTab. Shows role-specific contact cards.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import EmployeeContactCard from './EmployeeContactCard';

const GOLD = '#10b981';
const ROLE_COLORS = { admin: '#60a5fa', super_manager: '#34d399', manager: '#a78bfa', dialer: '#f59e0b', fronter: '#22d3ee' };
const ROLE_ORDER = { admin: 0, super_manager: 1, manager: 2, dialer: 3, fronter: 4 };

export default function EmployeesTab({ managerUsername, managerRole, autoSelectUsername }) {
  const { user } = useDebtCoachAuth();
  const [employees, setEmployees] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');

  const viewerRole = managerRole || user?.role;

  const load = useCallback(async () => {
    try {
      const [allUsers, allSessions] = await Promise.all([
        base44.entities.DebtCoachUser.list('-created_date', 500),
        base44.entities.DialerSession.list('-loginAt', 500),
      ]);
      // Everyone except super_admin (and not yourself — you don't need a contact card for yourself)
      setEmployees((allUsers || []).filter(u => u.role !== 'super_admin' && u.isActive && u.id !== user?.id));
      setSessions(allSessions || []);
    } catch {}
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  // Auto-select a dialer (e.g., when jumping from a hot-call alert popup)
  useEffect(() => {
    if (autoSelectUsername && employees.length) {
      const found = employees.find(e => e.username === autoSelectUsername);
      if (found) setSelected(found);
    }
  }, [autoSelectUsername, employees]);

  const getSession = (username) => sessions.find(s => s.username === username && (s.status === 'logged_in' || s.status === 'on_call'));

  const filtered = roleFilter === 'all' ? employees : employees.filter(e => e.role === roleFilter);
  const sorted = [...filtered].sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));

  const onlineCount = employees.filter(e => getSession(e.username)).length;
  const onCallCount = employees.filter(e => getSession(e.username)?.status === 'on_call').length;

  const counts = {
    dialer: employees.filter(e => e.role === 'dialer').length,
    manager: employees.filter(e => e.role === 'manager').length,
    super_manager: employees.filter(e => e.role === 'super_manager').length,
    admin: employees.filter(e => e.role === 'admin').length,
    fronter: employees.filter(e => e.role === 'fronter').length,
  };

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <SummaryCard value={employees.length} label="Total Employees" color={GOLD} />
        <SummaryCard value={onlineCount} label="Online Now" color="#60a5fa" />
        <SummaryCard value={onCallCount} label="On a Call" color="#ef4444" />
        <SummaryCard value={counts.dialer} label="Dialers" color="#f59e0b" />
        <SummaryCard value={counts.manager} label="Managers" color="#a78bfa" />
        <SummaryCard value={counts.super_manager} label="Super Managers" color="#34d399" />
        <SummaryCard value={counts.admin} label="Admins" color="#60a5fa" />
        <SummaryCard value={counts.fronter} label="Fronters" color="#22d3ee" />
      </div>

      {/* Role filter */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {[['all', 'All'], ['dialer', 'Dialers'], ['manager', 'Managers'], ['super_manager', 'Super Managers'], ['admin', 'Admins'], ['fronter', 'Fronters']].map(([r, label]) => (
          <button key={r} onClick={() => setRoleFilter(r)} style={{ padding: '6px 14px', borderRadius: '4px', border: `1px solid ${roleFilter === r ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: roleFilter === r ? `${GOLD}18` : 'transparent', color: roleFilter === r ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{label}</button>
        ))}
      </div>

      {/* Employee list + detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '320px 1fr' : '1fr', gap: '16px', alignItems: 'start' }}>
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>👥 All Employees</div>
          </div>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {loading ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px 0' }}>Loading…</div> :
             sorted.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '30px 0', fontSize: '12px' }}>No employees found.</div> :
             sorted.map(e => {
              const session = getSession(e.username);
              const isOnline = !!session;
              const isOnCall = session?.status === 'on_call';
              const rc = ROLE_COLORS[e.role] || '#6b7280';
              return (
                <button key={e.id} onClick={() => setSelected(e)} style={{ width: '100%', background: selected?.id === e.id ? 'rgba(16,185,129,0.08)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '12px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isOnCall ? '#ef4444' : isOnline ? '#4ade80' : '#4a5568', flexShrink: 0, animation: isOnCall ? 'pulse 1s infinite' : 'none' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: selected?.id === e.id ? GOLD : '#c4cdd8', fontSize: '13px', fontWeight: 'bold' }}>{e.username}</div>
                    <div style={{ color: '#6b7280', fontSize: '10px' }}>
                      <span style={{ color: rc, textTransform: 'uppercase', fontWeight: 'bold' }}>{e.role.replace('_', ' ')}</span>
                      {' · '}
                      {isOnCall ? '🔴 On a call' : isOnline ? '🟢 Online' : '⚫ Offline'}
                    </div>
                  </div>
                  {isOnCall && <span style={{ color: '#ef4444', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>LIVE</span>}
                </button>
              );
            })}
          </div>
        </div>

        {selected && (
          <EmployeeContactCard
            employee={selected}
            session={getSession(selected.username)}
            managerUsername={managerUsername}
            managerRole={viewerRole}
            onRefresh={load}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}

function SummaryCard({ value, label, color }) {
  return (
    <div style={{ background: '#0d1b2a', border: `1px solid ${color}22`, borderRadius: '6px', padding: '12px 18px', flex: '0 0 auto' }}>
      <div style={{ color, fontSize: '20px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
    </div>
  );
}