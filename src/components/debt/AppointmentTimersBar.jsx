/**
 * AppointmentTimersBar.jsx — every upcoming appointment in Debt Call Coach,
 * counting down live across the top of the page. Click a timer to open the card.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCountdown } from '@/hooks/useCountdown';

const GOLD = '#10b981';

function timeLabel(dateIso) {
  return new Date(dateIso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function tone(ms) {
  if (ms < 15 * 60 * 1000) return '#ef4444';
  if (ms < 60 * 60 * 1000) return '#f59e0b';
  return GOLD;
}

export default function AppointmentTimersBar({ onOpenLead }) {
  const [leads, setLeads] = useState([]);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const page = await base44.entities.DebtLead.filter(
      { appointmentDate: { $gte: new Date().toISOString() } },
      { sort: 'appointmentDate', limit: 100 },
    );
    const items = page?.items || [];
    setLeads(items.filter(l => !l.deletedAt && l.appointmentDate));
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 60000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [load]);

  if (!leads.length) return null;

  return (
    <div style={{
      margin: '14px 0 4px', padding: '8px 10px',
      background: 'rgba(16,185,129,0.05)',
      border: '1px solid rgba(16,185,129,0.2)',
      borderRadius: '6px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ color: GOLD, fontSize: '9px', fontWeight: 'bold', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          ⏳ Appointment Timers
        </span>
        <span style={{ color: '#6b7280', fontSize: '9px' }}>{leads.length} upcoming</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
        {leads.map(lead => {
          const ms = new Date(lead.appointmentDate).getTime() - now;
          const { label, past } = formatCountdown(ms);
          const c = past ? '#6b7280' : tone(ms);
          return (
            <button
              key={lead.id}
              onClick={() => onOpenLead?.(lead)}
              title={`${lead.firstName || ''} ${lead.lastName || ''} — ${timeLabel(lead.appointmentDate)}`}
              style={{
                flexShrink: 0, textAlign: 'left', cursor: 'pointer',
                background: 'rgba(0,0,0,0.35)',
                border: `1px solid ${c}44`,
                borderLeft: `3px solid ${c}`,
                borderRadius: '5px', padding: '6px 10px',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                {lead.firstName || 'Lead'} {lead.lastName || ''}
              </div>
              <div style={{
                color: c, fontSize: '14px', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums',
                animation: !past && ms < 15 * 60 * 1000 ? 'pulse 1s infinite' : 'none',
              }}>
                {label}
              </div>
              <div style={{ color: '#6b7280', fontSize: '9px', whiteSpace: 'nowrap' }}>{timeLabel(lead.appointmentDate)} ET</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}