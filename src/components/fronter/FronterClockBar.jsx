/**
 * FronterClockBar.jsx — Clock in/out and lunch tracking bar for the fronter header.
 * Shows current status and buttons: Clock In, Lunch Out, Lunch In, Clock Out.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const GREEN = '#4ade80';

function getETDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: '2-digit',
  });
}

function calcTotal(entry, nowIso) {
  if (!entry?.clockIn) return 0;
  const end = entry.clockOut ? new Date(entry.clockOut) : new Date(nowIso);
  const start = new Date(entry.clockIn);
  let total = (end - start) / 1000;
  if (entry.lunchOut && entry.lunchIn) {
    total -= (new Date(entry.lunchIn) - new Date(entry.lunchOut)) / 1000;
  }
  return Math.max(0, Math.floor(total));
}

export default function FronterClockBar({ username }) {
  const [entry, setEntry] = useState(null);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const today = getETDate();

  const load = useCallback(async () => {
    try {
      const entries = await base44.entities.FronterTimeEntry.filter({ username, date: today });
      setEntry(entries?.[0] || null);
    } catch {}
    setLoading(false);
  }, [username, today]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  const clockIn = async () => {
    try {
      if (entry) {
        await base44.entities.FronterTimeEntry.update(entry.id, { clockIn: new Date().toISOString(), clockOut: null, lunchOut: null, lunchIn: null, totalSeconds: 0 });
      } else {
        await base44.entities.FronterTimeEntry.create({ username, date: today, clockIn: new Date().toISOString() });
      }
      load();
    } catch (e) { alert('Clock in failed: ' + (e?.message || String(e))); }
  };

  const lunchOut = async () => {
    if (!entry?.id) return;
    try { await base44.entities.FronterTimeEntry.update(entry.id, { lunchOut: new Date().toISOString() }); load(); } catch {}
  };

  const lunchIn = async () => {
    if (!entry?.id) return;
    try { await base44.entities.FronterTimeEntry.update(entry.id, { lunchIn: new Date().toISOString() }); load(); } catch {}
  };

  const clockOut = async () => {
    if (!entry?.id) return;
    const nowIso = new Date().toISOString();
    const total = calcTotal(entry, nowIso);
    try { await base44.entities.FronterTimeEntry.update(entry.id, { clockOut: nowIso, totalSeconds: total }); load(); } catch {}
  };

  const isClockedIn = !!entry?.clockIn && !entry?.clockOut;
  const onLunch = !!entry?.lunchOut && !entry?.lunchIn;
  const isClockedOut = !!entry?.clockOut;
  const liveTotal = isClockedIn ? calcTotal(entry, now.toISOString()) : (entry?.totalSeconds || 0);
  const fmtDur = (s) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

  let statusColor = '#6b7280';
  let statusLabel = 'Not Clocked In';
  if (onLunch) { statusColor = AMBER; statusLabel = '🍽️ On Lunch'; }
  else if (isClockedIn) { statusColor = GREEN; statusLabel = '🟢 Clocked In'; }
  else if (isClockedOut) { statusColor = '#6b7280'; statusLabel = '⏹ Clocked Out'; }

  const btn = (bg, color, label, onClick, disabled) => ({
    background: bg, color, border: `1px solid ${color}44`, borderRadius: '4px', padding: '5px 10px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '10px', fontWeight: 'bold', opacity: disabled ? 0.4 : 1, fontFamily: 'Georgia, serif', whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '0 12px', borderLeft: '1px solid rgba(255,255,255,0.07)', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', background: `${statusColor}18`, border: `1px solid ${statusColor}44`, borderRadius: '4px' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, animation: isClockedIn && !onLunch ? 'pulse 1.5s infinite' : 'none' }} />
        <span style={{ color: statusColor, fontSize: '10px', fontWeight: 'bold' }}>{statusLabel}</span>
      </span>
      {isClockedIn && !onLunch && <span style={{ color: GREEN, fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold' }}>{fmtDur(liveTotal)}</span>}
      {!isClockedIn && !isClockedOut && (
        <button onClick={clockIn} style={btn('rgba(74,222,128,0.15)', GREEN, '🕐 Clock In', false)}>🕐 Clock In</button>
      )}
      {isClockedIn && !onLunch && !entry?.lunchOut && (
        <button onClick={lunchOut} style={btn('rgba(245,158,11,0.15)', AMBER, '🍽️ Lunch Out', false)}>🍽️ Lunch Out</button>
      )}
      {onLunch && (
        <button onClick={lunchIn} style={btn('rgba(74,222,128,0.15)', GREEN, '🍽️ Lunch In', false)}>🍽️ Lunch In</button>
      )}
      {isClockedIn && !entry?.clockOut && (
        <button onClick={clockOut} style={btn('rgba(239,68,68,0.15)', RED, '⏹ Clock Out', false)}>⏹ Clock Out</button>
      )}
      {entry?.clockIn && (
        <span style={{ color: '#6b7280', fontSize: '9px' }}>in {fmtTime(entry.clockIn)}{entry?.lunchOut ? ` · lunch ${fmtTime(entry.lunchOut)}–${fmtTime(entry.lunchIn)}` : ''}{entry?.clockOut ? ` · out ${fmtTime(entry.clockOut)}` : ''}</span>
      )}
    </div>
  );
}