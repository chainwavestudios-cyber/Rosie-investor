/**
 * debtCoachStorage.js — Database-backed key-value storage for the Debt Call Coach module.
 * Replaces localStorage with a per-user JSON blob stored in the DebtCoachUserSetting entity.
 * All get/set calls are async; saves are debounced (1.5s) to avoid excessive database writes.
 *
 * Usage:
 *   import { useDebtCoachValue, setDebtCoachValue, removeDebtCoachValue, getAllDebtCoachValues, setAllDebtCoachValues } from '@/lib/debtCoachStorage';
 *
 *   // In a component (hook — handles async load + state):
 *   const [value, setValue] = useDebtCoachValue(username, 'myKey', defaultValue);
 *
 *   // Imperative (fire-and-forget save):
 *   await setDebtCoachValue(username, 'myKey', { x: 10, y: 20 });
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// In-memory cache: username -> { data: {}, id: string|null, loaded: boolean }
const cache = {};
// Debounce timers: username -> timeout
const saveTimers = {};
// Listeners for cross-component sync: key -> Set<callback>
const listeners = {};

async function ensureLoaded(username) {
  if (!username) return null;
  if (cache[username]?.loaded) return cache[username];
  try {
    const rows = await base44.entities.DebtCoachUserSetting.filter({ username });
    if (rows?.length > 0) {
      cache[username] = { data: JSON.parse(rows[0].settingsJson || '{}'), id: rows[0].id, loaded: true };
    } else {
      cache[username] = { data: {}, id: null, loaded: true };
    }
  } catch {
    cache[username] = { data: {}, id: null, loaded: true };
  }
  return cache[username];
}

function notifyListeners(username, key, value) {
  const fullKey = `${username}:${key}`;
  if (listeners[fullKey]) {
    listeners[fullKey].forEach(cb => cb(value));
  }
}

function scheduleSave(username) {
  if (saveTimers[username]) clearTimeout(saveTimers[username]);
  saveTimers[username] = setTimeout(async () => {
    const entry = cache[username];
    if (!entry) return;
    try {
      const json = JSON.stringify(entry.data);
      if (entry.id) {
        await base44.entities.DebtCoachUserSetting.update(entry.id, { settingsJson: json });
      } else {
        const created = await base44.entities.DebtCoachUserSetting.create({ username, settingsJson: json });
        entry.id = created.id;
      }
    } catch (e) {
      console.error('Failed to save DebtCoachUserSetting:', e);
    }
  }, 1500);
}

/**
 * Get a single value from database-backed storage.
 * @returns Promise<any> — resolves to the value or defaultValue
 */
export async function getDebtCoachValue(username, key, defaultValue = null) {
  const entry = await ensureLoaded(username);
  if (!entry) return defaultValue;
  return key in entry.data ? entry.data[key] : defaultValue;
}

/**
 * Synchronous read from the in-memory cache. Returns defaultValue if the
 * cache hasn't loaded yet. Use this only for cases where you need a sync read
 * (e.g., timer functions) — prefer getDebtCoachValue for normal usage.
 */
export function getCachedDebtCoachValue(username, key, defaultValue = null) {
  if (!username || !cache[username]?.loaded) return defaultValue;
  return key in cache[username].data ? cache[username].data[key] : defaultValue;
}

/**
 * Set a single value in database-backed storage (debounced save).
 */
export async function setDebtCoachValue(username, key, value) {
  const entry = await ensureLoaded(username);
  if (!entry) return;
  entry.data[key] = value;
  notifyListeners(username, key, value);
  scheduleSave(username);
}

/**
 * Remove a single value from database-backed storage.
 */
export async function removeDebtCoachValue(username, key) {
  const entry = await ensureLoaded(username);
  if (!entry) return;
  delete entry.data[key];
  notifyListeners(username, key, null);
  scheduleSave(username);
}

/**
 * Get ALL key-value pairs for a user (for layout save/load).
 * @returns Promise<object> — all settings as a flat key->value map
 */
export async function getAllDebtCoachValues(username) {
  const entry = await ensureLoaded(username);
  if (!entry) return {};
  return { ...entry.data };
}

/**
 * Set multiple key-value pairs at once (for layout restore).
 * @param username string
 * @param values object — key->value pairs to merge into existing settings
 */
export async function setAllDebtCoachValues(username, values) {
  const entry = await ensureLoaded(username);
  if (!entry) return;
  entry.data = { ...entry.data, ...values };
  // Notify all listeners for changed keys
  for (const [key, value] of Object.entries(values)) {
    notifyListeners(username, key, value);
  }
  // Save immediately (not debounced) — this is an explicit save/restore action
  if (saveTimers[username]) clearTimeout(saveTimers[username]);
  try {
    const json = JSON.stringify(entry.data);
    if (entry.id) {
      await base44.entities.DebtCoachUserSetting.update(entry.id, { settingsJson: json });
    } else {
      const created = await base44.entities.DebtCoachUserSetting.create({ username, settingsJson: json });
      entry.id = created.id;
    }
  } catch (e) {
    console.error('Failed to save DebtCoachUserSetting:', e);
  }
}

/**
 * React hook for a single database-backed value.
 * Handles async load + state + cross-component sync.
 *
 * @param username string — current user's username
 * @param key string — storage key
 * @param defaultValue any — initial value before DB loads
 * @returns [value, setValue] — value is defaultValue until DB loads, setValue persists to DB
 */
export function useDebtCoachValue(username, key, defaultValue = null) {
  const [value, setValue] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);

  // Load from DB on mount / when username or key changes
  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setLoaded(false);
    getDebtCoachValue(username, key, defaultValue).then(v => {
      if (!cancelled) { setValue(v); setLoaded(true); }
    });
    // Listen for cross-component updates
    const fullKey = `${username}:${key}`;
    if (!listeners[fullKey]) listeners[fullKey] = new Set();
    const handler = (newVal) => { if (!cancelled) setValue(newVal); };
    listeners[fullKey].add(handler);
    return () => {
      cancelled = true;
      if (listeners[fullKey]) listeners[fullKey].delete(handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, key]);

  const update = (newVal) => {
    setValue(newVal);
    if (username) setDebtCoachValue(username, key, newVal);
  };

  return [value, update, loaded];
}