/**
 * AppointmentCountdown.jsx — live ticking countdown to a lead's appointment,
 * shown as a strip inside the contact card.
 */
import useCountdown from '@/hooks/useCountdown';

const GOLD = '#10b981';

function fmt(dateIso) {
  return new Date(dateIso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function AppointmentCountdown({ date }) {
  const c = useCountdown(date);
  if (!c.hasDate) return null;

  const soon = !c.past && c.ms < 60 * 60 * 1000;      // under an hour
  const verySoon = !c.past && c.ms < 15 * 60 * 1000;  // under 15 minutes
  const tone = c.past ? '#6b7280' : verySoon ? '#ef4444' : soon ? '#f59e0b' : GOLD;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
      padding: '6px 18px',
      background: c.past ? 'rgba(0,0,0,0.15)' : `${tone}12`,
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      borderLeft: `3px solid ${tone}`,
      flexShrink: 0,
    }}>
      <span style={{ color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>📅 Appointment</span>
      <span style={{ color: '#c8d0e0', fontSize: '11px', fontWeight: 'bold' }}>{fmt(date)} ET</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#6b7280', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>
          {c.past ? 'Started' : 'Starts in'}
        </span>
        <span style={{
          color: tone, fontSize: '16px', fontWeight: 'bold',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '0.5px',
          animation: !c.past && verySoon ? 'pulse 1s infinite' : 'none',
        }}>
          {c.label}{c.past ? ' ago' : ''}
        </span>
      </span>
    </div>
  );
}