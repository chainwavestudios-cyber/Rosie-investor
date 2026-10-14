/**
 * DealMonitorPopout.jsx — Alt+D popout monitor for deal tracking.
 * Shows hot leads + next 3 days calendar (toggle to today only).
 * Not docked, draggable, resizable via usePopOutPanel.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { usePopOutPanel } from '@/hooks/usePopOutPanel';

const GOLD = '#10b981';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const DARK = '#0a0f1e';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DealMonitorPopout({ visible, username, onOpenLead, onClose }) {
  const panel = usePopOutPanel('deal_monitor', { width: 480, height: 680 }, username, 14600);
  const { poppedOut, floatingStyle, onDragStart, resizeHandles, toggle } = panel;
  const [leads, setLeads] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayOnly, setTodayOnly] = useState(false);
  const [search, setSearch] = useState('');

  const loadLeads = useCallback(async () => {
    try {
      const page = await base44.entities.DebtLead.filter(
        { isHotLead: true },
        { sort: '-hotLeadTaggedAt', limit: 100 }
      );
      const all = page?.items || page || [];
      setLeads(all.filter(l => !l.deletedAt));
    } catch (e) { console.error('Monitor hot leads:', e); }
    setLoading(false);
  }, []);

  const loadCalendar = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('listCalendarEvents', { days: 3 });
      const data = res?.data || res;
      if (!data?.error) setEvents(data?.events || []);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    if (visible && !poppedOut) {
      toggle();
      loadLeads();
      loadCalendar();
    } else if (!visible && poppedOut) {
      toggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!poppedOut) return;
    loadLeads();
    loadCalendar();
    const interval = setInterval(() => { loadCalendar(); }, 60000);
    return () => clearInterval(interval);
  }, [poppedOut, loadLeads, loadCalendar]);

  if (!poppedOut) return null;

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const filteredEvents = todayOnly
    ? events.filter(ev => {
        const evDate = new Date(ev.start?.dateTime || ev.start?.date || ev.startTime || '');
        return evDate.toDateString() === now.toDateString();
      })
    : events;

  const eventsByDay = {};
  filteredEvents.forEach(ev => {
    const day = ev.dayLabel || new Date(ev.start?.dateTime || ev.start?.date || ev.startTime || '').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(ev);
  });

  const filteredLeads = search
    ? leads.filter(l => `${l.firstName} ${l.lastName} ${l.phone || ''} ${l.email || ''}`.toLowerCase().includes(search.toLowerCase()))
    : leads;

  return (
    <div style={{ ...floatingStyle, background: '#0d1b2a', border: `1px solid ${GOLD}44`, borderRadius: '8px', overflow: 'hidden' }}>
      {resizeHandles}
      {/* Title bar — draggable */}
      <div
        onMouseDown={onDragStart}
        style={{ padding: '10px 14px', background: `linear-gradient(135deg,${GOLD}22,${BLUE}22)`, borderBottom: `1px solid rgba(255,255,255,0.08)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}
      >
        <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>📊 Deal Monitor</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => setTodayOnly(p => !p)}
            style={{ background: todayOnly ? `${BLUE}22` : 'rgba(255,255,255,0.05)', color: todayOnly ? BLUE : '#6b7280', border: `1px solid ${todayOnly ? BLUE + '44' : 'rgba(255,255,255,0.1)'}`, borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '9px', fontWeight: 'bold' }}
          >
            {todayOnly ? '📅 Today' : '📅 3 Days'}
          </button>
          <button onClick={() => { toggle(); onClose?.(); }} style={{ background: 'rgba(239,68,68,0.15)', color: RED, border: 'none', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✕</button>
        </div>
      </div>

      {/* Content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Hot Leads section */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ color: RED, fontSize: '11px', fontWeight: 'bold' }}>🔥 Hot Leads ({filteredLeads.length})</span>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', padding: '4px 8px', color: '#e8e0d0', fontSize: '11px', outline: 'none', boxSizing: 'border-box', marginBottom: '6px' }} />
          {loading ? (
            <div style={{ color: '#6b7280', fontSize: '11px', padding: '10px 0' }}>Loading…</div>
          ) : filteredLeads.length === 0 ? (
            <div style={{ color: '#4a5568', fontSize: '11px', padding: '10px 0' }}>No hot leads.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {filteredLeads.slice(0, 20).map(lead => (
                <div key={lead.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 6px', borderRadius: '3px', background: 'rgba(239,68,68,0.05)' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: `linear-gradient(135deg,${RED},#f97316)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: DARK, fontSize: '9px', fontWeight: 'bold', flexShrink: 0 }}>
                    {(lead.firstName?.[0] || '?')}{(lead.lastName?.[0] || '')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button
                      onClick={() => onOpenLead?.(lead)}
                      style={{ background: 'none', border: 'none', color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                      title="Open contact card"
                    >
                      {lead.firstName} {lead.lastName}
                    </button>
                    <div style={{ color: '#6b7280', fontSize: '10px' }}>
                      {lead.phone && <span>📞 {lead.phone}</span>}
                      {lead.hotLeadTaggedAt && <span style={{ marginLeft: '6px', color: AMBER }}>🔥 {timeAgo(lead.hotLeadTaggedAt)}</span>}
                    </div>
                  </div>
                  {lead.dealScore > 0 && <span style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold' }}>{lead.dealScore}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calendar section */}
        <div style={{ padding: '10px 14px' }}>
          <span style={{ color: BLUE, fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>📅 {todayOnly ? 'Today' : 'Next 3 Days'}</span>
          {filteredEvents.length === 0 ? (
            <div style={{ color: '#4a5568', fontSize: '11px', padding: '10px 0' }}>No events scheduled.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {Object.entries(eventsByDay).map(([day, dayEvents]) => (
                <div key={day}>
                  <div style={{ color: BLUE, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0 2px' }}>{day}</div>
                  {dayEvents.map(ev => (
                    <div key={ev.id} style={{ display: 'flex', gap: '8px', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold', minWidth: '45px', flexShrink: 0 }}>{ev.timeLabel || ''}</span>
                      <span style={{ color: '#c4cdd8', fontSize: '10px', wordBreak: 'break-word' }}>{ev.title}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}