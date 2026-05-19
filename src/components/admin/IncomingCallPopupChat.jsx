/**
 * IncomingCallPopupChat.jsx
 * Full-screen popup when another admin user calls via WebRTC chat voice call.
 */
export default function IncomingCallPopupChat({ from, onAnswer, onDecline }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999,
      animation: 'fadeIn 0.2s ease',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(24px) scale(0.97); opacity:0 } to { transform:translateY(0) scale(1); opacity:1 } }
        @keyframes ringPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(87,242,135,0.5), 0 24px 60px rgba(0,0,0,0.8); }
          50% { box-shadow: 0 0 0 16px rgba(87,242,135,0), 0 24px 60px rgba(0,0,0,0.8); }
        }
      `}</style>
      <div style={{
        background: '#2b2d31',
        border: '1px solid rgba(87,242,135,0.4)',
        borderRadius: '16px',
        padding: '36px 40px',
        maxWidth: '360px',
        width: '90%',
        textAlign: 'center',
        animation: 'slideUp 0.25s ease, ringPulse 1.6s ease-in-out infinite',
        fontFamily: 'sans-serif',
      }}>
        {/* Animated ring icon */}
        <div style={{ fontSize: '52px', marginBottom: '16px', lineHeight: 1, animation: 'ringPulse 1s ease-in-out infinite' }}>📲</div>

        <div style={{ color: '#57f287', fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
          Incoming Voice Call
        </div>

        <div style={{ color: '#f2f3f5', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>
          {from}
        </div>
        <div style={{ color: '#80848e', fontSize: '13px', marginBottom: '28px' }}>
          is calling you…
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={onAnswer}
            style={{ flex: 1, background: 'linear-gradient(135deg,#3ba55c,#2d7d46)', color: '#fff', border: 'none', borderRadius: '8px', padding: '13px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 16px rgba(59,165,92,0.4)' }}>
            📞 Answer
          </button>
          <button onClick={onDecline}
            style={{ flex: 1, background: 'linear-gradient(135deg,#ed4245,#b91c1c)', color: '#fff', border: 'none', borderRadius: '8px', padding: '13px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 16px rgba(237,66,69,0.4)' }}>
            📵 Decline
          </button>
        </div>
      </div>
    </div>
  );
}