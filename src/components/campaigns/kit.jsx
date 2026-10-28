/**
 * kit.jsx — the small shared pieces of the Email Campaign Manager: the palette,
 * a stat tile, a card and the step rail, so every screen of the module matches.
 */
export const GOLD = '#daba71';
export const BLUE = '#60a5fa';
export const DIM = '#6b7280';
export const MUTED = '#8a9ab8';
export const BORDER = 'rgba(255,255,255,0.09)';
export const SURFACE = 'rgba(255,255,255,0.03)';

export const STATUS_TONE = {
  draft: '#8a9ab8',
  ready: BLUE,
  running: '#48c895',
  paused: '#f59e0b',
  completed: BLUE,
  cancelled: '#ef4444',
};

export function Stat({ label, value, color = GOLD, hint }) {
  return (
    <div style={{ background: 'linear-gradient(125deg,#172337,#111b2a)', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '11px 14px', minWidth: '115px', flex: 1 }}>
      <div style={{ color: '#f5ecda', fontSize: '22px', fontWeight: 750, fontFamily: 'Inter, system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ color: MUTED, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>{label}</div>
      {hint && <div style={{ color: DIM, fontSize: '10px', marginTop: '3px' }}>{hint}</div>}
    </div>
  );
}

export function Card({ title, hint, children, actions }) {
  return (
    <section style={{ background: '#101b2c', border: `1px solid rgba(218,184,113,.17)`, borderRadius: '10px', padding: '16px 18px', minWidth: 0 }}>
      {(title || actions) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {title && <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{title}</div>}
            {hint && <div style={{ color: MUTED, fontSize: '11px', marginTop: '3px' }}>{hint}</div>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Btn({ children, onClick, tone = 'ghost', disabled, title }) {
  const tones = {
    gold: { background: `linear-gradient(125deg,${GOLD},#f0d395)`, color: '#101621', border: '1px solid rgba(255,229,157,.45)' },
    blue: { background: `linear-gradient(135deg,${BLUE},#3b82f6)`, color: '#0a0f1e', border: 'none' },
    danger: { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)' },
    ghost: { background: 'rgba(255,255,255,0.04)', color: '#c7d1dd', border: '1px solid rgba(255,255,255,.13)' },
  };
  const style = tones[tone] || tones.ghost;
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...style,
        padding: '8px 12px',
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '11px',
        fontWeight: 'bold',
        letterSpacing: '0.1px',
        opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <div style={{ color: MUTED, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>{label}</div>
      {children}
      {hint && <div style={{ color: DIM, fontSize: '10px', marginTop: '4px' }}>{hint}</div>}
    </label>
  );
}

export const inputStyle = {
  width: '100%',
  background: '#0d1828',
  border: '1px solid rgba(255,255,255,.13)',
  borderRadius: '8px',
  color: '#f0ede7',
  padding: '9px 11px',
  fontSize: '12px',
  fontFamily: 'Inter, system-ui, sans-serif',
};

/** The six steps of the campaign flow, with the step numbers the rail shows. */
export const WIZARD_STEPS = [
  { id: 'upload', n: '01', label: 'Upload CSV', hint: 'Select the file and check its columns' },
  { id: 'map', n: '02', label: 'Map & clean', hint: 'Match fields, catch duplicates and opt-outs' },
  { id: 'build', n: '03', label: 'Build campaign', hint: 'Choose the email and the sending account' },
  { id: 'personalize', n: '04', label: 'Personalize & test', hint: 'Resolve tags, images and invite links' },
  { id: 'launch', n: '05', label: 'Schedule & launch', hint: 'Approve recipients and start the queue' },
  { id: 'monitor', n: '06', label: 'Monitor results', hint: 'Sends, opens, clicks and errors' },
];

export function StepRail({ current, onSelect, furthest }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
      {WIZARD_STEPS.map((step, index) => {
        const active = step.id === current;
        const done = index <= furthest && !active;
        const reachable = index <= Math.max(furthest, 0);
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => reachable && onSelect(step.id)}
            style={{
              flex: '1 1 136px',
              textAlign: 'left',
              background: active ? `${GOLD}18` : SURFACE,
              border: `1px solid ${active ? `${GOLD}66` : BORDER}`,
              borderTop: `2px solid ${active ? GOLD : done ? BLUE : 'transparent'}`,
              borderRadius: '8px',
              padding: '9px 11px',
              cursor: reachable ? 'pointer' : 'not-allowed',
              opacity: reachable ? 1 : 0.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: active ? GOLD : done ? BLUE : DIM, fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.5px' }}>{done ? '✓' : step.n}</span>
              <span style={{ color: active ? '#f5ecda' : MUTED, fontSize: '11px', fontWeight: 'bold' }}>{step.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}