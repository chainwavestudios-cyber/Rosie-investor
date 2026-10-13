/**
 * HotLeadsTab.jsx — Shows all leads tagged "Hot Lead" alongside a 3-day
 * Google Calendar view of upcoming scheduled calls/appointments.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

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

export default function HotLeadsTab({ onOpenLead }) {
  const [leads, setLeads] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calLoading, setCalLoading] = useState(true);
  const [calError, setCalError] = useState('');
  const [search, setSearch] = useState('');

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const page = await base44.entities.DebtLead.filter(
        { isHotLead: true, deletedAt: { $exists: false } },
        { sort: '-hotLeadTaggedAt', limit: 200 }
      );
      setLeads(page?.items || page || []);
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
    const interval = setInterval(loadCalendar, 60000); // refresh calendar every minute
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

  // Group calendar events by day
  const eventsByDay = {};
  events.forEach(ev => {
    if (!eventsByDay[ev.dayLabel]) eventsByDay[ev.dayLabel] = [];
    eventsByDay[ev.dayLabel].push(ev);
  });

  const filtered = search
    ? leads.filter(l => `${l.firstName} ${l.lastName} ${l.phone || ''} ${l.email || ''}`.toLowerCase().includes(search.toLowerCase()))
    : leads;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '16px', alignItems: 'start' }}>
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

      {/* 3-Day Calendar */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '8px', overflow: 'hidden', position: 'sticky', top: '0' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: BLUE, fontSize: '13px', fontWeight: 'bold' }}>📅 Next 3 Days</span>
          <button onClick={loadCalendar} disabled={calLoading} style={{ background: 'rgba(96,165,250,0.1)', color: BLUE, border: `1px solid ${BLUE}33`, borderRadius: '4px', padding: '4px 10px', cursor: calLoading ? 'not-allowed' : 'pointer', fontSize: '10px', fontWeight: 'bold' }}>{calLoading ? '⏳' : '↻ Refresh'}</button>
        </div>

        {calError ? (
          <div style={{ padding: '20px', color: RED, fontSize: '12px' }}>⚠ {calError}</div>
        ) : calLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>Loading calendar…</div>
        ) : events.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568', fontSize: '12px' }}>No events scheduled for the next 3 days.</div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {Object.entries(eventsByDay).map(([day, dayEvents]) => (
              <div key={day}>
                <div style={{ padding: '8px 18px', background: 'rgba(96,165,250,0.06)', borderBottom: '1px solid rgba(96,165,250,0.1)', borderTop: '1px solid rgba(96,165,250,0.1)', color: BLUE, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{day} · {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</div>
                {dayEvents.map(ev => (
                  <div key={ev.id} style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', minWidth: '55px', flexShrink: 0 }}>{ev.timeLabel}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', wordBreak: 'break-word' }}>{ev.title}</div>
                      {ev.attendees?.length > 0 && <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '2px' }}>✉ {ev.attendees.join(', ')}</div>}
                      {ev.htmlLink && <a href={ev.htmlLink} target="_blank" rel="noreferrer" style={{ color: BLUE, fontSize: '10px', textDecoration: 'underline' }}>View in Calendar ↗</a>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}