const GOLD = '#10b981';
const MUTED = '#8a9ab8';

export const usd = (n) => `$${(Number(n) || 0).toFixed(4)}`;
export const num = (n) => (Number(n) || 0).toLocaleString('en-US');

export function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: '#141d2d', border: `1px solid ${accent ? GOLD + '55' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px', padding: '14px 16px' }}>
      <div style={{ color: MUTED, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
      <div style={{ color: accent ? GOLD : '#e8e0d0', fontSize: '22px', fontWeight: 'bold' }}>{value}</div>
      {sub && <div style={{ color: '#5b6b85', fontSize: '11px', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

export function Panel({ title, children, style }) {
  return (
    <div style={{ background: '#141d2d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', overflow: 'hidden', ...style }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ padding: '4px 0 8px' }}>{children}</div>
    </div>
  );
}

export function MiniTable({ headers, rows }) {
  const th = { color: MUTED, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'left', padding: '8px 16px' };
  const td = { color: '#d7dde8', fontSize: '12px', padding: '7px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>{headers.map((h, i) => <th key={h} style={{ ...th, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} style={{ ...td, textAlign: j === 0 ? 'left' : 'right', color: j === row.length - 1 ? GOLD : td.color, fontWeight: j === row.length - 1 ? 'bold' : 'normal' }}>{cell}</td>
            ))}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={headers.length} style={{ ...td, color: '#4a5568', textAlign: 'center' }}>No AI activity.</td></tr>
        )}
      </tbody>
    </table>
  );
}