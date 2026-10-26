/**
 * Time12Picker.jsx — the one clock control the campaign screens use.
 *
 * Shows and collects a time as 12-hour AM/PM, and hands back the 24-hour
 * "HH:MM" string the campaign records store, so the send engines keep reading
 * exactly what they always have.
 */
import { HOURS_12, MINUTES, parse24, to24 } from '@/lib/time12';

export default function Time12Picker({ value, onChange, inputStyle }) {
  const stored = parse24(value) || { h: 8, m: 0 };
  const meridiem = stored.h < 12 ? 'AM' : 'PM';
  const hour = stored.h % 12 === 0 ? 12 : stored.h % 12;
  const minute = String(stored.m).padStart(2, '0');
  const minutes = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort();

  const pick = { ...(inputStyle || {}), width: '100%', minWidth: 0, flex: '1 1 0' };
  const tail = { ...(inputStyle || {}), flex: '0 0 auto' };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <select aria-label="Hour" value={hour} onChange={(e) => onChange(to24(e.target.value, minute, meridiem))} style={pick}>
        {HOURS_12.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span style={{ color: '#6b7280', fontSize: '12px' }}>:</span>
      <select aria-label="Minute" value={minute} onChange={(e) => onChange(to24(hour, e.target.value, meridiem))} style={pick}>
        {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <select aria-label="AM or PM" value={meridiem} onChange={(e) => onChange(to24(hour, minute, e.target.value))} style={tail}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}