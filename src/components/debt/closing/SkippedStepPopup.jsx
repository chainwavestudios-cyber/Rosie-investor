/**
 * SkippedStepPopup.jsx — Popup shown when Smart Close detects a skipped or
 * incomplete closing step. The agent can:
 *   • Ignore   — dismiss this skip (won't be shown again)
 *   • Save     — record the skip to the lead's activity log (audit trail)
 *   • Complete — confirm the step was actually done (requires confirmation)
 */
const GOLD = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';

export default function SkippedStepPopup({ skip, onIgnore, onSave, onConfirm }) {
  if (!skip) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#0d1b2a', border: `1px solid ${AMBER}55`, borderRadius: '8px', maxWidth: '460px', width: '100%', boxShadow: '0 16px 64px rgba(0,0,0,0.8)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <div style={{ color: AMBER, fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Smart Close — Step Skipped</div>
            <div style={{ color: '#6b7280', fontSize: '10px' }}>A closing step may have been missed.</div>
          </div>
        </div>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>{skip.label || skip.key}</div>
          <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5, background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '10px 12px', marginBottom: '14px' }}>
            {skip.reason || 'This step was not detected in the transcript and may be incomplete.'}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => onIgnore(skip.key)} style={{ flex: 1, background: 'rgba(107,114,128,0.12)', color: '#8a9ab8', border: '1px solid rgba(107,114,128,0.25)', borderRadius: '4px', padding: '9px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Ignore</button>
            <button onClick={() => onSave(skip)} style={{ flex: 1, background: 'rgba(245,158,11,0.12)', color: AMBER, border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '9px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Save Note</button>
            <button onClick={() => onConfirm(skip)} style={{ flex: 1, background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '9px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✓ Complete</button>
          </div>
        </div>
      </div>
    </div>
  );
}