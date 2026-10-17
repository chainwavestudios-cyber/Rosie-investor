/**
 * DualClockBar.jsx — Live dual-clock strip shown at the top of dashboards.
 * Fronters see: Eastern Time + their own timezone.
 * Super admins see: Eastern Time + Philippine Time (GMT+8).
 */
import { useState, useEffect } from 'react';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';

const COMMON_TIMEZONES = [
  { id: 'America/New_York', label: 'Eastern (ET)', short: 'ET' },
  { id: 'America/Chicago', label: 'Central (CT)', short: 'CT' },
  { id: 'America/Denver', label: 'Mountain (MT)', short: 'MT' },
  { id: 'America/Los_Angeles', label: 'Pacific (PT)', short: 'PT' },
  { id: 'Asia/Manila', label: 'Philippine (PHT)', short: 'PHT' },
  { id: 'Asia/Karachi', label: 'Pakistan (PKT)', short: 'PKT' },
  { id: 'Asia/Kolkata', label: 'India (IST)', short: 'IST' },
  { id: 'Europe/London', label: 'UK (GMT)', short: 'GMT' },
  { id: 'Australia/Sydney', label: 'Sydney (AEDT)', short: 'AEDT' },
];

export function tzLabel(tz) {
  const found = COMMON_TIMEZONES.find(t => t.id === tz);
  return found ? found.short : (tz || 'ET').split('/').pop().replace('_', ' ');
}

export function formatTz(date, tz) {
  try {
    return date.toLocaleString('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return date.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  }
}

export function tzOffsetLabel(tz) {
  try {
    const now = new Date();
    const tzStr = now.toLocaleString('en-US', { timeZone: tz, hour12: false });
    const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
    const tzDate = new Date(tzStr + ' UTC');
    const utcDate = new Date(utcStr + ' UTC');
    const offsetMs = tzDate.getTime() - utcDate.getTime();
    const offsetH = Math.round(offsetMs / 3600000);
    const sign = offsetH >= 0 ? '+' : '';
    return `GMT${sign}${offsetH}`;
  } catch {
    return '';
  }
}

export default function DualClockBar({ userTimezone, isSuperAdmin }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const etTime = formatTz(now, 'America/New_York');
  const etOffset = tzOffsetLabel('America/New_York');

  // Super admins always see Philippine Time (GMT+8) as the second clock
  const secondTz = isSuperAdmin ? 'Asia/Manila' : (userTimezone || 'America/New_York');
  const secondTime = formatTz(now, secondTz);
  const secondOffset = tzOffsetLabel(secondTz);
  const secondLabel = isSuperAdmin ? 'Philippine Time' : 'Your Time';

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '32px',
      padding: '6px 24px',
      background: 'rgba(0,0,0,0.25)',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      fontSize: '13px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: BLUE, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🇺🇸 Eastern {etOffset}</span>
        <span style={{ color: '#f0ece0', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums', minWidth: '180px', textAlign: 'center' }}>{etTime}</span>
      </div>
      <span style={{ color: '#4a5568' }}>|</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: isSuperAdmin ? PURPLE : GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
          {isSuperAdmin ? '🇵🇭' : '🌐'} {secondLabel} {secondOffset}
        </span>
        <span style={{ color: '#f0ece0', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums', minWidth: '180px', textAlign: 'center' }}>{secondTime}</span>
      </div>
    </div>
  );
}