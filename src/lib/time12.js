/**
 * time12.js — the clock every campaign screen reads and collects.
 *
 * Campaign records keep their times as 24-hour "HH:MM" (the send engines parse
 * that), so these helpers convert both ways: what an operator reads or types is
 * always 12-hour AM/PM, and what gets stored never changes shape.
 */

export const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

// "08:00" → { h: 8, m: 0 }; anything unreadable → null
export function parse24(value) {
  const [hRaw, mRaw] = String(value ?? '').split(':');
  const h = parseInt(hRaw, 10);
  if (Number.isNaN(h)) return null;
  const m = parseInt(mRaw, 10);
  return { h: Math.min(23, Math.max(0, h)), m: Number.isNaN(m) ? 0 : Math.min(59, Math.max(0, m)) };
}

// 12-hour parts → the stored 24-hour "HH:MM"
export function to24(hour12, minute, meridiem) {
  const h = (Number(hour12) % 12) + (String(meridiem).toUpperCase() === 'PM' ? 12 : 0);
  const m = Number(minute);
  return `${String(h).padStart(2, '0')}:${String(Number.isNaN(m) ? 0 : m).padStart(2, '0')}`;
}

// "20:00" → "8:00 PM"
export function fmt12(value, fallback = '—') {
  const parsed = parse24(value);
  if (!parsed) return fallback;
  const hour = parsed.h % 12 === 0 ? 12 : parsed.h % 12;
  return `${hour}:${String(parsed.m).padStart(2, '0')} ${parsed.h < 12 ? 'AM' : 'PM'}`;
}

// "8:00 AM – 8:00 PM"
export function fmt12Range(start, end) {
  return `${fmt12(start)} – ${fmt12(end)}`;
}

// Any date/time value → "Oct 26, 8:17 PM" (12-hour whatever the machine's locale)
export function fmtDateTime(value, { date = true } = {}) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (!date) return time;
  return `${d.toLocaleString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}