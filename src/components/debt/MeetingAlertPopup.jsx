/**
 * MeetingAlertPopup.jsx — Polls calendar events and triggers a popup with
 * an audible tone when a meeting is 5 minutes away. Must be manually dismissed.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { logNotification } from '@/lib/notifyCenter';

const RED = '#ef4444';
const GOLD = '#10b981';
const AMBER = '#f59e0b';
const DARK = '#0a0f1e';

export default function MeetingAlertPopup() {
  const [alert, setAlert] = useState(null);
  const [dismissed, setDismissed] = useState({}); // eventId -> true


  // Silent by design — the meeting is recorded in the Notifications tab, no tone.
  const loggedRef = useRef(new Set());
  const startTone = (ev) => {
    if (!ev?.id || loggedRef.current.has(ev.id)) return;
    loggedRef.current.add(ev.id);
    logNotification({
      title: `Meeting in ${Math.max(0, Math.round(ev.minutesAway || 0))} min`,
      body: ev.title || 'A calendar meeting is starting.',
      type: 'meeting',
      source: 'Debt Call Coach',
      linkPath: '/debt-call-coach',
    });
  };

  const stopTone = () => {};

  // Poll calendar events every 30s
  useEffect(() => {
    const check = async () => {
      try {
        const res = await base44.functions.invoke('listCalendarEvents', { days: 1 });
        const data = res?.data || res;
        const events = data?.events || [];
        const now = Date.now();
        for (const ev of events) {
          if (dismissed[ev.id]) continue;
          // Skip fronter-originated events — /fronter is the enrollment center
          // with its own auth system; those notifications belong there, not here.
          const evTitle = ev.title || '';
          if (evTitle.includes('Follow-Up Opened') || evTitle.startsWith('Follow-up Call —')) continue;
          const startMs = new Date(ev.start?.dateTime || ev.start?.date || ev.startTime || '').getTime();
          if (isNaN(startMs)) continue;
          const diffMin = (startMs - now) / 60000;
          // Alert when meeting is within 5 minutes (and not already started > 2 min ago)
          if (diffMin <= 5 && diffMin >= -2) {
            const upcoming = { ...ev, minutesAway: Math.round(diffMin) };
            setAlert(upcoming);
            startTone(upcoming);
            break;
          }
        }
      } catch (e) { /* ignore */ }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => { clearInterval(interval); stopTone(); };
  }, [dismissed]);

  // Cleanup on unmount
  useEffect(() => () => { stopTone(); }, []);

  const handleDismiss = () => {
    stopTone();
    if (alert?.id) setDismissed(prev => ({ ...prev, [alert.id]: true }));
    setAlert(null);
  };

  if (!alert) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '20px', right: '20px', zIndex: 99999,
      background: `linear-gradient(135deg,rgba(239,68,68,0.95),rgba(245,158,11,0.95))`,
      border: `2px solid ${GOLD}`, borderRadius: '8px', padding: '18px 22px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 40px rgba(239,68,68,0.4)',
      maxWidth: '380px', animation: 'pulse 1s ease-in-out infinite',
    }}>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '28px' }}>🔔</span>
        <div>
          <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>Meeting Starting Soon!</div>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px' }}>
            {alert.minutesAway > 0 ? `In ${alert.minutesAway} minute${alert.minutesAway !== 1 ? 's' : ''}` : 'Starting now!'}
          </div>
        </div>
      </div>
      <div style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>{alert.title}</div>
      {alert.timeLabel && <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '11px', marginBottom: '8px' }}>⏰ {alert.timeLabel}</div>}
      {alert.attendees?.length > 0 && <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '10px', marginBottom: '8px' }}>✉ {alert.attendees.join(', ')}</div>}
      <button
        onClick={handleDismiss}
        style={{
          background: DARK, color: GOLD, border: 'none', borderRadius: '4px',
          padding: '8px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
          width: '100%', letterSpacing: '1px', textTransform: 'uppercase',
        }}
      >
        🔇 Dismiss Alert
      </button>
    </div>
  );
}