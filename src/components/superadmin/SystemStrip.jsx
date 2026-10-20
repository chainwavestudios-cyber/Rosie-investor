/** SystemStrip.jsx — the system identity bar that keeps the two auth systems visibly separate. */
import { C } from '@/components/superadmin/kit';

export default function SystemStrip({ accent, title, loginPath, blurb, stats = [] }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px',
      background: `${accent}0f`, border: `1px solid ${accent}44`, borderLeft: `4px solid ${accent}`,
      borderRadius: '8px', padding: '10px 14px', marginBottom: '14px',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: accent, fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{title}</span>
          <span style={{ padding: '2px 7px', borderRadius: '3px', background: 'rgba(0,0,0,0.35)', color: C.muted, fontSize: '9px', letterSpacing: '0.5px' }}>auth · {loginPath}</span>
        </div>
        <div style={{ color: C.muted, fontSize: '11px', marginTop: '2px' }}>{blurb}</div>
      </div>
      <div style={{ flex: 1 }} />
      {stats.map((s) => (
        <div key={s.label} style={{ textAlign: 'right' }}>
          <div style={{ color: C.dim, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>{s.label}</div>
          <div style={{ color: s.color || accent, fontSize: '15px', fontWeight: 'bold' }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}