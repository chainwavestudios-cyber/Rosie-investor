/**
 * HotLeadsTab.jsx — Shows all leads tagged "Hot Lead" alongside a calendar
 * view of upcoming scheduled calls/appointments.
 *
 * Features:
 *   - Pop-out calendar panel (persists across tabs)
 *   - Shows ALL appointments for the current day (even past ones)
 *   - "Today Only" toggle button
 *   - Phone number shown for each appointment
 *   - Click appointment to open contact card (not calendar link)
 *   - Green checkmark to mark appointment completed
 *   - Missed appointment detection (past time + no checkmark)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachValue, getDebtCoachValue, setDebtCoachValue } from '@/lib/debtCoachStorage';

const GOLD = '#10b981';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const AMBER = '#f59e0b';
const DARK = '#0a0f1e';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isToday(dateStr) {
  const today = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric' });
  return dateStr === today;
}

export default function HotLeadsTab({ onOpenLead }) {
  const [leads, setLeads] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calLoading, setCalLoading] = useState(true);
  const [calError, setCalError] = useState('');
  const [search, setSearch] = useState('');
  const [todayOnly, setTodayOnly] = useState(false);
  const [completed, setCompleted] = useState(() => {
    try { return JSON.parse(localStorage.getItem('appt_completed') || '{}'); } catch { return {}; }
  });
  const [calPoppedOut, setCalPoppedOut] = useState(false);
  const [calPos, setCalPos] = useState({ x: 760, y: 80 });
  const [calSize, setCalSize] = useState({ w: 380, h: 600 });
  const calDragRef = useRef(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const page = await base44.entities.DebtLead.filter(
        { isHotLead: true },
        { sort: '-hotLeadTaggedAt', limit: 200 }
      );
      const all = page?.items || page || [];
      setLeads(all.filter(l => !l.deletedAt));
    } catch (e) {
      console.error('Hot leads load failed:', e);
    }
    setLoading(false);
  }, []);

  const loadCalendar = useCallback(async () => {
    setCalLoading(true);
    setCalError('');
    try {
      const res = await base44.functions.invoke('listCalendarEvents', { days: 3 });
      const data = res?.data || res;
      if (data?.error) setCalError(data.error);
      else setEvents(data?.events || []);
    } catch (e) {
      setCalError(e?.message || String(e));
    }
    setCalLoading(false);
  }, []);

  useEffect(() => {
    loadLeads();
    loadCalendar();
    const interval = setInterval(loadCalendar, 60000);
    return () => clearInterval(interval);
  }, [loadLeads, loadCalendar]);

  const removeHotTag = async (lead) => {
    if (!window.confirm(`Remove "Hot Lead" tag from ${lead.firstName} ${lead.lastName}?`)) return;
    try {
      await base44.entities.DebtLead.update(lead.id, {
        isHotLead: false,
        hotLeadTaggedAt: null,
        hotLeadTaggedBy: null,
      });
      loadLeads();
    } catch (e) {
      alert('Failed: ' + (e?.message || String(e)));
    }
  };

  const toggleCompleted = (ev) => {
    const next = { ...completed, [ev.id]: !completed[ev.id] };
    setCompleted(next);
    localStorage.setItem('appt_completed', JSON.stringify(next));
  };

  // Calendar drag
  const onCalDragStart = (e) => {
    calDragRef.current = { startX: e.clientX - calPos.x, startY: e.clientY - calPos.y };
    const onMove = (ev) => { if (calDragRef.current) setCalPos({ x: ev.clientX - calDragRef.current.startX, y: ev.clientY - calDragRef.current.startY }); };
    const onUp = () => { calDragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Try to match an event to a lead by name
  const findLeadForEvent = (ev) => {
    if (!leads.length) return null;
    const title = (ev.title || '').toLowerCase();
    return leads.find(l => {
      const name = `${l.firstName} ${l.lastName}`.toLowerCase();
      return title.includes(name) || title.includes((l.firstName || '').toLowerCase()) || title.includes((l.lastName || '').toLowerCase());
    });
  };

  // Extract phone from event title or description (e.g. "John Doe - 555-123-4567")
  const extractPhoneFromEvent = (ev) => {
    const title = ev.title || '';
    const phoneMatch = title.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) return phoneMatch[0];
    // Try to find from matched lead
    const lead = findLeadForEvent(ev);
    if (lead?.phone) return lead.phone;
    return null;
  };

  // Group calendar events by day
  const eventsByDay = {};
  let filteredEvents = events;
  if (todayOnly) {
    filteredEvents = events.filter(ev => isToday(ev.dayLabel));
  }
  filteredEvents.forEach(ev => {
    if (!eventsByDay[ev.dayLabel]) eventsByDay[ev.dayLabel] = [];
    eventsByDay[ev.dayLabel].push(ev);
  });

  const filtered = search
    ? leads.filter(l => `${l.firstName} ${l.lastName} ${l.phone || ''} ${l.email || ''}`.toLowerCase().includes(search.toLowerCase()))
    : leads;

  // Calendar panel content (shared between docked and popped-out)
  const calendarPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{ color: BLUE, fontSize: '13px', fontWeight: 'bold' }}>📅 {todayOnly ? 'Today' : 'Next 3 Days'}</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => setTodayOnly(p => !p)}
            style={{
              background: todayOnly ? `${GOLD}18` : 'rgba(255,255,255,0.05)',
              color: todayOnly ? GOLD : '#6b7280',
              border: `1px solid ${todayOnly ? GOLD + '44' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',
              fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap',
            }}
          >
            {todayOnly ? '✓ Today Only' : 'Today Only'}
          </button>
          <button onClick={loadCalendar} disabled={calLoading} style={{ background: 'rgba(96,165,250,0.1)', color: BLUE, border: `1px solid ${BLUE}33`, borderRadius: '4px', padding: '4px 10px', cursor: calLoading ? 'not-allowed' : 'pointer', fontSize: '10px', fontWeight: 'bold' }}>{calLoading ? '⏳' : '↻'}</button>
          {calPoppedOut ? (
            <button onClick={() => setCalPoppedOut(false)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>↙ Dock</button>
          ) : (
            <button onClick={() => setCalPoppedOut(true)} style={{ background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>↗ Pop Out</button>
          )}
        </div>
      </div>

      {/* Events */}
      {calError ? (
        <div style={{ padding: '20px', color: RED, fontSize: '12px' }}>⚠ {calError}</div>
      ) : calLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>Loading calendar…</div>
      ) : filteredEvents.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568', fontSize: '12px' }}>
          {todayOnly ? 'No appointments scheduled for today.' : 'No events scheduled for the next 3 days.'}
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {Object.entries(eventsByDay).map(([day, dayEvents]) => {
            const isCurrentDay = isToday(day);
            return (
              <div key={day}>
                <div style={{
                  padding: '8px 18px',
                  background: isCurrentDay ? 'rgba(16,185,129,0.08)' : 'rgba(96,165,250,0.06)',
                  borderBottom: '1px solid rgba(96,165,250,0.1)',
                  borderTop: '1px solid rgba(96,165,250,0.1)',
                  color: isCurrentDay ? GOLD : BLUE,
                  fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>{isCurrentDay ? '★ ' : ''}{day}</span>
                  <span style={{ opacity: 0.7 }}>{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</span>
                </div>
                {dayEvents.map(ev => {
                  const startMs = new Date(ev.startISO || '').getTime();
                  const isPast = !isNaN(startMs) && startMs < Date.now();
                  const isDone = completed[ev.id];
                  const isMissed = isPast && !isDone;
                  const phone = extractPhoneFromEvent(ev);
                  const matchedLead = findLeadForEvent(ev);
                  const openHandler = () => {
                    if (matchedLead && onOpenLead) onOpenLead(matchedLead);
                  };
                  return (
                    <div key={ev.id} style={{
                      padding: '10px 18px',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      display: 'flex', gap: '10px', alignItems: 'flex-start',
                      background: isMissed ? 'rgba(239,68,68,0.04)' : 'transparent',
                    }}>
                      <div style={{ color: isPast && !isDone ? '#6b7280' : GOLD, fontSize: '11px', fontWeight: 'bold', minWidth: '55px', flexShrink: 0, textDecoration: isDone ? 'line-through' : 'none' }}>{ev.timeLabel}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          color: isDone ? '#4a5568' : isMissed ? RED : '#e8e0d0',
                          fontSize: '12px', fontWeight: 'bold', wordBreak: 'break-word',
                          textDecoration: isDone ? 'line-through' : 'none',
                          cursor: onOpenLead ? 'pointer' : 'default',
                        }} onClick={openHandler}>
                          {ev.title}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '3px' }}>
                          {phone && <span style={{ color: BLUE, fontSize: '10px' }}>📞 {phone}</span>}
                          {ev.attendees?.length > 0 && <span style={{ color: '#6b7280', fontSize: '10px' }}>✉ {ev.attendees.join(', ')}</span>}
                          {isMissed && <span style={{ color: RED, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚠ Missed</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                          {onOpenLead && (matchedLead || phone) && (
                            <button onClick={openHandler} style={{
                              background: `${GOLD}12`, color: GOLD,
                              border: `1px solid ${GOLD}33`, borderRadius: '3px',
                              padding: '3px 8px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold',
                            }}>
                              📇 Contact Card
                            </button>
                          )}
                          <button
                            onClick={() => toggleCompleted(ev)}
                            title={isDone ? 'Mark as not completed' : 'Mark as completed'}
                            style={{
                              background: isDone ? `${GOLD}20` : 'rgba(255,255,255,0.05)',
                              color: isDone ? GOLD : '#4a5568',
                              border: `1px solid ${isDone ? GOLD + '66' : 'rgba(255,255,255,0.12)'}`,
                              borderRadius: '3px', padding: '3px 8px', cursor: 'pointer',
                              fontSize: '11px', fontWeight: 'bold',
                            }}
                          >
                            {isDone ? '✓ Completed' : '◯ Mark Done'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: calPoppedOut ? '1fr' : '1fr 380px', gap: '16px', alignItems: 'start' }}>
      {/* Hot Leads List */}
      <div style={{ background: '#0d1b2a', border: `1px solid ${RED}33`, borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <span style={{ color: RED, fontSize: '15px', fontWeight: 'bold' }}>🔥 Hot Leads</span>
            <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '8px' }}>{leads.length} tagged</span>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hot leads…" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '5px 10px', color: '#e8e0d0', fontSize: '11px', outline: 'none', fontFamily: 'Georgia, serif', width: '200px' }} />
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>Loading hot leads…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568', fontSize: '13px' }}>
            {search ? 'No hot leads match your search.' : 'No hot leads yet. Tag a lead as "Hot Lead" from the contact card header.'}
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {filtered.map(lead => (
              <div key={lead.id} style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `linear-gradient(135deg,${RED},#f97316)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: DARK, fontSize: '13px', fontWeight: 'bold', flexShrink: 0, textTransform: 'uppercase' }}>
                  {(lead.firstName?.[0] || '?')}{(lead.lastName?.[0] || '')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{lead.firstName} {lead.lastName}</span>
                    <span style={{ padding: '1px 7px', borderRadius: '8px', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', background: `${RED}15`, color: RED, border: `1px solid ${RED}33` }}>🔥 Hot</span>
                    {lead.status && <span style={{ padding: '1px 7px', borderRadius: '8px', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', background: 'rgba(138,154,184,0.12)', color: '#8a9ab8' }}>{lead.status}</span>}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {lead.phone && <span>📞 {lead.phone}</span>}
                    {lead.debtAmount > 0 && <span>💳 ${lead.debtAmount.toLocaleString()}</span>}
                    {lead.callCount > 0 && <span>📋 {lead.callCount} call{lead.callCount !== 1 ? 's' : ''}</span>}
                    {lead.hotLeadTaggedAt && <span style={{ color: AMBER }}>🔥 Tagged {timeAgo(lead.hotLeadTaggedAt)}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {onOpenLead && (
                    <button onClick={() => onOpenLead(lead)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>Open</button>
                  )}
                  <button onClick={() => removeHotTag(lead)} title="Remove hot lead tag" style={{ background: 'rgba(239,68,68,0.1)', color: RED, border: `1px solid ${RED}33`, borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Docked Calendar */}
      {!calPoppedOut && (
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '8px', overflow: 'hidden', position: 'sticky', top: '0', maxHeight: '700px' }}>
          {calendarPanel}
        </div>
      )}

      {/* Popped-out Calendar */}
      {calPoppedOut && (
        <div style={{
          position: 'fixed', left: calPos.x, top: calPos.y, width: calSize.w, height: calSize.h,
          background: '#0d1b2a', border: `2px solid ${BLUE}44`, borderRadius: '8px',
          boxShadow: '0 16px 64px rgba(0,0,0,0.8)', zIndex: 10001,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div onMouseDown={onCalDragStart} style={{
            padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: 'move', userSelect: 'none', flexShrink: 0,
          }}>
            <span style={{ color: BLUE, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📅 Calendar</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button onClick={() => setCalSize(s => ({ ...s, w: Math.max(300, s.w - 40) }))} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: 'none', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer', fontSize: '14px' }}>−</button>
              <button onClick={() => setCalSize(s => ({ ...s, w: s.w + 40, h: s.h + 40 }))} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: 'none', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer', fontSize: '14px' }}>+</button>
              <button onClick={() => setCalPoppedOut(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', padding: '0 4px' }}>×</button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {calendarPanel}
          </div>
          <div onMouseDown={(e) => {
            e.stopPropagation();
            const startX = e.clientX, startY = e.clientY, startW = calSize.w, startH = calSize.h;
            const onMove = (ev) => setCalSize({ w: Math.max(300, startW + ev.clientX - startX), h: Math.max(300, startH + ev.clientY - startY) });
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
        </div>
      )}
    </div>
  );
}