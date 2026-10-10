/**
 * FronterMonitorPanel.jsx — Floating, draggable, resizable live monitor for super admins.
 * Checkbox-select up to 3 fronters. Each box shows: status, call status, live transcript,
 * call duration, customer name, calls today, time logged on, time in current status.
 * Admin can change any fronter's status via dropdown.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';
const RED = '#ef4444';

const STATUS_CONFIG = {
  dialing: { label: 'Dialing', color: GOLD, icon: '📞' },
  lunch_break: { label: 'Lunch Break', color: AMBER, icon: '🍽️' },
  bathroom_break: { label: 'Bathroom Break', color: BLUE, icon: '🚻' },
  offline: { label: 'Offline', color: '#6b7280', icon: '⭕' },
};

function fmtDur(seconds) {
  if (!seconds || seconds < 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtCallDur(s) {
  if (!s || s < 0) return '0:00';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function FronterMonitorPanel({ onClose }) {
  const [fronters, setFronters] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [transcripts, setTranscripts] = useState({});
  const [callsToday, setCallsToday] = useState({});
  const [now, setNow] = useState(Date.now());
  const [pos, setPos] = useState({ x: 30, y: 70 });
  const [size, setSize] = useState({ w: 860, h: 520 });
  const [showCheckboxes, setShowCheckboxes] = useState(true);
  const dragRef = useRef(null);

  // Load fronters
  useEffect(() => {
    base44.entities.DebtCoachUser.list('-created_date', 500).then(all => {
      const f = (all || []).filter(u => (u.role === 'fronter' || u.role === 'super_admin') && u.isActive);
      setFronters(f);
      // Auto-select first 3
      setSelected(f.slice(0, 3).map(u => u.username));
    }).catch(() => {});
  }, []);

  // Poll sessions, transcripts, calls
  useEffect(() => {
    const poll = async () => {
      try {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const [allSessions, todayTranscripts] = await Promise.all([
          base44.entities.DialerSession.filter({ status: { $in: ['logged_in', 'on_call'] } }, '-loginAt', 100),
          base44.entities.FronterCallTranscript.filter({ callDate: { $gte: todayStart.toISOString() } }, '-callDate', 200),
        ]);
        setSessions(allSessions || []);

        // Count calls today per fronter
        const counts = {};
        (todayTranscripts || []).forEach(t => {
          counts[t.fronterUsername] = (counts[t.fronterUsername] || 0) + 1;
        });
        setCallsToday(counts);

        // Get latest transcript for fronters on call
        const onCallSessions = (allSessions || []).filter(s => s.status === 'on_call');
        const latest = {};
        for (const s of onCallSessions) {
          const fronterTranscripts = (todayTranscripts || []).filter(t => t.fronterUsername === s.username);
          if (fronterTranscripts.length > 0) latest[s.username] = fronterTranscripts[0];
        }
        setTranscripts(latest);
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  // Tick for time displays
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => {
      if (!dragRef.current) return;
      setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY });
    };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const toggleFronter = (username) => {
    setSelected(prev => {
      if (prev.includes(username)) return prev.filter(u => u !== username);
      if (prev.length >= 3) return prev;
      return [...prev, username];
    });
  };

  const changeStatus = async (username, newStatus) => {
    const session = sessions.find(s => s.username === username);
    if (!session) return;
    try {
      await base44.entities.DialerSession.update(session.id, {
        fronterStatus: newStatus,
        fronterStatusAt: new Date().toISOString(),
      });
    } catch {}
  };

  const getSession = (username) => sessions.find(s => s.username === username);

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '8px', boxShadow: '0 16px 64px rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      {/* Header — draggable */}
      <div onMouseDown={onDragStart} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: BLUE, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📡 Fronter Monitor</span>
          <span style={{ color: '#6b7280', fontSize: '10px' }}>{selected.length}/3 selected</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={() => setShowCheckboxes(p => !p)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px' }}>{showCheckboxes ? 'Hide' : 'Show'} Fronters</button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px', padding: 0, lineHeight: 1 }}>×</button>
        </div>
      </div>

      {/* Checkbox section */}
      {showCheckboxes && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0, maxHeight: '80px', overflowY: 'auto' }}>
          {fronters.map(f => {
            const isSel = selected.includes(f.username);
            const disabled = !isSel && selected.length >= 3;
            return (
              <button key={f.id} onClick={() => toggleFronter(f.username)} disabled={disabled} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '3px', border: `1px solid ${isSel ? BLUE + '66' : 'rgba(255,255,255,0.1)'}`, background: isSel ? `${BLUE}18` : 'rgba(255,255,255,0.03)', color: isSel ? BLUE : '#8a9ab8', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: isSel ? 'bold' : 'normal', opacity: disabled ? 0.4 : 1, fontFamily: 'Georgia, serif' }}>
                <span style={{ fontSize: '13px' }}>{isSel ? '☑' : '☐'}</span>
                {f.username}
              </button>
            );
          })}
          {fronters.length === 0 && <span style={{ color: '#4a5568', fontSize: '11px' }}>No active fronters.</span>}
        </div>
      )}

      {/* Grid of selected fronters */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px', display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, selected.length)}, 1fr)`, gap: '10px', minWidth: 0 }}>
        {selected.length === 0 ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px', gridColumn: '1 / -1' }}>Select fronters above to monitor them.</div>
        ) : (
          selected.map(username => {
            const fronter = fronters.find(f => f.username === username);
            const session = getSession(username);
            return <FronterBox key={username} username={username} session={session} transcript={transcripts[username]} callsTodayCount={callsToday[username] || 0} now={now} onStatusChange={changeStatus} />;
          })
        )}
      </div>

      {/* Resize handle */}
      <div onMouseDown={(e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
        const onMove = (ev) => setSize({ w: Math.max(400, startW + ev.clientX - startX), h: Math.max(300, startH + ev.clientY - startY) });
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
    </div>
  );
}

