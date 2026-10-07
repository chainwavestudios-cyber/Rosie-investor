/**
 * ObjectionPopup — blocking modal shown during a live call when a high-priority
 * objection is detected. Displays the customer's words, the objection mindset/goal,
 * and the exact response text for the agent to read. Brought front-and-center.
 */
import { useState } from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';

export default function ObjectionPopup({ objection, onDismiss }) {
  const [copied, setCopied] = useState(false);
  if (!objection) return null;

  const copy = () => {
    navigator.clipboard?.writeText(objection.responseText || '').then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onDismiss}>
      <div onClick={e => e.stopPropagation()} style={{ background: DARK, border: `2px solid ${GOLD}`, borderRadius: '10px', maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 80px rgba(0,0,0,0.9)', animation: 'pulse 2s infinite' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${GOLD}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `${GOLD}10` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🛡️</span>
            <div>
              <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>OBJECTION DETECTED</div>
              <div style={{ color: '#e8e0d0', fontSize: '14px' }}>{objection.title}</div>
            </div>
          </div>
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '26px', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>

        {/* Customer said */}
        {objection.lineText && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(239,68,68,0.06)' }}>
            <div style={{ color: RED, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>🗣️ Customer said</div>
            <div style={{ color: '#c4cdd8', fontSize: '13px', fontStyle: 'italic' }}>"{objection.lineText}"</div>
          </div>
        )}

        {/* Mindset + Goal */}
        {(objection.mindset || objection.goal) && (
          <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '20px', fontSize: '11px', flexWrap: 'wrap' }}>
            {objection.mindset && <div style={{ flex: 1, minWidth: '200px' }}><span style={{ color: '#8a9ab8', fontWeight: 'bold' }}>Mindset: </span><span style={{ color: '#c4cdd8' }}>{objection.mindset}</span></div>}
            {objection.goal && <div style={{ flex: 1, minWidth: '200px' }}><span style={{ color: '#8a9ab8', fontWeight: 'bold' }}>Goal: </span><span style={{ color: '#c4cdd8' }}>{objection.goal}</span></div>}
          </div>
        )}

        {/* Response — the main content */}
        <div style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>💬 Read this response</div>
            <button onClick={copy} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>{copied ? '✓ Copied' : '📋 Copy'}</button>
          </div>
          <div style={{ color: '#e8e0d0', fontSize: '15px', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '16px', border: `1px solid ${GOLD}22` }}>
            {objection.responseText}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onDismiss} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '6px', padding: '10px 28px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Got it ✓</button>
        </div>
      </div>
    </div>
  );
}