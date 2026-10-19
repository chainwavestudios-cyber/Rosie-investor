import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import ClientProfileModal from '@/components/debt/ClientProfileModal';
import CalendarContactCard from '@/components/assistant/CalendarContactCard';

const GOLD = '#10b981';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const ORANGE = '#f97316';

const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmtDay = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const sameDay = (a, b) => a.toDateString() === b.toDateString();

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AssistantCalendar({ onDialLead, username }) {
  const [view, setView] = useState('month'); // 'month' | 'week' | 'day'
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [events, setEvents] = useState([]);
  const [gcal, setGcal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [openLead, setOpenLead] = useState(null);
  const [calCardLead, setCalCardLead] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fields = ['firstName', 'lastName', 'phone', 'email', 'appointmentDate', 'appointmentConfirmed', 'appointmentTitle', 'callbackAt', 'isHotLead', 'hotLeadTaggedAt', 'status'];
      const [apptPage, cbPage, hotPage] = await Promise.all([
        base44.entities.DebtLead.filter({ appointmentDate: { $ne: null } }, { limit: 400, fields }),
        base44.entities.DebtLead.filter({ callbackAt: { $ne: null } }, { limit: 400, fields }),
        base44.entities.DebtLead.filter({ isHotLead: true }, { limit: 400, fields }),
      ]);
      const byId = new Map();
      for (const p of [apptPage, cbPage, hotPage]) {
        for (const r of (p?.items || p || [])) byId.set(r.id, r);
      }
      const rows = Array.from(byId.values());
      const evs = [];
      for (const l of rows) {
        if (l.appointmentDate) {
          evs.push({ id: l.id + '-appt', kind: 'appointment', lead: l, date: new Date(l.appointmentDate), color: l.appointmentConfirmed ? GOLD : AMBER, label: 'Appt', name: `${l.firstName} ${l.lastName}` });
        }
        if (l.callbackAt) {
          evs.push({ id: l.id + '-cb', kind: 'callback', lead: l, date: new Date(l.callbackAt), color: PURPLE, label: 'Callback', name: `${l.firstName} ${l.lastName}` });
        }
        if (l.isHotLead && l.hotLeadTaggedAt) {
          evs.push({ id: l.id + '-hot', kind: 'hot', lead: l, date: new Date(l.hotLeadTaggedAt), color: ORANGE, label: '🔥 Hot', name: `${l.firstName} ${l.lastName}` });
        }
      }
      setEvents(evs);
      try {
        const g = await base44.functions.invoke('listCalendarEvents', { days: 75 });
        const items = g?.data?.events || g?.events || [];
        setGcal(Array.isArray(items) ? items.map((e, i) => ({ id: 'gcal-' + i, kind: 'gcal', date: new Date(e.start || e.startDateTime || e.created), color: BLUE, label: 'GCal', name: e.summary || '(no title)', raw: e, htmlLink: e.htmlLink })) : []);
      } catch (e) { /* gcal optional */ }
    } catch (e) { console.error('cal load', e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 120000); return () => clearInterval(i); }, [load]);

  const visibleEvents = useMemo(() => {
    let evs = events;
    if (filter === 'appointment') evs = evs.filter(e => e.kind === 'appointment');
    else if (filter === 'hot') evs = evs.filter(e => e.kind === 'hot');
    else if (filter === 'callback') evs = evs.filter(e => e.kind === 'callback');
    else if (filter === 'gcal') evs = gcal;
    else evs = [...evs, ...gcal];
    return evs;
  }, [events, gcal, filter]);

  // ── Date math ──────────────────────────────────────────────
  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekLabel = (() => {
    const start = new Date(cursor); start.setDate(start.getDate() - start.getDay());
    const end = new Date(start); end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  })();
  const dayLabel = cursor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const shift = (dir) => {
    const d = new Date(cursor);
    if (view === 'month') d.setMonth(d.getMonth() + dir);
    else if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCursor(d);
  };

  const eventsForDay = (day) => visibleEvents.filter(e => sameDay(e.date, day)).sort((a, b) => a.date - b.date);

  const confirm = async (lead) => {
    setBusy(lead.id); setMsg('');
    try {
      await base44.functions.invoke('confirmAppointment', { leadId: lead.id });
      setMsg(`✓ Confirmed ${lead.firstName} ${lead.lastName}`);
      load();
    } catch (e) { setMsg('✗ ' + e.message); }
    setBusy('');
    setTimeout(() => setMsg(''), 4000);
  };

  const EventChip = ({ e, compact }) => (
    <div
      onClick={(ev) => { ev.stopPropagation(); if (e.lead) setOpenLead(e.lead); }}
      title={e.kind === 'gcal' ? e.name : `${e.label} · ${e.name}`}
      style={{ background: `${e.color}1a`, border: `1px solid ${e.color}44`, borderLeft: `3px solid ${e.color}`, borderRadius: '3px', padding: compact ? '3px 5px' : '5px 7px', cursor: 'pointer', marginBottom: '3px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
        <span style={{ color: '#e8e0d0', fontSize: compact ? '9px' : '10px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{e.name}</span>
        <span style={{ color: e.color, fontSize: compact ? '8px' : '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.3px', flexShrink: 0 }}>{e.label}</span>
      </div>
      {!compact && <div style={{ color: '#6b7280', fontSize: '9px', marginTop: '1px' }}>{fmtTime(e.date)}</div>}
    </div>
  );

  // ── Month grid ─────────────────────────────────────────────
  const monthGrid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first); start.setDate(start.getDate() - start.getDay());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [cursor]);

  const todayStr = new Date().toDateString();

  // ── Day timeline ───────────────────────────────────────────
  const dayEvents = eventsForDay(cursor);

  return (
    <div style={{ fontFamily: 'Georgia, serif' }}>
      {openLead && (
        <ClientProfileModal lead={openLead} onClose={() => setOpenLead(null)} onSave={(u) => { setOpenLead(u); load(); }} />
      )}
      {calCardLead && (
        <CalendarContactCard lead={calCardLead} username={username} onClose={() => setCalCardLead(null)} onSave={(u) => { setCalCardLead(u); load(); }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '20px', fontWeight: 'bold' }}>📅 Calendar</div>
          <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>Appointments, hot leads & callbacks. Click any card to open the contact profile.</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', padding: '2px' }}>
            {['month', 'week', 'day'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ background: view === v ? `${GOLD}22` : 'transparent', border: 'none', color: view === v ? GOLD : '#6b7280', borderRadius: '3px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: view === v ? 'bold' : 'normal', textTransform: 'capitalize' }}>{v}</button>
            ))}
          </div>
          <button onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setCursor(d); }} style={navBtn}>Today</button>
          <button onClick={() => shift(-1)} style={navBtn}>‹</button>
          <button onClick={() => shift(1)} style={navBtn}>›</button>
          <button onClick={load} style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}55`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>↻</button>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {[['all', 'All'], ['appointment', '📅 Appointments'], ['hot', '🔥 Hot Leads'], ['callback', '📞 Callbacks'], ['gcal', '🗓️ Google']].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{ background: filter === id ? `${GOLD}15` : 'transparent', border: `1px solid ${filter === id ? GOLD : 'rgba(255,255,255,0.1)'}`, color: filter === id ? GOLD : '#6b7280', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px' }}>{label}</button>
        ))}
      </div>

      <div style={{ color: '#e8e0d0', fontSize: '15px', fontWeight: 'bold', marginBottom: '12px' }}>
        {view === 'month' ? monthLabel : view === 'week' ? weekLabel : dayLabel}
      </div>

      {msg && <div style={{ color: msg.startsWith('✓') ? GOLD : RED, fontSize: '12px', marginBottom: '10px', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>{msg}</div>}

      {loading ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: '60px' }}>Loading calendar…</div>
      ) : (
        <>
          {/* ── MONTH ── */}
          {view === 'month' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px', marginBottom: '6px' }}>
                {WEEKDAYS.map(w => <div key={w} style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center', padding: '6px 0' }}>{w}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px' }}>
                {monthGrid.map((d, i) => {
                  const inMonth = d.getMonth() === cursor.getMonth();
                  const isToday = d.toDateString() === todayStr;
                  const evs = eventsForDay(d);
                  return (
                    <div key={i} onClick={() => { setCursor(new Date(d)); setView('day'); }} style={{ background: isToday ? `${GOLD}0a` : 'rgba(255,255,255,0.02)', border: isToday ? `1px solid ${GOLD}44` : '1px solid rgba(255,255,255,0.05)', borderRadius: '5px', padding: '5px 6px', minHeight: '92px', opacity: inMonth ? 1 : 0.4, cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = isToday ? `${GOLD}18` : 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = isToday ? `${GOLD}0a` : 'rgba(255,255,255,0.02)'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ color: isToday ? GOLD : inMonth ? '#e8e0d0' : '#4a5568', fontSize: '12px', fontWeight: isToday ? 'bold' : 'normal' }}>{d.getDate()}</span>
                        {evs.length > 3 && <span style={{ color: GOLD, fontSize: '9px' }}>+{evs.length - 3}</span>}
                      </div>
                      {evs.slice(0, 3).map(e => <EventChip key={e.id} e={e} compact />)}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── WEEK ── */}
          {view === 'week' && (() => {
            const start = new Date(cursor); start.setDate(start.getDate() - start.getDay());
            const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px', marginBottom: '6px' }}>
                  {WEEKDAYS.map((w, i) => <div key={w} style={{ textAlign: 'center', padding: '6px 0' }}><div style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>{w}</div><div style={{ color: sameDay(days[i], new Date()) ? GOLD : '#e8e0d0', fontSize: '15px', fontWeight: sameDay(days[i], new Date()) ? 'bold' : 'normal' }}>{days[i].getDate()}</div></div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px' }}>
                  {days.map((d, i) => {
                    const evs = eventsForDay(d);
                    return (
                      <div key={i} onClick={() => { setCursor(new Date(d)); setView('day'); }} style={{ background: sameDay(d, new Date()) ? `${GOLD}08` : 'rgba(255,255,255,0.02)', border: sameDay(d, new Date()) ? `1px solid ${GOLD}33` : '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '7px', minHeight: '240px', cursor: 'pointer' }}>
                        {evs.length === 0 ? <div style={{ color: '#2d3748', fontSize: '10px', textAlign: 'center', paddingTop: '20px' }}>—</div> : evs.map(e => <EventChip key={e.id} e={e} />)}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}

          {/* ── DAY ── */}
          {view === 'day' && (
            <div style={{ maxWidth: '640px' }}>
              {dayEvents.length === 0 ? (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: '50px' }}>No events on this day.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dayEvents.map(e => {
                    const l = e.lead;
                    return (
                      <div key={e.id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${e.color}44`, borderLeft: `4px solid ${e.color}`, borderRadius: '5px', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                          <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => l && setOpenLead(l)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: e.color, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{e.label}</span>
                              <span style={{ color: '#8a9ab8', fontSize: '11px' }}>{fmtTime(e.date)}</span>
                            </div>
                            <div style={{ color: '#e8e0d0', fontSize: '15px', fontWeight: 'bold', marginTop: '4px' }}>{e.name}</div>
                            {l && <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '3px' }}>{l.phone} {l.email ? `· ${l.email}` : ''}</div>}
                            {e.kind === 'gcal' && e.htmlLink && <a href={e.htmlLink} target="_blank" rel="noreferrer" onClick={ev => ev.stopPropagation()} style={{ color: BLUE, fontSize: '11px', marginTop: '3px', display: 'inline-block' }}>Open in Google Calendar →</a>}
                          </div>
                          {l && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0 }}>
                              <button onClick={() => setCalCardLead(l)} style={{ background: `${PURPLE}18`, color: PURPLE, border: `1px solid ${PURPLE}55`, borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>📅 Calendar Card</button>
                              <button onClick={() => setOpenLead(l)} style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>👤 Contact Card</button>
                              {e.kind === 'appointment' && !l.appointmentConfirmed && <button onClick={() => confirm(l)} disabled={busy === l.id} style={{ background: GOLD, color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>{busy === l.id ? '⏳' : '✓ Confirm'}</button>}
                              <button onClick={() => onDialLead?.(l)} style={{ background: `${BLUE}22`, color: BLUE, border: `1px solid ${BLUE}55`, borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>📞 Call</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const navBtn = {
  background: 'rgba(255,255,255,0.05)',
  color: '#8a9ab8',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '4px',
  padding: '5px 10px',
  cursor: 'pointer',
  fontSize: '12px',
};