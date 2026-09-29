/**
 * ComplianceToast.jsx — Real-time popup toast for compliance alerts.
 * Listens for compliance alerts and shows a notification with "Inspect Call" button.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { isComplianceManager } from '@/lib/complianceRoles';

export default function ComplianceToast({ onInspect }) {
  const { user } = useDebtCoachAuth();
  const [alerts, setAlerts] = useState([]);
  const [seenIds, setSeenIds] = useState(new Set());

  useEffect(() => {
    if (!user || !isComplianceManager(user.role)) return;
    const poll = async () => {
      try {
        const res = await base44.functions.invoke('complianceAdmin', { action: 'getRecords', status: 'OPEN' });
        const data = res?.data || res;
        const openRecords = (data.records || []).filter(r => {
          const ageMin = (Date.now() - new Date(r.created_date).getTime()) / 60000;
          return ageMin < 5 && !seenIds.has(r.id);
        });
        if (openRecords.length > 0) {
          setAlerts(prev => [...prev, ...openRecords.map(r => ({ id: r.id, complianceId: r.complianceId, username: r.username, score: r.complianceScore, violations: r.violationsCount, leadName: r.leadName }))]);
          setSeenIds(prev => { const next = new Set(prev); openRecords.forEach(r => next.add(r.id)); return next; });
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [user, seenIds]);

  const dismiss = (id) => setAlerts(prev => prev.filter(a => a.id !== id));

  if (alerts.length === 0) return null;

  return (
    <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 10001, display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '380px' }}>
      {alerts.map(a => (
        <div key={a.id} style={{ background: '#0d1b2a', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', padding: '14px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', animation: 'slideIn 0.3s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ color: '#ef4444', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🛡 Compliance Alert</div>
            <button onClick={() => dismiss(a.id)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}>×</button>
          </div>
          <div style={{ color: '#e8e0d0', fontSize: '13px', marginBottom: '4px' }}>
            <strong>{a.complianceId}</strong> — Dialer: <strong>{a.username}</strong>
          </div>
          <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '8px' }}>
            Score: {a.score}% · {a.violations} violation(s){a.leadName ? ` · Lead: ${a.leadName}` : ''}
          </div>
          <button onClick={() => { onInspect?.(a.id); dismiss(a.id); }} style={{ width: '100%', background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Inspect Call →</button>
        </div>
      ))}
    </div>
  );
}