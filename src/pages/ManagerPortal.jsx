import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { isComplianceManager, isComplianceAdmin } from '@/lib/complianceRoles';
import EmployeesTab from '@/components/debt/manager/EmployeesTab';
import ManagerTranscriptTab from '@/components/debt/manager/ManagerTranscriptTab';
import ComplianceMonitorTab from '@/components/compliance/ComplianceMonitorTab';
import ComplianceAdminTab from '@/components/compliance/ComplianceAdminTab';
import MyComplianceTab from '@/components/compliance/MyComplianceTab';
import ComplianceToast from '@/components/compliance/ComplianceToast';
import ComplianceContactCard from '@/components/compliance/ComplianceContactCard';
import HotCallAlertsPopup from '@/components/debt/manager/HotCallAlertsPopup';
import HotCallSettingsPanel from '@/components/debt/manager/HotCallSettingsPanel';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function ManagerPortal() {
  const { user, loading, isAuthenticated, isAdmin, isManager, isSuperManager, logout } = useDebtCoachAuth();
  const [tab, setTab] = useState('employees');
  const [inspectRecord, setInspectRecord] = useState(null);
  const [autoSelectUsername, setAutoSelectUsername] = useState(null);
  const navigate = useNavigate();

  if (loading) return (
    <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading…</div>
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/debt-call-coach-login" replace />;
  if (!isAdmin && !isManager && !isSuperManager) return <Navigate to="/debt-call-coach" replace />;

  const canMonitor = isComplianceManager(user?.role);
  const canAdmin = isComplianceAdmin(user?.role);

  const TABS = [
    { id: 'employees', label: '👥 Employees' },
    { id: 'hotcall', label: '🔥 Hot Call AI' },
    { id: 'transcripts', label: '📝 Transcripts' },
    ...(canMonitor ? [{ id: 'compliance_monitor', label: '🛡 Compliance Monitor' }] : []),
    ...(canMonitor ? [{ id: 'compliance_my', label: '🛡 My Compliance' }] : []),
    ...(canAdmin ? [{ id: 'compliance_admin', label: '⚙️ Compliance Admin' }] : []),
  ];

  return (
    <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: DARK, color: '#e8e0d0', padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'normal', color: '#e8e0d0' }}>🎛️ Manager Portal</h1>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '4px' }}>
            Live Call Monitoring · Dialer Analytics · AI Control
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{user?.username}</span>
            <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '2px', background: 'rgba(16,185,129,0.15)', color: GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : user?.role === 'super_manager' ? 'Super Manager' : 'Manager'}</span>
          </div>
          <button onClick={() => navigate('/debt-call-coach')} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>← Back to Coach</button>
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 18px', background: tab === t.id ? `${GOLD}12` : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? GOLD : 'transparent'}`, color: tab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: tab === t.id ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{t.label}</button>
        ))}
      </div>

      {tab === 'employees' && <EmployeesTab managerUsername={user?.username} managerRole={user?.role} autoSelectUsername={autoSelectUsername} />}
      {tab === 'hotcall' && <HotCallSettingsPanel managerUsername={user?.username} />}
      {tab === 'transcripts' && <ManagerTranscriptTab />}
      {tab === 'compliance_monitor' && <ComplianceMonitorTab />}
      {tab === 'compliance_my' && <MyComplianceTab />}
      {tab === 'compliance_admin' && <ComplianceAdminTab />}

      <HotCallAlertsPopup onInspectDialer={(u) => { setAutoSelectUsername(u); setTab('employees'); }} />
      <ComplianceToast onInspect={(id) => setInspectRecord(id)} />
      {inspectRecord && <ComplianceContactCard recordId={inspectRecord} onClose={() => setInspectRecord(null)} />}
    </div>
  );
}