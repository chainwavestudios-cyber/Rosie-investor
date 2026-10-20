/**
 * SkippedStepsNotice.jsx — Inline (non-modal) list of the closing steps Smart
 * Close thinks were skipped or left incomplete. Each step can be Ignored,
 * saved as a note, or confirmed complete right here, so nothing ever covers the
 * live call.
 */
const AMBER = '#f59e0b';

const btn = (color, bg, border) => ({
  background: bg, color, border: `1px solid ${border}`, borderRadius: '4px',
  padding: '6px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold',
  letterSpacing: '0.5px', textTransform: 'uppercase',
});

export default function SkippedStepsNotice({ skips, onIgnore, onSave, onConfirm }) {
  if (!skips?.length) return null;
  return (
    <div style={{ marginBottom: '12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontSize: '14px' }}>⚠️</span>
        <span style={{ color: AMBER, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold' }}>
          Smart Close — {skips.length} step{skips.length > 1 ? 's' : ''} skipped
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {skips.map((skip) => (
          <div key={skip.key} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '10px 12px' }}>
            <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{skip.label || skip.key}</div>
            <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.45, marginBottom: '8px' }}>
              {skip.reason || 'Not detected in the transcript — may be incomplete.'}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button onClick={() => onIgnore(skip.key)} style={btn('#8a9ab8', 'rgba(107,114,128,0.12)', 'rgba(107,114,128,0.25)')}>Ignore</button>
              <button onClick={() => onSave(skip)} style={btn(AMBER, 'rgba(245,158,11,0.12)', 'rgba(245,158,11,0.3)')}>Save Note</button>
              <button onClick={() => onConfirm(skip)} style={btn('#0a0f1e', 'linear-gradient(135deg,#10b981,#22c55e)', 'transparent')}>✓ Complete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}