/** Shared visual kit for the Super Admin Command Center cards. */

export const C = {
  coach: '#60a5fa',
  fronter: '#10b981',
  ink: '#e8e0d0',
  muted: '#6b7280',
  dim: '#4a5568',
  bg: '#0a0f1e',
  surface: '#0d1b2a',
  warn: '#f59e0b',
  danger: '#ef4444',
  purple: '#a78bfa',
  border: 'rgba(255,255,255,0.08)',
};

export const lbl = { display: 'block', color: '#6b7280', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' };
export const val = { color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' };

export const rowStyle = {
  display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 9px',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '5px', marginBottom: '6px',
};

export const emptyStyle = { color: '#4a5568', fontSize: '11px', textAlign: 'center', padding: '18px 8px' };

export const inputStyle = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '4px', padding: '7px 9px', color: '#e8e0d0', fontSize: '12px',
  outline: 'none', boxSizing: 'border-box', width: '100%',
};

export const chip = (color) => ({
  padding: '2px 7px', borderRadius: '3px', background: `${color}22`, color,
  fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
});

export const btn = (color) => ({
  background: `${color}1a`, color, border: `1px solid ${color}55`, borderRadius: '4px',
  padding: '5px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap',
});

export const bar = (color, pct) => ({
  height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: '5px',
});

export const barFill = (color, pct) => ({
  height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: color, borderRadius: '3px',
});

export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');

export const fmtDur = (seconds) => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
};

export const ago = (iso) => {
  if (!iso) return '';
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

/** Read a list result as an array, whichever shape the SDK returns. */
export const asArray = (res) => (Array.isArray(res) ? res : res?.items || []);

/** Mask a phone/email value so monitor cards stay readable. */
export const digits = (v) => String(v || '').replace(/\D/g, '');