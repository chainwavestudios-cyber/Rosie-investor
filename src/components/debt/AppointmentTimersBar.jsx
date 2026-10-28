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
  const [expanded, setExpanded] = useState(false);
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
      margin:'10px 0 8px',padding:'9px 13px',
      background:'linear-gradient(110deg,rgba(21,51,46,.58),rgba(13,30,43,.75))',
      border:'1px solid rgba(104,175,149,.24)',borderRadius:10,
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <span style={{color:'#9fe5c6',fontSize:10,fontWeight:850,letterSpacing:1.2,textTransform:'uppercase'}}>◷ Upcoming appointments</span>
          <span style={{color:'#b9ccd2',fontSize:11}}>{leads.length} scheduled</span>
          <span style={{color:'#dab879',fontSize:11}} title={timeLabel(leads[0].appointmentDate)}>Next: {leads[0].firstName||'Lead'} {leads[0].lastName||''} · {formatCountdown(new Date(leads[0].appointmentDate).getTime()-now).label}</span>
        </div>
        <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} style={{color:'#9de8cd',border:'1px solid #356d5b',background:'#163b32',borderRadius:7,padding:'6px 11px',fontSize:10,fontWeight:750,cursor:'pointer'}}>{expanded?'Hide appointments':'View appointments'} {expanded?'▴':'▾'}</button>
      </div>
      {expanded && <div style={{display:'flex',gap:8,overflowX:'auto',padding:'11px 0 3px'}}>
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
      </div>}
    </div>
  );
}