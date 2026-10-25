/** AuditSection.jsx — the numbered section shell every part of the evidence review sits in. */
import { C } from '@/components/superadmin/kit';

export default function AuditSection({ num, title, note, children }) {
  return (
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '15px 17px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
        <span style={{ color: C.warn, fontSize: '11px', fontWeight: 'bold' }}>{num}</span>
        <div style={{ color: C.ink, fontSize: '14px', fontWeight: 'bold' }}>{title}</div>
      </div>
      {note && <div style={{ color: C.muted, fontSize: '11px', margin: '4px 0 13px' }}>{note}</div>}
      <div style={{ marginTop: note ? 0 : '13px' }}>{children}</div>
    </section>
  );
}