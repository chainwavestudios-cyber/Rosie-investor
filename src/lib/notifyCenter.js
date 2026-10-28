/**
 * notifyCenter.js — the one place alerts get recorded.
 *
 * Every popup / chime in the app now writes here instead of making noise:
 * the browser never gets a sound, and the alert is kept in the Notifications tab.
 */
import { base44 } from '@/api/base44Client';

let cache = [];
const listeners = new Set();

const emit = () => listeners.forEach((fn) => { try { fn(cache); } catch { /* listener gone */ } });

/** Record a notification. Silent by design — this replaces every beep. */
export function logNotification({ title, body = '', type = 'system', source = '', linkPath = '' } = {}) {
  if (!title) return;
  const draft = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title, body, type, source, linkPath, read: false,
    created_date: new Date().toISOString(),
  };
  cache = [draft, ...cache].slice(0, 40);
  emit();
  base44.entities.AppNotification.create({ title, body, type, source, linkPath, read: false })
    .then((rec) => {
      cache = cache.map((n) => (n.id === draft.id ? { ...rec, read: false } : n));
      emit();
    })
    .catch(() => { /* unauthenticated portal context — the tab will show what it can */ });
}

/** Live unread feed for the bell. Returns an unsubscribe function. */
export function subscribeNotifications(fn) {
  listeners.add(fn);
  fn(cache);
  return () => listeners.delete(fn);
}