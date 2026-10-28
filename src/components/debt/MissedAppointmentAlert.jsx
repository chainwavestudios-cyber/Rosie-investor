/**
 * MissedAppointmentAlert.jsx — Polls calendar events every 15 minutes
 * (10am–10pm ET, Mon–Sat). For any appointment whose time has passed
 * without a green checkmark, shows an urgent popup with rotating red LED
 * lights and an audible alert.
 *
 * Completion state is stored in localStorage keyed by event ID.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { logNotification } from '@/lib/notifyCenter';

const RED = '#ef4444';
const GOLD = '#10b981';
const DARK = '#0a0f1e';

function isWithinScheduleWindow() {
  const now = new Date();
  const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = etNow.getDay(); // 0=Sun, 6=Sat
  const hour = etNow.getHours();
  // Mon–Sat (1–6), 10am–10pm
  if (day === 0) return false;
  if (hour < 10 || hour >= 22) return false;
  return true;
}

export default function MissedAppointmentAlert({ onOpenLead }) {
  const [missedEvents, setMissedEvents] = useState([]);
  const [completed, setCompleted] = useState(() => {
    try { return JSON.parse(localStorage.getItem('appt_completed') || '{}'); } catch { return {}; }
  });
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('missed_appt_dismissed') || '{}'); } catch { return {}; }
  });
  // Silent by design — each missed appointment is recorded in the Notifications tab.
  const loggedRef = useRef(new Set());
  const startTone = useCallback((events) => {
    (events || []).forEach((ev) => {
      if (!ev?.id || loggedRef.current.has(ev.id)) return;
      loggedRef.current.add(ev.id);
      logNotification({
        title: 'Missed appointment',
        body: `${ev.title || 'Appointment'} — nobody has marked it complete.`,
        type: 'missed_appointment',
        source: 'Debt Call Coach',
        linkPath: '/debt-call-coach',
      });
    });
  }, []);

  const stopTone = useCallback(() => {}, []);

  const checkMissed = useCallback(async () => {
    if (!isWithinScheduleWindow()) return;
    try {
      const res = await base44.functions.invoke('listCalendarEvents', { days: 1 });
      const data = res?.data || res;
      const events = data?.events || [];
      const now = Date.now();
      const missed = [];
      for (const ev of events) {
        if (completed[ev.id]) continue;
        if (dismissed[ev.id]) continue;
        const startMs = new Date(ev.startISO || ev.start?.dateTime || ev.start?.date || '').getTime();
        if (isNaN(startMs)) continue;
        // Appointment time has passed (more than 1 min ago)
        if (startMs < now - 60000) {
          missed.push(ev);
        }
      }
      setMissedEvents(missed);
      if (missed.length > 0) startTone(missed);
      else stopTone();
    } catch {}
  }, [completed, dismissed, startTone, stopTone]);

  useEffect(() => {
    checkMissed();
    const interval = setInterval(checkMissed, 15 * 60 * 1000); // every 15 min
    return () => { clearInterval(interval); stopTone(); };
  }, [checkMissed, stopTone]);

  // Also re-check when completed/dismissed changes
  useEffect(() => { checkMissed(); }, [completed, dismissed, checkMissed]);

  const markCompleted = (ev) => {
    const next = { ...completed, [ev.id]: true };
    setCompleted(next);
    localStorage.setItem('appt_completed', JSON.stringify(next));
  };

  const dismiss = (ev) => {
    stopTone();
    const next = { ...dismissed, [ev.id]: true };
    setDismissed(next);
    localStorage.setItem('missed_appt_dismissed', JSON.stringify(next));
    // Immediately remove from the displayed popup — don't wait for the async
    // checkMissed backend call to re-filter.
    setMissedEvents(prev => prev.filter(e => e.id !== ev.id));
  };

  // Clean up dismissed entries older than 24h
  useEffect(() => {
    const now = Date.now();
    let changed = false;
    const cleaned = {};
    for (const [id, ts] of Object.entries(dismissed)) {
      if (typeof ts === 'string') {
        const t = new Date(ts).getTime();
        if (!isNaN(t) && now - t < 24 * 60 * 60 * 1000) cleaned[id] = ts;
        else changed = true;
      } else if (ts === true) {
        cleaned[id] = new Date().toISOString();
      } else {
        cleaned[id] = ts;
      }
    }
    if (changed) {
      localStorage.setItem('missed_appt_dismissed', JSON.stringify(cleaned));
    }
  }, []);

  if (missedEvents.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes missed-led-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes missed-led-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(239,68,68,0.6), 0 0 40px rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 30px rgba(239,68,68,0.9), 0 0 60px rgba(239,68,68,0.6); }
        }
        .missed-led-container {
          position: relative;
          border-radius: 12px;
          padding: 3px;
        }
        .missed-led-ring {
          position: absolute;
          inset: -4px;
          border-radius: 14px;
          background: conic-gradient(from 0deg, ${RED}, transparent, ${RED}, transparent, ${RED}, transparent, ${RED}, transparent);
          animation: missed-led-spin 2s linear infinite;
          z-index: -1;
        }
        .missed-led-inner {
          background: #0a0f1e;
          border-radius: 10px;
          position: relative;
          z-index: 1;
        }
      `}</style>
      {missedEvents.map(ev => (
        <div key={ev.id} style={{
          position: 'fixed', bottom: '20px', right: '20px', zIndex: 99999,
          maxWidth: '400px',
        }}>
          <div className="missed-led-container" style={{ animation: 'missed-led-pulse 1.5s ease-in-out infinite' }}>
            <div className="missed-led-ring" />
            <div className="missed-led-inner" style={{ padding: '20px 24px' }}>
              <button
                onClick={() => dismiss(ev)}
                aria-label="Close"
                style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(239,68,68,0.15)', color: RED, border: `1px solid ${RED}55`, borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, zIndex: 2 }}
              >×</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', paddingRight: '20px' }}>
                <span style={{ fontSize: '32px' }}>🚨</span>
                <div>
                  <div style={{ color: RED, fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px' }}>MISSED APPOINTMENT</div>
                  <div style={{ color: '#8a9ab8', fontSize: '11px' }}>Time has passed — no completion checkmark</div>
                </div>
              </div>
              <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>{ev.title}</div>
              <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '14px' }}>
                ⏰ {ev.timeLabel} · {ev.dayLabel}
                {ev.attendees?.length > 0 && <div style={{ marginTop: '4px' }}>✉ {ev.attendees.join(', ')}</div>}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {onOpenLead && (
                  <button
                    onClick={() => onOpenLead(ev)}
                    style={{
                      flex: 1, background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: DARK,
                      border: 'none', borderRadius: '6px', padding: '10px 16px', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase',
                    }}
                  >
                    📇 Open Contact
                  </button>
                )}
                <button
                  onClick={() => markCompleted(ev)}
                  style={{
                    flex: 1, background: 'rgba(16,185,129,0.15)', color: GOLD,
                    border: `2px solid ${GOLD}`, borderRadius: '6px', padding: '10px 16px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase',
                  }}
                >
                  ✓ Mark Completed
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}