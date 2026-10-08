/**
 * CompliancePortal.jsx — Main compliance page with role-based tabs.
 * Dialer/Manager: My Compliance only.
 * SuperManager: Monitor + My Compliance.
 * Admin/SuperAdmin: Monitor + Admin + My Compliance.
 */
import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { isComplianceManager, isComplianceAdmin } from '@/lib/complianceRoles';
import MyComplianceTab from '@/components/compliance/MyComplianceTab';
import ComplianceMonitorTab from '@/components/compliance/ComplianceMonitorTab';
import ComplianceAdminTab from '@/components/compliance/ComplianceAdminTab';
import ComplianceToast from '@/components/compliance/ComplianceToast';
import ComplianceContactCard from '@/components/compliance/ComplianceContactCard';

const GOLD = '#10b981';

export default function CompliancePortal({ onBack }) {
  const { user, logout, isAuthenticated, loading, isFronter } = useDebtCoachAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('my');
  useEffect(() => { if (isFronter) navigate('/fronter', { replace: true }); }, [isFronter, navigate]);
  const [inspectRecord, setInspectRecord] = useState(null);

  if (loading) return <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/debt-call-coach-login" replace />;

  const canMonitor = isComplianceManager(user?.role);
  const canAdmin = isComplianceAdmin(user?.role);

  const TABS = [
    { id: 'my', label: '🛡 My Compliance' },
    ...(canMonitor ? [{ id: 'monitor', label: '👥 Monitor' }] : []),
    ...(canAdmin ? [{ id: 'admin', label: '⚙️ Admin' }] : []),
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', color: '#e8e0d0', padding: '20px 30px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ color: GOLD, fontSize: '22px' }}>🛡</span>
            <div>
              <div style={{ color: '#e8e0d0', fontSize: '20px', fontWeight: 'bold' }}>Compliance Portal</div>
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>Script Fidelity · Regulatory Rules · Factual Accuracy</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{user?.username}</div>
            <div style={{ color: GOLD, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>{user?.role?.replace('_', ' ')}</div>
          </div>
          {onBack && <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.05)', color: '#c4cdd8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px' }}>← Back to Coach</button>}
          <button onClick={logout} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px' }}>Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '12px 20px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? GOLD : 'transparent'}`, color: tab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: tab === t.id ? 'bold' : 'normal' }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      {tab === 'my' && <MyComplianceTab />}
      {tab === 'monitor' && <ComplianceMonitorTab />}
      {tab === 'admin' && <ComplianceAdminTab />}

      {/* Real-time toast */}
      <ComplianceToast onInspect={(id) => setInspectRecord(id)} />
      {inspectRecord && <ComplianceContactCard recordId={inspectRecord} onClose={() => setInspectRecord(null)} />}
    </div>
  );
}