function FronterBox({ username, session, transcript, callsTodayCount, now, onStatusChange }) {
  const status = session?.fronterStatus || 'offline';
  const isOnCall = session?.status === 'on_call';
  const callDur = isOnCall && session?.currentCallStartedAt ? Math.floor((now - new Date(session.currentCallStartedAt).getTime()) / 1000) : 0;
  const loggedOn = session?.loginAt ? Math.floor((now - new Date(session.loginAt).getTime()) / 1000) : 0;
  const statusDur = session?.fronterStatusAt ? Math.floor((now - new Date(session.fronterStatusAt).getTime()) / 1000) : 0;
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.offline;

  let transcriptLines = [];
  if (transcript?.transcriptJson) {
    try { transcriptLines = JSON.parse(transcript.transcriptJson); } catch {}
  }

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${statusCfg.color}33`, borderRadius: '6px', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
      {/* Name + status dropdown */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username}</span>
        <select value={status} onChange={e => onStatusChange(username, e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${statusCfg.color}44`, borderRadius: '3px', padding: '3px 6px', color: statusCfg.color, fontSize: '10px', cursor: 'pointer', fontFamily: 'Georgia, serif', flexShrink: 0 }}>
          <option value="dialing">📞 Dialing</option>
          <option value="lunch_break">🍽️ Lunch</option>
          <option value="bathroom_break">🚻 Bathroom</option>
          <option value="offline">⭕ Offline</option>
        </select>
      </div>

      {/* Status badge */}
      <div style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusCfg.color, flexShrink: 0 }} />
        <span style={{ color: statusCfg.color, fontSize: '11px', fontWeight: 'bold' }}>{statusCfg.icon} {statusCfg.label}</span>
        <span style={{ color: '#6b7280', fontSize: '10px', marginLeft: 'auto' }}>· {fmtDur(statusDur)}</span>
      </div>

      {/* Call status */}
      <div style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        {isOnCall ? (
          <>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', animation: 'pulse 1s infinite', flexShrink: 0 }} />
            <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: 'bold' }}>● On Call</span>
            <span style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold', marginLeft: 'auto', fontFamily: 'monospace' }}>{fmtCallDur(callDur)}</span>
          </>
        ) : (
          <>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#6b7280', flexShrink: 0 }} />
            <span style={{ color: '#6b7280', fontSize: '11px', fontWeight: 'bold' }}>○ No Call</span>
          </>
        )}
      </div>

      {/* On call details: customer name + transcript */}
      {isOnCall && (
        <div style={{ flex: 1, minHeight: 0, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column' }}>
          {/* Customer name */}
          <div style={{ padding: '4px 10px', color: BLUE, fontSize: '11px', fontWeight: 'bold' }}>👤 {session?.currentCallLeadName || 'Unknown'}</div>
          {/* Live transcript */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px', fontSize: '10px', lineHeight: 1.4 }}>
            {transcriptLines.length === 0 ? (
              <div style={{ color: '#4a5568', textAlign: 'center', padding: '8px' }}>Waiting for transcript…</div>
            ) : (
              transcriptLines.slice(-8).map((l, i) => (
                <div key={i} style={{ marginBottom: '2px', display: 'flex', gap: '4px' }}>
                  <span style={{ color: l.speaker === 0 ? BLUE : GOLD, fontWeight: 'bold', flexShrink: 0, minWidth: '32px' }}>{l.speaker === 0 ? 'Agent' : 'Cust'}</span>
                  <span style={{ color: '#c4cdd8' }}>{l.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bottom stats */}
      <div style={{ padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '12px', flexShrink: 0, background: 'rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: BLUE, fontSize: '13px', fontWeight: 'bold' }}>{callsTodayCount}</div>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Calls</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>{fmtDur(loggedOn)}</div>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Logged On</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: statusCfg.color, fontSize: '13px', fontWeight: 'bold' }}>{fmtDur(statusDur)}</div>
          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>In Status</div>
        </div>
      </div>
    </div>
  );
}