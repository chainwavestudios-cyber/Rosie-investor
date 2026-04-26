const GOLD = '#b8933a';
const DARK = '#0a0f1e';

export default function ZoomBookingModal({ isOpen, onClose, buttonLabel = 'Book a Call', zoomUrl }) {
  if (!isOpen) return null;

  // Always use Calendly for investor portal bookings
  const calendlyUrl = 'https://calendly.com/investors-rosieai';

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'16px' }}>
      <div style={{ background:'#0d1b2a', border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'4px', width:'100%', maxWidth:'760px', height:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 40px 100px rgba(0,0,0,0.9)' }}>

        {/* Header */}
        <div style={{ padding:'16px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ color:GOLD, fontSize:'13px', fontWeight:'bold', letterSpacing:'1px' }}>📅 Schedule a Call</div>
            <div style={{ color:'#6b7280', fontSize:'11px', marginTop:'2px' }}>Choose a time that works for you</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'22px', lineHeight:1 }}>×</button>
        </div>

        {/* Calendly iframe */}
        <iframe
          src={calendlyUrl}
          style={{ flex:1, border:'none', borderRadius:'0 0 4px 4px', background:'#fff' }}
          title="Schedule a Call"
        />
      </div>
    </div>
  );
}