/**
 * IntentReportModal.jsx — post-call Intent Report + next-call playbook.
 * Pops up automatically the next time the client profile is opened after a call,
 * and reads word-for-word from the intent engine.
 */
import { useState } from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function IntentReportModal({ report, callDate, leadName, onAcknowledge, onDismiss }) {
  const [acknowledging, setAcknowledging] = useState(false);

  const handleAck = async () => {
    if (acknowledging) return;
    setAcknowledging(true);
    await onAcknowledge?.();
    setAcknowledging(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9600, background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: '860px', maxHeight: '88vh', background: DARK,
        border: `1px solid ${GOLD}55`, borderRadius: '8px', display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 64px rgba(0,0,0,0.85)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>🎯 Intent Report — Next Call Playbook</div>
            <div style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold' }}>{leadName || 'Client'}</div>
          </div>
          <div style={{ color: '#6b7280', fontSize: '11px' }}>
            {callDate ? new Date(callDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
          </div>
        </div>

        <div style={{ padding: '8px 20px', background: 'rgba(16,185,129,0.08)', borderBottom: '1px solid rgba(16,185,129,0.2)', flexShrink: 0 }}>
          <div style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⚠️ Read this before you dial them back</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.75, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>{report}</div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
          <button onClick={onDismiss} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
            Not yet
          </button>
          <button onClick={handleAck} disabled={acknowledging} style={{ background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: DARK, border: 'none', borderRadius: '4px', padding: '10px 22px', cursor: acknowledging ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: acknowledging ? 0.6 : 1 }}>
            {acknowledging ? '⏳ Saving…' : '✅ Yes — Save & Close'}
          </button>
        </div>
      </div>
    </div>
  );
}