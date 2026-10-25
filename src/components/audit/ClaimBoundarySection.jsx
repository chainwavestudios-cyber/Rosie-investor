/**
 * ClaimBoundarySection.jsx — the declaration this document exists to support, and
 * the three claims it covers: what is held today, what is not yet proven, and the
 * separate evidence each one requires.
 */
import { C } from '@/components/superadmin/kit';
import { CLAIM_BOUNDARY } from '@/lib/systemAuditReport';

const Label = ({ children, color = C.muted }) => (
  <div style={{ color, fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', margin: '11px 0 5px' }}>{children}</div>
);

const List = ({ items, color = C.ink }) => (
  <ul style={{ margin: 0, paddingLeft: '17px' }}>
    {items.map((item, i) => (
      <li key={i} style={{ color, fontSize: '11.5px', lineHeight: 1.6, marginBottom: '4px' }}>{item}</li>
    ))}
  </ul>
);

export default function ClaimBoundarySection() {
  return (
    <div>
      <div style={{ background: 'rgba(245,158,11,0.12)', border: `1px solid ${C.warn}66`, borderLeft: `3px solid ${C.warn}`, borderRadius: '6px', padding: '14px 16px' }}>
        <div style={{ color: C.warn, fontSize: '9px', fontWeight: 'bold', letterSpacing: '1.2px', marginBottom: '7px' }}>CLAIM BOUNDARY</div>
        <div style={{ color: C.ink, fontSize: '14px', fontWeight: 'bold', lineHeight: 1.45 }}>{CLAIM_BOUNDARY.declaration}</div>
      </div>

      <div style={{ color: C.muted, fontSize: '11.5px', lineHeight: 1.65, margin: '13px 0 4px' }}>{CLAIM_BOUNDARY.reading}</div>

      {CLAIM_BOUNDARY.limbs.map((limb) => (
        <div key={limb.key} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '13px 15px', marginTop: '11px' }}>
          <div style={{ color: C.ink, fontSize: '13px', fontWeight: 'bold' }}>{limb.title}</div>
          <div style={{ color: C.muted, fontSize: '11px', fontStyle: 'italic', marginTop: '3px' }}>{limb.claim}</div>

          <Label>Evidence held today</Label>
          <div style={{ color: C.ink, fontSize: '11.5px', lineHeight: 1.65 }}>{limb.held}</div>

          <Label color={C.danger}>Not yet proven</Label>
          <List items={limb.notProven} color="#fca5a5" />

          <Label color={C.fronter}>Separate evidence required</Label>
          <List items={limb.required} color="#6ee7b7" />
        </div>
      ))}
    </div>
  );
}