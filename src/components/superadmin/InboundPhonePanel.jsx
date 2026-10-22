/**
 * InboundPhonePanel.jsx — the floating handset's panel.
 *
 * Presentation only: idle chip, incoming-call card with the Answer button, and
 * the in-call controls. The device lives in FloatingInboundPhone.
 */
import { C } from '@/components/superadmin/kit';

const RED = C.danger;
const GREEN = C.fronter;
const AMBER = C.warn;

const btn = (color, solid) => ({
  background: solid ? color : `${color}1a`,
  color: solid ? '#06121f' : color,
  border: `1px solid ${color}55`,
  borderRadius: '4px', padding: '8px 13px', cursor: 'pointer',
  fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap',
});

const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

export default function InboundPhonePanel({
  open, status, from, duration, muted, error,
  onAnswer, onDecline, onHangUp, onToggleMute, onToggle,
}) {
  const ringing = status === 'ringing';
  const active = status === 'connected';
  const tone = active ? GREEN : ringing ? AMBER : C.muted;

  if (!open && !ringing && !active) {
    return (
      <button onClick={onToggle} title="Inbound phone" style={{
        display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer',
        background: 'rgba(13,27,42,0.95)', border: `1px solid ${C.border}`,
        borderRadius: '24px', padding: '10px 16px', color: C.ink,
        fontFamily: 'Georgia, serif', boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
      }}>
        <span style={{ fontSize: '15px' }}>📞</span>
        <span style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', color: C.muted }}>
          Inbound line
        </span>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: error ? RED : GREEN }} />
      </button>
    );
  }

  return (
    <div style={{
      width: '278px', background: 'rgba(13,27,42,0.97)', border: `1px solid ${tone}55`,
      borderRadius: '8px', padding: '14px', color: C.ink, fontFamily: 'Georgia, serif',
      boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: ringing || active ? '10px' : '6px' }}>
        <span style={{
          width: 9, height: 9, borderRadius: '50%', background: tone,
          animation: ringing || active ? 'pulse-green 1s infinite' : 'none',
        }} />
        <span style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', color: tone }}>
          {active ? 'In call' : ringing ? 'Incoming call' : 'Inbound line ready'}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={onToggle} title="Minimize" style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: '13px' }}>▾</button>
      </div>

      {ringing && (
        <>
          <div style={{ color: C.ink, fontSize: '17px', fontWeight: 'bold', marginBottom: '2px' }}>{from || 'Unknown caller'}</div>
          <div style={{ color: C.muted, fontSize: '11px', marginBottom: '12px' }}>
            Answer now — the AI agent takes the call on the third ring.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onAnswer} style={{ ...btn(GREEN, true), flex: 1 }}>📞 Answer</button>
            <button onClick={onDecline} style={btn(RED, false)}>✖ Decline</button>
          </div>
        </>
      )}

      {active && (
        <>
          <div style={{ color: C.ink, fontSize: '17px', fontWeight: 'bold', marginBottom: '2px' }}>{from || 'Caller'}</div>
          <div style={{ color: GREEN, fontSize: '15px', fontFamily: 'monospace', fontWeight: 'bold', marginBottom: '12px' }}>{fmt(duration)}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onToggleMute} style={btn(muted ? RED : '#c4cdd8', false)}>{muted ? '🔇 Unmute' : '🎤 Mute'}</button>
            <button onClick={onHangUp} style={btn(RED, true)}>📵 Hang up</button>
          </div>
        </>
      )}

      {!ringing && !active && (
        <div style={{ color: C.muted, fontSize: '11px', lineHeight: 1.5 }}>
          Calls to the toll-free line ring here first — two rings, then the AI agent answers.
          {error ? <div style={{ color: RED, marginTop: '6px' }}>{error}</div> : null}
        </div>
      )}
    </div>
  );
}