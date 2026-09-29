/**
 * EmployeeComplianceTab.jsx — Compliance tab embedded inside an Employee Contact Card.
 * SuperManager/Admin/SuperAdmin only (not Manager).
 * - Toggle compliance AI on/off for this user
 * - When ON + user on a call: live transcript + mini compliance data (issues, compliant hooks, score)
 * - Run a compliance report across any date range using saved transcripts
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { canMonitor } from '@/lib/complianceRoles';
import ComplianceContactCard from '@/components/compliance/ComplianceContactCard';

const GOLD = '#10b981';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function EmployeeComplianceTab({ employee, session, monitorRole }) {
  const { user } = useDebtCoachAuth();
  const [settings, setSettings] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [liveLead, setLiveLead] = useState(null);
  const [liveRecords, setLiveRecords] = useState([]);
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [reportRecords, setReportRecords] = useState([]);
  const [runningReport, setRunningReport] = useState(false);
  const [openRecord, setOpenRecord] = useState(null);

  const canToggle = canMonitor(monitorRole, employee.role);

  // Load compliance settings for this user
  const loadSettings = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('complianceAdmin', { action: 'listUsers' });
      const data = res?.data || res;
      const found = (data.users || []).find(u => u.id === employee.id);
      setSettings(found ? { complianceEnabled: found.complianceEnabled, sensitivity: found.sensitivity } : { complianceEnabled: false, sensitivity: 'balanced' });
    } catch { setSettings({ complianceEnabled: false, sensitivity: 'balanced' }); }
  }, [employee.id]);

  // Load live call transcript + open compliance records when compliance is ON and user is on a call
  const loadLive = useCallback(async () => {
    if (!settings?.complianceEnabled || session?.status !== 'on_call' || !session.currentCallLeadId) { setLiveLead(null); setLiveRecords([]); return; }
    try {
      const lead = await base44.entities.DebtLead.get(session.currentCallLeadId);
      setLiveLead(lead);
      const res = await base44.functions.invoke('complianceAdmin', { action: 'getRecords', targetUsername: employee.username, status: 'OPEN' });
      setLiveRecords((res?.data || res).records || []);
    } catch { setLiveLead(null); setLiveRecords([]); }
  }, [settings?.complianceEnabled, session?.status, session?.currentCallLeadId, employee.username]);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => {
    loadLive();
    if (!settings?.complianceEnabled || session?.status !== 'on_call') return;
    const interval = setInterval(loadLive, 5000);
    return () => clearInterval(interval);
  }, [loadLive, settings?.complianceEnabled, session?.status]);

  const toggleCompliance = async () => {
    if (!canToggle) return;
    setToggling(true);
    try {
      await base44.functions.invoke('complianceAdmin', {
        action: 'updateSettings',
        targetUserId: employee.id, targetUsername: employee.username, targetRole: employee.role,
        isEnabled: !settings.complianceEnabled,
        sensitivityLevel: settings.sensitivity || 'balanced',
      });
      loadSettings();
    } catch {}
    setToggling(false);
  };

  const runReport = async () => {
    setRunningReport(true);
    try {
      const res = await base44.functions.invoke('complianceAdmin', {
        action: 'getRecords', targetUsername: employee.username,
        dateFrom: reportFrom || undefined, dateTo: reportTo || undefined,
      });
      setReportRecords((res?.data || res).records || []);
    } catch { setReportRecords([]); }
    setRunningReport(false);
  };

  if (!settings) return <div style={{ color: '#6b7280', textAlign: 'center', padding: '30px' }}>Loading compliance settings…</div>;

  const liveLines = (() => { try { return JSON.parse(liveLead?.transcriptJson || '[]'); } catch { return []; } })();

  return (
    <div>
      {/* Toggle */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '14px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>🛡 Live Compliance AI</div>
          <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>
            {settings.complianceEnabled ? 'Monitoring active calls in real time via transcripts.' : 'Compliance AI is OFF for this user.'}
          </div>
        </div>
        {canToggle ? (
          <button onClick={toggleCompliance} disabled={toggling} style={{ padding: '8px 18px', borderRadius: '4px', border: `1px solid ${settings.complianceEnabled ? 'rgba(239,68,68,0.3)' : GOLD + '44'}`, background: settings.complianceEnabled ? 'rgba(239,68,68,0.1)' : `${GOLD}18`, color: settings.complianceEnabled ? '#ef4444' : GOLD, cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: toggling ? 0.5 : 1 }}>
            {toggling ? '⏳' : settings.complianceEnabled ? 'Turn OFF' : 'Turn ON'}
          </button>
        ) : (
          <span style={{ color: '#6b7280', fontSize: '11px' }}>Only a higher role can toggle this.</span>
        )}
      </div>

      {/* Live call view */}
      {settings.complianceEnabled && session?.status === 'on_call' && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>🔴 Live Call — {session.currentCallLeadName || 'Unknown'}</div>
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', overflow: 'hidden' }}>
            {/* Mini data */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'rgba(255,255,255,0.04)' }}>
              <MiniStat label="Open Issues" value={liveRecords.reduce((s, r) => s + (r.violationsCount || 0), 0)} color="#ef4444" />
              <MiniStat label="Compliant Hooks" value={liveRecords.reduce((s, r) => s + (r.compliantHooks || 0), 0)} color="#4ade80" />
              <MiniStat label="Open IDs" value={liveRecords.length} color="#f59e0b" />
              <MiniStat label="Live Score" value={liveRecords.length ? `${Math.round(liveRecords.reduce((s, r) => s + (r.complianceScore || 0), 0) / liveRecords.length)}%` : '—'} color="#60a5fa" />
            </div>
            {/* Live transcript */}
            <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '10px 14px' }}>
              {liveLines.length === 0 ? <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px', fontSize: '12px' }}>Waiting for transcript…</div> : liveLines.slice(-30).map((msg, j) => {
                const isAgent = msg.speaker === 0;
                return (
                  <div key={j} style={{ marginBottom: '4px', display: 'flex', gap: '8px' }}>
                    <span style={{ color: isAgent ? '#60a5fa' : '#10b981', fontSize: '10px', fontWeight: 'bold', flexShrink: 0, minWidth: '60px' }}>{isAgent ? 'Agent' : 'Customer'}</span>
                    <span style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.4 }}>{msg.text}</span>
                  </div>
                );
              })}
            </div>
            {liveRecords.length > 0 && (
              <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {liveRecords.map(r => (
                  <button key={r.id} onClick={() => setOpenRecord(r.id)} style={{ width: '100%', background: 'none', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer', textAlign: 'left', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 'bold' }}>{r.complianceId}</span>
                    <span style={{ color: '#6b7280', fontSize: '10px' }}>{r.violationsCount || 0} violations · {r.complianceScore || '—'}%</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Date-range report */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '14px 16px' }}>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>📊 Compliance Report by Date Range</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div><label style={ls}>From</label><input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} style={{ ...inp, width: 'auto' }} /></div>
          <div><label style={ls}>To</label><input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} style={{ ...inp, width: 'auto' }} /></div>
          <div style={{ alignSelf: 'flex-end' }}><button onClick={runReport} disabled={runningReport} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: runningReport ? 0.5 : 1 }}>{runningReport ? '⏳ Running…' : 'Run Report'}</button></div>
        </div>
        {reportRecords.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {reportRecords.map(r => {
              const sc = { OPEN: '#ef4444', UNDER_REVIEW: '#f59e0b', REMEDIED: '#60a5fa', CLOSED: '#6b7280' }[r.status] || '#6b7280';
              return (
                <button key={r.id} onClick={() => setOpenRecord(r.id)} style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: `1px solid ${sc}22`, borderRadius: '4px', padding: '10px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{r.complianceId}</span>
                    <span style={{ marginLeft: '8px', padding: '1px 6px', borderRadius: '2px', background: `${sc}18`, color: sc, fontSize: '9px', textTransform: 'uppercase' }}>{r.status.replace('_', ' ')}</span>
                    <div style={{ color: '#6b7280', fontSize: '10px' }}>{new Date(r.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{r.leadName ? ` · ${r.leadName}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', textAlign: 'center' }}>
                    <div><div style={{ color: r.complianceScore >= 80 ? '#4ade80' : '#ef4444', fontSize: '14px', fontWeight: 'bold' }}>{r.complianceScore ?? '—'}%</div><div style={{ color: '#6b7280', fontSize: '8px' }}>Score</div></div>
                    <div><div style={{ color: '#ef4444', fontSize: '14px', fontWeight: 'bold' }}>{r.violationsCount || 0}</div><div style={{ color: '#6b7280', fontSize: '8px' }}>Violations</div></div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {reportRecords.length === 0 && reportFrom && <div style={{ color: '#4a5568', textAlign: 'center', padding: '16px', fontSize: '12px' }}>Run a report to see compliance records for this user.</div>}
      </div>

      {openRecord && <ComplianceContactCard recordId={openRecord} onClose={() => { setOpenRecord(null); loadLive(); runReport(); }} />}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: '#0d1b2a', padding: '10px', textAlign: 'center' }}>
      <div style={{ color, fontSize: '16px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    </div>
  );
}