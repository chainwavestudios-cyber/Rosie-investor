const GOLD = '#b8933a';
const DARK = '#0a0f1e';

export default function ZoomBookingModal({ isOpen, onClose, buttonLabel = 'Book Zoom' }) {
  if (!isOpen) return null;

  const zoomUrl = 'https://scheduler.zoom.us/stephani-sterling';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
      <div style={{ background: '#0d1b2a', border: `1px solid rgba(184,147,58,0.3)`, borderRadius: '4px', padding: '44px', maxWidth: '520px', width: '100%', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '44px', marginBottom: '12px' }}>📅</div>
          <h3 style={{ color: GOLD, margin: '0 0 8px', fontFamily: 'Georgia, serif', fontWeight: 'normal', fontSize: '20px' }}>{buttonLabel}</h3>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>Schedule a meeting with our team</p>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '24px', marginBottom: '28px', textAlign: 'center' }}>
          <p style={{ color: '#8a9ab8', fontSize: '13px', lineHeight: 1.7, margin: '0 0 16px' }}>You will be redirected to our scheduling calendar. Choose your preferred date and time.</p>
          <a href={zoomUrl} target="_blank" rel="noopener noreferrer" style={{ color: GOLD, fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}>{zoomUrl}</a>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <a href={zoomUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, background: `linear-gradient(135deg,${GOLD},#d4aa50)`, color: DARK, border: 'none', borderRadius: '4px', padding: '14px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', letterSpacing: '2.5px', textTransform: 'uppercase', textDecoration: 'none', display: 'block', textAlign: 'center' }}>
            Open Calendar
          </a>
          <button onClick={onClose} style={{ padding: '14px 20px', background: 'transparent', color: '#6b7280', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}