/**
 * ValidationGates.jsx — Visual showing the 3 conditions a lead must meet
 * before being transferred to DAA for the program pitch.
 */
const GOLD = '#10b981';
const DARK = '#0a0f1e';

const GATES = [
  { icon: '💰', label: '$10K+ Debt', desc: 'Verified unsecured debt amount meets minimum threshold', color: '#60a5fa' },
  { icon: '⚠️', label: 'Hardship Confirmed', desc: 'Customer describes a qualifying financial hardship', color: '#f59e0b' },
  { icon: '🆘', label: 'Seeking Relief', desc: 'Customer expresses active desire for debt relief', color: '#a78bfa' },
];

export default function ValidationGates() {
  return (
    <div style={{ background: '#0d1b2a', border: `1px solid ${GOLD}22`, borderRadius: '8px', padding: '28px 24px' }}>
      <h2 style={{ color: '#e8e0d0', fontSize: '18px', fontWeight: 'normal', margin: '0 0 6px' }}>🚦 Human Validation Gates</h2>
      <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 20px' }}>All three conditions must be verified by a human fronter before the lead is transferred to DAA for the program pitch</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {GATES.map((gate, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              background: `${gate.color}08`,
              border: `1px solid ${gate.color}44`,
              borderRadius: '8px',
              padding: '16px 18px',
              textAlign: 'center',
              minWidth: '180px',
              maxWidth: '220px',
            }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>{gate.icon}</div>
              <div style={{ color: gate.color, fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>{gate.label}</div>
              <div style={{ color: '#8a9ab8', fontSize: '10px', lineHeight: 1.4 }}>{gate.desc}</div>
            </div>
            {i < GATES.length - 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold' }}>+</div>
                <div style={{ color: '#4a5568', fontSize: '8px', letterSpacing: '1px' }}>AND</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Result arrow */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ color: '#6b7280', fontSize: '11px' }}>All 3 gates passed</div>
        <div style={{ color: GOLD, fontSize: '20px' }}>→</div>
        <div style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}44`, borderRadius: '6px', padding: '8px 18px', color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>Transfer to DAA Closer · Pitch Program</div>
      </div>
    </div>
  );
}