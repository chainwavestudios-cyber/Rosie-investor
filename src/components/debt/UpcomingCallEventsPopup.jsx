/**
 * UpcomingCallEventsPopup.jsx — Floating popup in the DebtCallCoach area that
 * shows upcoming scheduled call events (FronterMeeting records) so the coach
 * never misses a call. Polls every 30 seconds. Shows events starting within
 * the next 2 hours. Each card has the lead name, time countdown, and a
 * Call Now button. Auto-dismisses events after they end.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const DARK = '#0a0f1e';

function fmtCountdown(ms) {
  if (ms <= 0) return 'Now';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMin = mins % 60;
    return `${hrs}h ${remMin}m`;
  }
  return `${mins}m ${secs}s`;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
}

export default function UpcomingCallEventsPopup() {
  const [meetings, setMeetings] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_call_events') || '{}'); } catch { return {}; }
  });
  const [expanded, setExpanded] = useState(true);
  const [now, setNow] = useState(Date.now());
  const prevCount = useRef(0);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await base44.entities.FronterMeeting.filter(
          { status: 'scheduled' },
          'meetingStartISO',
          50
        );
        const all = Array.isArray(raw) ? raw : (raw?.items || []);
        const cutoff = Date.now() - 15 * 60 * 1000; // 15 min grace after start
        const upcoming = all.filter(m => new Date(m.meetingStartISO).getTime() > cutoff);
        setMeetings(upcoming);
      } catch {}
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Blink when a new event appears
  useEffect(() => {
    if (meetings.length > prevCount.current) {
      setExpanded(true);
    }
    prevCount.current = meetings.length;
  }, [meetings.length]);

  // Filter out dismissed events (by meeting id)
  const visible = meetings.filter(m => !dismissed[m.id]);

  const dismiss = (id) => {
    const next = { ...dismissed, [id]: true };
    setDismissed(next);
    localStorage.setItem('dismissed_call_events', JSON.stringify(next));
  };

  if (visible.length === 0) return null;

  return (
    <div style={{ position: 'fixed', top: '80px', right: '20px', zIndex: 14000, maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Header bar */}
      <div
        onClick={() => setExpanded(p => !p)}
        style={{
          background: '#0d1b2a',
          border: `2px solid ${GOLD}`,
          borderRadius: '6px',
          padding: '8px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
          📅 Upcoming Calls ({visible.length})
        </span>
        <span style={{ color: '#6b7280', fontSize: '14px' }}>{expanded ? '▾' : '▸'}</span>
      </div>

      {/* Event cards */}
      {expanded && visible.map(m => {
        const startMs = new Date(m.meetingStartISO).getTime();
        const countdown = startMs - now;
        const isUrgent = countdown <= 5 * 60 * 1000; // 5 min
        const isNow = countdown <= 0;
        return (
          <div
            key={m.id}
            style={{
              background: '#0d1b2a',
              border: `2px solid ${isNow ? RED : isUrgent ? GOLD : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '6px',
              padding: '12px 14px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              animation: isUrgent ? 'pulse 1s infinite' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>
                  {m.leadName || 'Unknown Lead'}
                </div>
                <div style={{ color: '#8a9ab8', fontSize: '11px', marginTop: '2px' }}>
                  {fmtTime(m.meetingStartISO)} ET · 15 min
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); dismiss(m.id); }}
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '16px', padding: 0, lineHeight: 1, flexShrink: 0 }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{
                color: isNow ? RED : isUrgent ? GOLD : BLUE,
                fontSize: '12px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
              }}>
                {isNow ? '🔴 Call Now!' : `⏱ ${fmtCountdown(countdown)}`}
              </span>
              <a
                href={m.leadPhone ? `tel:${m.leadPhone}` : '#'}
                style={{
                  background: `linear-gradient(135deg,${GOLD},#22c55e)`,
                  color: DARK,
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                📞 Call
              </a>
            </div>
            {m.meetingNotes && (
              <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '6px', fontStyle: 'italic' }}>
                {m.meetingNotes.slice(0, 80)}
              </div>
            )}
          </div>
        );
      })}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>
    </div>
  );
}