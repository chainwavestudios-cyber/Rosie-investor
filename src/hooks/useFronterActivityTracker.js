/**
 * useFronterActivityTracker — tracks fronter activity for the admin activity log
 * and auto-logs-out fronters after 45 minutes of inactivity.
 *
 * - Logs every tab change to FronterActivityLog (with time spent on previous tab)
 * - Updates DialerSession.lastActivityAt on user interaction (throttled)
 * - After 45 min of no activity, calls onInactive(lastActivityISO) so the page
 *   can clock out at the last-activity time and log the auto-logout
 *
 * Only active for role === 'fronter'.
 */
import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const INACTIVITY_LIMIT_MS = 45 * 60 * 1000; // 45 minutes
const ACTIVITY_THROTTLE_MS = 10000; // update DB at most every 10 seconds
const CHECK_INTERVAL_MS = 30000; // check for inactivity every 30 seconds

export function useFronterActivityTracker({ username, role, tab, onInactive }) {
  const lastActivityRef = useRef(Date.now());
  const lastDbUpdateRef = useRef(0);
  const lastTabRef = useRef(tab);
  const tabChangeTimeRef = useRef(Date.now());
  const onInactiveRef = useRef(onInactive);

  // Keep latest onInactive without re-triggering the effect
  useEffect(() => { onInactiveRef.current = onInactive; }, [onInactive]);

  // Log tab changes to FronterActivityLog
  useEffect(() => {
    if (!username || role !== 'fronter') return;
    if (tab === lastTabRef.current) return;

    const now = Date.now();
    const durationOnPrevTab = Math.floor((now - tabChangeTimeRef.current) / 1000);

    base44.entities.FronterActivityLog.create({
      username,
      activityType: 'tab_change',
      tabName: tab,
      durationSeconds: durationOnPrevTab,
    }).catch(() => {});

    lastTabRef.current = tab;
    tabChangeTimeRef.current = now;
    // Tab change is also activity
    lastActivityRef.current = now;
  }, [tab, username, role]);

  // Track user interaction + inactivity check (single effect)
  useEffect(() => {
    if (!username || role !== 'fronter') return;

    const updateActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      if (now - lastDbUpdateRef.current > ACTIVITY_THROTTLE_MS) {
        lastDbUpdateRef.current = now;
        updateDialerSessionActivity(username);
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));

    // Initial activity ping
    updateActivity();

    // Inactivity checker
    const check = setInterval(() => {
      const inactiveMs = Date.now() - lastActivityRef.current;
      if (inactiveMs >= INACTIVITY_LIMIT_MS) {
        clearInterval(check);
        const lastISO = new Date(lastActivityRef.current).toISOString();
        onInactiveRef.current?.(lastISO);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
      clearInterval(check);
    };
  }, [username, role]);
}

async function updateDialerSessionActivity(username) {
  try {
    const sessions = await base44.entities.DialerSession.filter({
      username: { $regex: `^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    });
    if (sessions?.[0]) {
      await base44.entities.DialerSession.update(sessions[0].id, {
        lastActivityAt: new Date().toISOString(),
      });
    }
  } catch {}
}

/**
 * Clock out a fronter at a specific time (used for auto-logout at last activity).
 * Returns true if a time entry was updated.
 */
export async function clockOutAtTime(username, clockOutISO) {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const entries = await base44.entities.FronterTimeEntry.filter({ username, date: today });
    const entry = entries?.[0];
    if (!entry?.clockIn || entry?.clockOut) return false;

    const start = new Date(entry.clockIn);
    const end = new Date(clockOutISO);
    let total = Math.max(0, Math.floor((end - start) / 1000));
    if (entry.lunchOut && entry.lunchIn) {
      total -= Math.floor((new Date(entry.lunchIn) - new Date(entry.lunchOut)) / 1000);
      total = Math.max(0, total);
    }
    await base44.entities.FronterTimeEntry.update(entry.id, {
      clockOut: clockOutISO,
      totalSeconds: total,
    });
    return true;
  } catch { return false; }
}

/**
 * Log a single activity event.
 */
export async function logFronterActivity(username, activityType, details = '', tabName = '') {
  if (!username) return;
  try {
    await base44.entities.FronterActivityLog.create({
      username,
      activityType,
      tabName,
      details,
    });
  } catch {}
}