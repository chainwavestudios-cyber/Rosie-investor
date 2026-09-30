/**
 * HotCallAlertsPopup.jsx — Surfaces live hot-call alerts to managers.
 * Polls HotCallAlert for active (hot/critical) alerts and shows a prominent,
 * flashing popup. Critical alerts (hot call + agent underperforming) flash
 * red. "Monitor This Call" jumps to the Employees tab with that dialer
 * pre-selected, where Listen / Whisper / Barge / Takeover are available.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';

export default function HotCallAlertsPopup({ onInspectDialer }) {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState({});

  useEffect(() => {
    const poll = async () => {
      try {
        const rows = await base44.entities.HotCallAlert.list('-created_date', 50);
        const active = (rows || []).filter(a => a.status === 'hot' || a.status === 'critical');
        setAlerts(active);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 4000);
    return () => clearInterval(iv);
  }, []);

  // Auto-undismiss if an alert re-escalates (e.g., hot → critical)
  useEffect(() => {
    setDismissed(prev => {
      const next = { ...prev };
      for (const a of alerts) {
        if (a.status === 'critical' && next[a.id]) delete next[a.id];
      }
      return next;
    });
  }, [alerts]);

  const visible = alerts.filter(a => !dismissed[a.id]);
  if (visible.length === 0) return null;

  // Critical alerts first
  visible.sort((a, b) => (b.status === 'critical' ? 1 : 0) - (a.status === 'critical' ? 1 : 0));

  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9500, display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '380px' }}>
      {visible.map(a => {
        const critical = a.status === 'critical';
        const issues = (() => { try { return JSON.parse(a.agentIssuesJson || '[]'); } catch { return []; } })();
        return (
          <div key={a.id} style={{
            background: '#0d1b2a',
            border: `2px solid ${critical ? RED : AMBER}`,
            borderRadius: '8px',
            boxShadow: `0 8px 24px ${critical ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.3)'}`,
            overflow: 'hidden',
            animation: critical ? 'hotpulse 1s infinite' : 'none',
          }}>
            <div style={{
              padding: '10px 14px',
              background: critical ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.15)',
              borderBottom: `1px solid ${critical ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ color: critical ? RED : AMBER, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {critical ? '🚨 CRITICAL — HOT CALL, AGENT STRUGGLING' : '🔥 HOT CALL DETECTED'}
              </span>
              <button onClick={() => setDismissed(p => ({ ...p, [a.id]: true }))} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '14px' }}>✕</button>
            </div>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>👤 {a.dialerUsername}</span>
                <span style={{ color: '#8a9ab8', fontSize: '12px' }}>→ {a.leadName || 'Unknown lead'}</span>
                <span style={{ padding: '1px 6px', borderRadius: '2px', background: a.callMode === 'close' ? 'rgba(16,185,129,0.15)' : 'rgba(96,165,250,0.15)', color: a.callMode === 'close' ? GOLD : '#60a5fa', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{a.callMode || 'open'}</span>
              </div>
              <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5, marginBottom: '8px' }}>
                <span style={{ color: AMBER, fontWeight: 'bold' }}>Hot {a.hotScore ?? '—'}/100:</span> {a.hotReason || 'Genuine interest detected.'}
              </div>
              {critical && (
                <div style={{ marginBottom: '8px', padding: '8px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '4px' }}>
                  <div style={{ color: RED, fontSize: '11px', fontWeight: 'bold', marginBottom: '3px' }}>⚠ Agent performance: {a.agentScore ?? '—'}/100</div>
                  {a.agentSummary && <div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.4, marginBottom: issues.length ? '4px' : 0 }}>{a.agentSummary}</div>}
                  {issues.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {issues.map((iss, i) => (
                        <span key={i} style={{ padding: '1px 6px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '2px', color: '#fca5a5', fontSize: '10px' }}>{iss}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => onInspectDialer?.(a.dialerUsername)}
                  style={{ flex: 1, background: critical ? 'linear-gradient(135deg,#ef4444,#f97316)' : 'linear-gradient(135deg,#f59e0b,#f97316)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}
                >
                  {critical ? '⚡ Monitor / Take Over' : '🎧 Monitor This Call'}
                </button>
                <button onClick={() => setDismissed(p => ({ ...p, [a.id]: true }))} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer', fontSize: '11px' }}>Dismiss</button>
              </div>
            </div>
          </div>
        );
      })}
      <style>{`@keyframes hotpulse{0%,100%{box-shadow:0 8px 24px rgba(239,68,68,0.4)}50%{box-shadow:0 8px 32px rgba(239,68,68,0.8)}}`}</style>
    </div>
  );
}