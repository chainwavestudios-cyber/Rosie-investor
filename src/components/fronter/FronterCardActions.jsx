/**
 * FronterCardActions.jsx — Wide, text-labeled action buttons shown to the right
 * of the name in the contact card header.
 */
const btn = (color, bg, border) => ({
  background: bg, color, border: `1px solid ${border}`, borderRadius: '4px',
  padding: '5px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap',
});

export default function FronterCardActions({ status, isAdmin, credsSent, headsUpSent, headsUpSending, onHeadsUp, onCreds, onInterested, onTransferred, onBooked, onClosedDeal, onNext, onClose }) {
  const stop = (fn) => (e) => { e.stopPropagation(); fn?.(); };
  const canDisposition = status === 'prospect' || status === 'lead';
  return (
    <div onMouseDown={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <button onClick={stop(onHeadsUp)} disabled={headsUpSending} style={{ ...btn(headsUpSent ? '#4ade80' : '#ef4444', headsUpSent ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)', headsUpSent ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'), opacity: headsUpSending ? 0.5 : 1 }}>
        🚨 {headsUpSent ? 'Sent' : 'Transfer Coming'}
      </button>
      <button onClick={stop(onCreds)} style={btn('#60a5fa', 'rgba(96,165,250,0.12)', 'rgba(96,165,250,0.3)')}>
        🔑 Email Company Credentials{credsSent ? ' ✓' : ''}
      </button>
      {status === 'prospect' && (
        <button onClick={stop(onInterested)} style={btn('#10b981', 'rgba(16,185,129,0.15)', 'rgba(16,185,129,0.35)')}>✓ Interested – Requests Meeting</button>
      )}
      {canDisposition && (
        <button onClick={stop(onTransferred)} style={btn('#a78bfa', 'rgba(167,139,250,0.15)', 'rgba(167,139,250,0.35)')}>🔀 Transferred</button>
      )}
      {isAdmin && status !== 'booked' && status !== 'closed_deal' && (
        <button onClick={stop(onBooked)} style={btn('#f59e0b', 'rgba(245,158,11,0.15)', 'rgba(245,158,11,0.35)')}>📗 Booked</button>
      )}
      {isAdmin && status !== 'closed_deal' && (
        <button onClick={stop(onClosedDeal)} style={btn('#c084fc', 'rgba(192,132,252,0.12)', 'rgba(192,132,252,0.3)')}>💎 Closed Deal</button>
      )}
      {onNext && <button onClick={stop(onNext)} style={btn('#10b981', 'rgba(16,185,129,0.1)', 'rgba(16,185,129,0.3)')}>Next →</button>}
      <button onClick={stop(onClose)} title="Close" style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px', padding: '0 2px', lineHeight: 1 }}>×</button>
    </div>
  );
}