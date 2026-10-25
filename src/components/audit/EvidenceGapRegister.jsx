/** EvidenceGapRegister.jsx — the numbered gaps standing between the systems as built and a claim that may be relied upon. */
import { C } from '@/components/superadmin/kit';
import { GAPS } from '@/lib/systemAuditReport';

export default function EvidenceGapRegister() {
  return (
    <div>
      {GAPS.map((gap) => (
        <div key={gap.id} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ color: C.dim, fontSize: '10px', fontWeight: 'bold', minWidth: '34px' }}>{gap.id}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: C.ink, fontSize: '12px', fontWeight: 'bold' }}>{gap.gap}</div>
            <div style={{ color: C.muted, fontSize: '11px', lineHeight: 1.6, marginTop: '3px' }}>{gap.why}</div>
            <div style={{ color: C.fronter, fontSize: '11px', lineHeight: 1.5, marginTop: '4px' }}>Closes with: {gap.closesWith}</div>
          </div>
        </div>
      ))}
    </div>
  );
}