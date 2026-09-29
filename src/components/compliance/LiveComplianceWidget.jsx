/**
 * LiveComplianceWidget.jsx — Real-time compliance scorecard for live calls.
 * Displays current score, compliant hooks, and violation count.
 * Polls the compliance engine for live updates.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';

export default function LiveComplianceWidget({ username, isActive }) {
  const [score, setScore] = useState(100);
  const [violations, setViolations] = useState(0);
  const [critical, setCritical] = useState(0);
  const [compliantHooks, setCompliantHooks] = useState(0);
  const [lastRecord, setLastRecord] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const pollRef = useRef(null);

  // Poll for live compliance score
  useEffect(() => {
    if (!isActive || !username) return;
    const poll = async () => {
      try {
        const res = await base44.functions.invoke('complianceEngine', { action: 'getLiveScore', username });
        const data = res?.data || res;
        setScore(data.score ?? 100);
        setViolations(data.violations || 0);
        setCritical(data.critical || 0);
        setCompliantHooks(prev => prev);
        setLastRecord(data.record);
      } catch {}
    };
    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isActive, username]);

  const scoreColor = score >= 80 ? '#4ade80' : score >= 60 ? '#f59e0b' : '#ef4444';

  if (!isActive) return null;

  return (
    <div style={{ background: '#0d1b2a', border: `1px solid ${scoreColor}33`, borderRadius: '6px', padding: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>🛡 Live Compliance</div>
        {evaluating && <span style={{ color: '#6b7280', fontSize: '10px' }}>⏳ Evaluating…</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: scoreColor, fontSize: '24px', fontWeight: 'bold' }}>{score}%</div>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Score</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#60a5fa', fontSize: '24px', fontWeight: 'bold' }}>{compliantHooks}</div>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Hooks</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#ef4444', fontSize: '24px', fontWeight: 'bold' }}>{violations}</div>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Violations</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: critical > 0 ? '#ef4444' : '#6b7280', fontSize: '24px', fontWeight: 'bold' }}>{critical}</div>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Critical</div>
        </div>
      </div>
      {/* Score bar */}
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: scoreColor, borderRadius: '3px', transition: 'width 0.5s' }} />
      </div>
      {lastRecord && (
        <div style={{ marginTop: '8px', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', color: '#ef4444', fontSize: '11px' }}>
          ⚠ {lastRecord.complianceId} — {violations} violation(s) detected
        </div>
      )}
    </div>
  );
}