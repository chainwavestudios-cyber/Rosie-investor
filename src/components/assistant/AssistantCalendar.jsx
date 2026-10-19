import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';

const fmtAppt = (iso) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AssistantCalendar({ onDialLead }) {
  const [appts, setAppts] = useState([]);
  const [gcal, setGcal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const in7d = new Date(now.getTime() + 7 * 86400000);
      const res = await base44.entities.DebtLead.filter({ appointmentDate: { $gte: now.toISOString(), $lte: in7d.toISOString() }, deletedAt: { $exists: false } }, { sort: 'appointmentDate', limit: 50, fields: ['firstName', 'lastName', 'appointmentDate', 'appointmentConfirmed', 'appointmentEventId', 'phone', 'email', 'appointmentTitle'] });
      setAppts(res.items || res);
      try {
        const g = await base44.functions.invoke('listCalendarEvents', { daysAhead: 7 });
        const items = g?.data?.events || g?.events || [];
        setGcal(Array.isArray(items) ? items : []);
      } catch (e) { console.warn('gcal load failed', e); }
    } catch (e) { console.error('cal load', e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 120000); return () => clearInterval(i); }, [load]);

  const confirm = async (l) => {
    setBusy(l.id); setMsg('');
    try {
      await base44.functions.invoke('confirmAppointment', { leadId: l.id });
      setMsg(`✓ Confirmed appointment for ${l.firstName} ${l.lastName}`);
      load();
    } catch (e) { setMsg('✗ Confirm failed: ' + e.message); }
    setBusy('');
    setTimeout(() => setMsg(''), 4000);
  };

  const today = new Date().toDateString();
  const todays = appts.filter(a => new Date(a.appointmentDate).toDateString() === today);
  const upcoming = appts.filter(a => new Date(a.appointmentDate).toDateString() !== today);

  const Card = ({ l }) => {
    const confirmed = l.appointmentConfirmed;
    return (
      <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${confirmed ? GOLD + '44' : AMBER + '44'}`, borderLeft: `3px solid ${confirmed ? GOLD : AMBER}`, borderRadius: '4px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{l.firstName} {l.lastName}</div>
            <div style={{ color: '#8a9ab8', fontSize: '11px', marginTop: '2px' }}>{fmtAppt(l.appointmentDate)}</div>
            <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>{l.phone} {l.email ? `· ${l.email}` : ''}</div>
          </div>
          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', background: confirmed ? `${GOLD}22` : `${AMBER}22`, color: confirmed ? GOLD : AMBER }}>{confirmed ? '✓ Confirmed' : 'Unconfirmed'}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          {!confirmed && <button onClick={() => confirm(l)} disabled={busy === l.id} style={{ background: GOLD, color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{busy === l.id ? '⏳' : '✓ Confirm'}</button>}
          <button onClick={() => onDialLead?.(l)} style={{ background: `${BLUE}22`, color: BLUE, border: `1px solid ${BLUE}55`, borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>📞 Call / Transfer</button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '20px', fontWeight: 'bold' }}>📅 Calendar</div>
          <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>Next 7 days — appointments & Google Calendar events. Confirm and transfer from here.</div>
        </div>
        <button onClick={load} style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}55`, borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>↻ Refresh</button>
      </div>

      {msg && <div style={{ color: msg.startsWith('✓') ? GOLD : RED, fontSize: '12px', marginBottom: '12px', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>{msg}</div>}

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '40px' }}>Loading calendar…</div>
      ) : (
        <>
          {todays.length > 0 && (
            <>
              <div style={{ color: AMBER, fontSize: '13px', fontWeight: 'bold', margin: '12px 0 8px' }}>📌 TODAY ({todays.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{todays.map(l => <Card key={l.id} l={l} />)}</div>
            </>
          )}
          {upcoming.length > 0 && (
            <>
              <div style={{ color: BLUE, fontSize: '13px', fontWeight: 'bold', margin: '16px 0 8px' }}>📆 UPCOMING ({upcoming.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{upcoming.map(l => <Card key={l.id} l={l} />)}</div>
            </>
          )}
          {gcal.length > 0 && (
            <>
              <div style={{ color: PURPLE, fontSize: '13px', fontWeight: 'bold', margin: '16px 0 8px' }}>🗓️ GOOGLE CALENDAR ({gcal.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {gcal.map((e, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #a78bfa', borderRadius: '4px', padding: '10px 14px' }}>
                    <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{e.summary || '(no title)'}</div>
                    <div style={{ color: '#8a9ab8', fontSize: '11px', marginTop: '2px' }}>{e.start ? fmtAppt(e.start) : ''}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {todays.length === 0 && upcoming.length === 0 && gcal.length === 0 && (
            <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '40px' }}>No appointments in the next 7 days.</div>
          )}
        </>
      )}
    </div>
  );
}