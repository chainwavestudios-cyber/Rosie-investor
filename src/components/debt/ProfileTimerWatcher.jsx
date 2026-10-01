/**
 * ProfileTimerWatcher.jsx — Watches for profile timers set in ClientProfileModal.
 * When a timer fires, shows a popup reminder with a button to reopen the profile.
 * Rendered at the DebtCallCoach level so it survives modal close.
 *
 * Timers stored in the database via debtCoachStorage: key 'profile_timers' = array of timer objects.
 * Exported functions (setProfileTimer, cancelProfileTimer, getActiveTimer, setEventReminders)
 * require a username parameter.
 */
import { useState, useEffect, useCallback } from 'react';
import { getDebtCoachValue, setDebtCoachValue, getCachedDebtCoachValue } from '@/lib/debtCoachStorage';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export function setProfileTimer(username, lead, hours, minutes) {
  if (!lead?.id || !username) return false;
  const ms = (Number(hours) || 0) * 3600000 + (Number(minutes) || 0) * 60000;
  if (ms < 60000) return false;
  const timer = {
    leadId: lead.id,
    leadSnapshot: { id: lead.id, firstName: lead.firstName, lastName: lead.lastName, phone: lead.phone },
    fireAt: Date.now() + ms,
    label: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Client',
  };
  const timers = getCachedDebtCoachValue(username, 'profile_timers', []) || [];
  // Replace any existing timer for this lead
  const filtered = timers.filter(t => t.leadId !== lead.id);
  setDebtCoachValue(username, 'profile_timers', [...filtered, timer]);
  window.dispatchEvent(new CustomEvent('profile_timer_set', { detail: timer }));
  return true;
}

export function setEventReminders(username, lead, eventISO, eventTitle) {
  if (!lead?.id || !eventISO || !username) return;
  const eventTime = new Date(eventISO).getTime();
  const reminders = [
    { offset: 3600000, label: '1 hour' },
    { offset: 300000, label: '5 minutes' },
  ];
  const timers = getCachedDebtCoachValue(username, 'profile_timers', []) || [];
  const newTimers = [];
  reminders.forEach((r) => {
    const fireAt = eventTime - r.offset;
    if (fireAt <= Date.now()) return;
    newTimers.push({
      leadId: lead.id,
      leadSnapshot: { id: lead.id, firstName: lead.firstName, lastName: lead.lastName, phone: lead.phone },
      fireAt,
      label: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Client',
      type: 'event',
      eventTitle: eventTitle || 'Scheduled Event',
      offsetLabel: r.label,
      timerKey: `evt_${Date.now()}_${r.offset}`,
    });
  });
  if (newTimers.length > 0) {
    setDebtCoachValue(username, 'profile_timers', [...timers, ...newTimers]);
    window.dispatchEvent(new CustomEvent('profile_timer_set'));
  }
}

export function cancelProfileTimer(username, leadId) {
  if (!username) return;
  const timers = getCachedDebtCoachValue(username, 'profile_timers', []) || [];
  const filtered = timers.filter(t => t.leadId !== leadId && !t.timerKey?.startsWith('evt_'));
  setDebtCoachValue(username, 'profile_timers', filtered);
  window.dispatchEvent(new CustomEvent('profile_timer_cancelled', { detail: { leadId } }));
}

export function getActiveTimer(username, leadId) {
  const timers = getCachedDebtCoachValue(username, 'profile_timers', []) || [];
  const timer = timers.find(t => t.leadId === leadId && t.fireAt > Date.now());
  return timer || null;
}

export default function ProfileTimerWatcher({ username, onOpenProfile }) {
  const [firedTimers, setFiredTimers] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [loaded, setLoaded] = useState(false);

  // Load timers from database on mount
  useEffect(() => {
    if (!username) return;
    getDebtCoachValue(username, 'profile_timers', []).then(() => setLoaded(true));
  }, [username]);

  // Tick every second
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Check all timers for fired ones
  const checkTimers = useCallback(() => {
    if (!username || !loaded) return;
    const timers = getCachedDebtCoachValue(username, 'profile_timers', []) || [];
    const fired = timers.filter(t => t.fireAt <= Date.now());
    if (fired.length === 0) return;
    // Remove fired timers from DB
    const remaining = timers.filter(t => t.fireAt > Date.now());
    setDebtCoachValue(username, 'profile_timers', remaining);
    setFiredTimers(prev => [...prev, ...fired]);
    // Try browser notification
    fired.forEach(t => {
      try {
        if (Notification.permission === 'granted') {
          new Notification('⏰ Profile Timer', { body: `Time to follow up with ${t.label}!` });
        }
      } catch {}
    });
  }, [username, loaded]);

  useEffect(() => {
    checkTimers();
    const interval = setInterval(checkTimers, 5000);
    return () => clearInterval(interval);
  }, [checkTimers]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const dismiss = (leadId) => setFiredTimers(prev => prev.filter(t => t.leadId !== leadId));
  const openProfile = (timer) => {
    onOpenProfile?.(timer.leadSnapshot);
    dismiss(timer.leadId);
  };

  if (firedTimers.length === 0) return null;

  return (
    <>
      {firedTimers.map(timer => (
        <div key={timer.leadId} style={{ position: 'fixed', bottom: `${24 + firedTimers.indexOf(timer) * 140}px`, right: '24px', background: '#0d1b2a', border: `2px solid ${GOLD}`, borderRadius: '8px', padding: '20px', maxWidth: '320px', boxShadow: '0 20px 80px rgba(0,0,0,0.9)', zIndex: 99999, fontFamily: 'Georgia, serif', animation: 'ptSlide 0.3s ease-out' }}>
          <style>{`@keyframes ptSlide{from{transform:translateY(400px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⏰ Profile Timer</span>
            <button onClick={() => dismiss(timer.leadId)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', padding: 0 }}>×</button>
          </div>
          {timer.type === 'event' ? (
            <>
              <p style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold', margin: '0 0 6px' }}>{timer.eventTitle}</p>
              <p style={{ color: '#6b7280', fontSize: '11px', margin: '0 0 12px' }}>Starts in {timer.offsetLabel} — with {timer.label}</p>
            </>
          ) : (
            <>
              <p style={{ color: '#e8e0d0', fontSize: '16px', fontWeight: 'bold', margin: '0 0 6px' }}>Follow up with {timer.label}</p>
              <p style={{ color: '#6b7280', fontSize: '11px', margin: '0 0 12px' }}>Timer set from Client Profile has expired.</p>
            </>
          )}
          <button onClick={() => openProfile(timer)} style={{ width: '100%', background: `linear-gradient(135deg, ${GOLD}, #22c55e)`, color: DARK, border: 'none', borderRadius: '4px', padding: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Open Profile →</button>
        </div>
      ))}
    </>
  );
}