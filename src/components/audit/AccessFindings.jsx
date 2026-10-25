/** AccessFindings.jsx — the data-access census and what it means for confidentiality. */
import { C } from '@/components/superadmin/kit';
import { ACCESS_FINDINGS as A } from '@/lib/systemAuditReport';

const Stat = ({ value, label, color }) => (
  <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '12px 14px' }}>
    <div style={{ color, fontSize: '24px', fontWeight: 'bold' }}>{value}</div>
    <div style={{ color: C.muted, fontSize: '10px', marginTop: '3px' }}>{label}</div>
  </div>
);

export default function AccessFindings() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: '10px', marginBottom: '14px' }}>
        <Stat value={A.reviewed} label="stored data types reviewed" color={C.ink} />
        <Stat value={A.restricted} label="restricted to administrators" color={C.fronter} />
        <Stat value={A.unrestricted} label="with no row-level restriction" color={C.danger} />
      </div>

      <div style={{ color: C.danger, fontSize: '12.5px', fontWeight: 'bold' }}>{A.headline}</div>
      <div style={{ color: C.ink, fontSize: '11.5px', lineHeight: 1.65, marginTop: '8px' }}>{A.consequence}</div>
      <div style={{ color: C.muted, fontSize: '11.5px', lineHeight: 1.65, marginTop: '8px' }}>{A.caveat}</div>

      <div style={{ color: C.muted, fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', margin: '12px 0 4px' }}>RESTRICTED TODAY</div>
      <div style={{ color: C.muted, fontSize: '11px', lineHeight: 1.6 }}>{A.restrictedNames.join(' · ')}</div>

      <div style={{ color: C.fronter, fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', margin: '12px 0 4px' }}>WHAT WOULD CLOSE THIS</div>
      <ul style={{ margin: 0, paddingLeft: '17px' }}>
        {A.remediation.map((item, i) => (
          <li key={i} style={{ color: '#6ee7b7', fontSize: '11.5px', lineHeight: 1.6, marginBottom: '4px' }}>{item}</li>
        ))}
      </ul>
    </div>
  );
}