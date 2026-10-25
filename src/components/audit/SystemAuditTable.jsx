/** SystemAuditTable.jsx — every system in scope, the evidence held for it, and its status mark. */
import { C, chip } from '@/components/superadmin/kit';
import { SYSTEMS, STATUS_META } from '@/lib/systemAuditReport';

const TONE = { ok: C.fronter, warn: C.warn, bad: C.danger };

export default function SystemAuditTable() {
  return (
    <div>
      {SYSTEMS.map((row, index) => {
        const meta = STATUS_META[row.status];
        const tone = TONE[meta.tone] || C.muted;
        return (
          <div key={row.key} style={{ borderBottom: `1px solid ${C.border}`, padding: '11px 0' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: C.dim, fontSize: '10px', fontWeight: 'bold' }}>{String(index + 1).padStart(2, '0')}</span>
              <span style={{ color: C.ink, fontSize: '12.5px', fontWeight: 'bold' }}>{row.system}</span>
              <span style={chip(tone)}>{meta.label}</span>
            </div>
            <div style={{ color: C.muted, fontSize: '11px', lineHeight: 1.6, margin: '5px 0 0 22px' }}>{row.purpose}</div>
            <div style={{ color: C.ink, fontSize: '11px', lineHeight: 1.6, margin: '4px 0 0 22px' }}>
              <span style={{ color: C.dim }}>Evidence held today: </span>{row.evidence}
            </div>
            {row.note && (
              <div style={{ color: C.warn, fontSize: '11px', lineHeight: 1.6, margin: '4px 0 0 22px' }}>Gap: {row.note}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}