/**
 * FronterClockBar.jsx — Clock in/out, lunch, and break tracking bar.
 * Buttons: Clock In, Lunch Out/In, AM Break Out/In, PM Break Out/In, Clock Out.
 * Supports multiple clock-in/out cycles per day: each completed session is
 * archived into sessionsJson, and totalSeconds accumulates across all sessions.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const GREEN = '#4ade80';
const CYAN = '#22d3ee';
const PURPLE = '#a78bfa';
const BLUE = '#60a5fa';

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

// Subtract a break interval (out→in) from the total, if both timestamps exist
function subtractBreak(total, outIso, inIso, nowIso) {
  if (!outIso) return total;
  const end = inIso ? new Date(inIso) : new Date(nowIso);
  const start = new Date(outIso);
  return total - (end - start) / 1000;
}

function calcTotal(entry, nowIso) {
  if (!entry?.clockIn) return 0;
  const end = entry.clockOut ? new Date(entry.clockOut) : new Date(nowIso);
  const start = new Date(entry.clockIn);
  let total = (end - start) / 1000;
  total = subtractBreak(total, entry.lunchOut, entry.lunchIn, nowIso);
  total = subtractBreak(total, entry.amBreakOut, entry.amBreakIn, nowIso);
  total = subtractBreak(total, entry.pmBreakOut, entry.pmBreakIn, nowIso);
  return Math.max(0, Math.floor(total));
}

function archivedSessions(entry) {
  try { return JSON.parse(entry?.sessionsJson || '[]') || []; } catch { return []; }
}

function sumSessions(entry) {
  return archivedSessions(entry).reduce((s, x) => s + (x.totalSeconds || 0), 0);
}

// Retry a DB operation a few times — transient MongoDB timeouts (network blips,
// cluster failovers) resolve within a few seconds and shouldn't fail a clock-in.
async function withRetry(fn, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 1500)); }
  }
  throw lastErr;
}

export default function FronterClockBar({ username }) {
  const [entry, setEntry] = useState(null);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
    if (busy) return;
    setBusy(true);
    try {
      const nowIso = new Date().toISOString();
      await withRetry(async () => {
        if (entry?.id && entry.clockIn && entry.clockOut) {
          const sessions = [...archivedSessions(entry), { clockIn: entry.clockIn, clockOut: entry.clockOut, totalSeconds: calcTotal(entry, entry.clockOut) }];
          await base44.entities.FronterTimeEntry.update(entry.id, {
            sessionsJson: JSON.stringify(sessions),
            clockIn: nowIso, clockOut: null,
            lunchOut: null, lunchIn: null,
            amBreakOut: null, amBreakIn: null,
            pmBreakOut: null, pmBreakIn: null,
          });
        } else if (entry?.id) {
          await base44.entities.FronterTimeEntry.update(entry.id, { clockIn: nowIso, clockOut: null });
        } else {
          await base44.entities.FronterTimeEntry.create({ username, date: today, clockIn: nowIso });
        }
      });
      load();
    } catch (e) { alert('Clock in failed: ' + (e?.message || String(e))); }
    setBusy(false);
  };

  const stamp = async (field) => {
    if (!entry?.id || busy) return;
    setBusy(true);
    try {
      await withRetry(() => base44.entities.FronterTimeEntry.update(entry.id, { [field]: new Date().toISOString() }));
      load();
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
    setBusy(false);
  };

  const clockOut = async () => {
    if (!entry?.id || busy) return;
    setBusy(true);
    const nowIso = new Date().toISOString();
    const total = sumSessions(entry) + calcTotal(entry, nowIso);
    try { await withRetry(() => base44.entities.FronterTimeEntry.update(entry.id, { clockOut: nowIso, totalSeconds: total })); load(); } catch (e) { alert('Clock out failed: ' + (e?.message || String(e))); }
    setBusy(false);
  };

  const isClockedIn = !!entry?.clockIn && !entry?.clockOut;
  const onLunch = !!entry?.lunchOut && !entry?.lunchIn;
  const onAmBreak = !!entry?.amBreakOut && !entry?.amBreakIn;
  const onPmBreak = !!entry?.pmBreakOut && !entry?.pmBreakIn;
  const isClockedOut = !!entry?.clockOut;
  const priorSessions = archivedSessions(entry);
  const liveTotal = isClockedIn ? sumSessions(entry) + calcTotal(entry, now.toISOString()) : (entry?.totalSeconds || 0);
  const fmtDur = (s) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

  // Determine current status
  let statusColor = '#6b7280';
  let statusLabel = 'Not Clocked In';
  if (onLunch) { statusColor = AMBER; statusLabel = '🍽️ On Lunch'; }
  else if (onAmBreak) { statusColor = CYAN; statusLabel = '☕ AM Break'; }
  else if (onPmBreak) { statusColor = PURPLE; statusLabel = '☕ PM Break'; }
  else if (isClockedIn) { statusColor = GREEN; statusLabel = '🟢 Clocked In'; }
  else if (isClockedOut) { statusColor = '#6b7280'; statusLabel = '⏹ Clocked Out'; }

  const onBreak = onLunch || onAmBreak || onPmBreak;

  const btn = (bg, color, label) => ({
    background: bg, color, border: `1px solid ${color}44`, borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', fontFamily: 'Georgia, serif', whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '0 12px', borderLeft: '1px solid rgba(255,255,255,0.07)', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', background: `${statusColor}18`, border: `1px solid ${statusColor}44`, borderRadius: '4px' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, animation: isClockedIn && !onBreak ? 'pulse 1.5s infinite' : 'none' }} />
        <span style={{ color: statusColor, fontSize: '10px', fontWeight: 'bold' }}>{statusLabel}</span>
      </span>
      {isClockedIn && !onBreak && <span style={{ color: GREEN, fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold' }}>{fmtDur(liveTotal)}</span>}
      {!isClockedIn && (
        <button onClick={clockIn} disabled={busy} style={{ ...btn('rgba(74,222,128,0.15)', GREEN), opacity: busy ? 0.5 : 1, cursor: busy ? 'wait' : 'pointer' }}>{busy ? '⏳ …' : '🕐'} {isClockedOut ? 'Clock In Again' : 'Clock In'}</button>
      )}
      {isClockedIn && !onBreak && !entry?.lunchOut && (
        <button onClick={() => stamp('lunchOut')} style={btn('rgba(245,158,11,0.15)', AMBER)}>🍽️ Lunch Out</button>
      )}
      {onLunch && (
        <button onClick={() => stamp('lunchIn')} style={btn('rgba(74,222,128,0.15)', GREEN)}>🍽️ Lunch In</button>
      )}
      {isClockedIn && !onBreak && !entry?.amBreakOut && (
        <button onClick={() => stamp('amBreakOut')} style={btn('rgba(34,211,238,0.15)', CYAN)}>☕ AM Break Out</button>
      )}
      {onAmBreak && (
        <button onClick={() => stamp('amBreakIn')} style={btn('rgba(74,222,128,0.15)', GREEN)}>☕ AM Break In</button>
      )}
      {isClockedIn && !onBreak && !entry?.pmBreakOut && (
        <button onClick={() => stamp('pmBreakOut')} style={btn('rgba(167,139,250,0.15)', PURPLE)}>☕ PM Break Out</button>
      )}
      {onPmBreak && (
        <button onClick={() => stamp('pmBreakIn')} style={btn('rgba(74,222,128,0.15)', GREEN)}>☕ PM Break In</button>
      )}
      {isClockedIn && !onBreak && !entry?.clockOut && (
        <button onClick={clockOut} style={btn('rgba(239,68,68,0.15)', RED)}>⏹ Clock Out</button>
      )}
      {entry?.clockIn && (
        <span style={{ color: '#6b7280', fontSize: '9px' }}>
          in {fmtTime(entry.clockIn)}
          {entry?.lunchOut ? ` · lunch ${fmtTime(entry.lunchOut)}–${fmtTime(entry.lunchIn)}` : ''}
          {entry?.amBreakOut ? ` · AM ${fmtTime(entry.amBreakOut)}–${fmtTime(entry.amBreakIn)}` : ''}
          {entry?.pmBreakOut ? ` · PM ${fmtTime(entry.pmBreakOut)}–${fmtTime(entry.pmBreakIn)}` : ''}
          {entry?.clockOut ? ` · out ${fmtTime(entry.clockOut)}` : ''}
        </span>
      )}
      {priorSessions.length > 0 && (
        <span style={{ color: BLUE, fontSize: '9px' }}>· {priorSessions.length} prior session{priorSessions.length !== 1 ? 's' : ''} ({fmtDur(priorSessions.reduce((s, x) => s + (x.totalSeconds || 0), 0))})</span>
      )}
    </div>
  );
}