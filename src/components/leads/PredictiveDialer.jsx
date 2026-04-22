import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const LINE_DEFAULT = { lead: null, callSid: null, status: 'idle', duration: 0 };

function formatDuration(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const LINE_COLORS = {
  idle: '#4a5568',
  calling: '#f59e0b',
  connected: '#4ade80',
  ended: '#6b7280',
  voicemail: '#a78bfa',
  no_answer: '#ef4444',
};

const STATUS_LABEL = {
  idle: 'Idle', calling: 'Calling…', connected: 'Connected',
  ended: 'Ended', voicemail: 'Voicemail ↩', no_answer: 'No Answer',
};

const LOG_COLORS = { call: '#f59e0b', connected: '#4ade80', ended: '#6b7280', voicemail: '#a78bfa', error: '#ef4444', system: '#60a5fa' };

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// ── Setup Screen ──────────────────────────────────────────────────────────
function SetupScreen({ contactLists, selectedListId, setSelectedListId, lineCount, setLineCount, onStart, onClose, loading }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: 'Georgia, serif', padding: '16px' }}>
      <div style={{ background: '#0d1b2a', border: `1px solid rgba(184,147,58,0.4)`, borderRadius: '12px', width: '100%', maxWidth: '460px', boxShadow: '0 40px 120px rgba(0,0,0,0.9)' }}>
        <div style={{ padding: '24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ color: GOLD, margin: 0, fontSize: '15px', letterSpacing: '2px', textTransform: 'uppercase' }}>Predictive Dialer</h2>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#8a9ab8', cursor: 'pointer', fontSize: '18px', width: '32px', height: '32px', borderRadius: '6px' }}>×</button>
          </div>

          {/* Contact List */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#8a9ab8', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Contact List</label>
            <select value={selectedListId} onChange={e => setSelectedListId(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '12px', color: '#e8e0d0', fontSize: '14px', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
              <option value="">— Choose a list —</option>
              {contactLists.map(list => (
                <option key={list.id} value={list.id}>{list.name} ({list.leadCount || 0} leads)</option>
              ))}
            </select>
            {contactLists.length === 0 && (
              <div style={{ color: '#f59e0b', fontSize: '12px', marginTop: '8px' }}>📊 No lists yet — import a CSV from the Leads tab first.</div>
            )}
          </div>

          {/* Line Count */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', color: '#8a9ab8', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Simultaneous Lines</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setLineCount(n)}
                  style={{ flex: 1, padding: '14px 0', borderRadius: '8px', border: `2px solid ${lineCount === n ? GOLD : 'rgba(255,255,255,0.1)'}`, background: lineCount === n ? `rgba(184,147,58,0.15)` : 'transparent', color: lineCount === n ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', transition: 'all 0.15s' }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ color: '#4a5568', fontSize: '11px', marginTop: '8px' }}>
              {lineCount === 1 ? '📱 Good for mobile use' : lineCount === 2 ? '💡 Use when another device is also dialing' : '⚡ Max throughput — desktop recommended'}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onStart} disabled={!selectedListId || loading}
              style={{ flex: 1, background: !selectedListId ? 'rgba(184,147,58,0.2)' : 'linear-gradient(135deg,#b8933a,#d4aa50)', color: DARK, border: 'none', borderRadius: '8px', padding: '15px', cursor: !selectedListId ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px', letterSpacing: '1px' }}>
              {loading ? 'Loading…' : '▶ Launch Dialer'}
            </button>
            <button onClick={onClose}
              style={{ padding: '15px 20px', background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Line Card (mobile-friendly) ───────────────────────────────────────────
function LineCard({ line, index, onHangup }) {
  const col = LINE_COLORS[line.status] || '#4a5568';
  const isActive = line.status === 'connected' || line.status === 'calling';
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${line.status === 'connected' ? 'rgba(74,222,128,0.35)' : line.status === 'calling' ? 'rgba(245,158,11,0.35)' : line.status === 'voicemail' ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.07)'}`,
      borderLeft: `4px solid ${col}`,
      borderRadius: '10px',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: col, flexShrink: 0, boxShadow: isActive ? `0 0 8px ${col}` : 'none' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {line.lead ? `${line.lead.firstName} ${line.lead.lastName}` : `Line ${index + 1}`}
          </div>
          {line.lead?.phone && <div style={{ color: '#6b7280', fontSize: '12px', fontFamily: 'monospace', marginTop: '2px' }}>{line.lead.phone}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {(line.status === 'connected' || line.status === 'ended') && (
          <div style={{ color: '#4ade80', fontFamily: 'monospace', fontSize: '15px', fontWeight: 'bold' }}>{formatDuration(line.duration)}</div>
        )}
        <span style={{ color: col, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{STATUS_LABEL[line.status] || 'Idle'}</span>
        {isActive && line.callSid && (
          <button onClick={() => onHangup(line.callSid)}
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '13px' }}>
            📵
          </button>
        )}
      </div>
    </div>
  );
}

// ── Stats Row ─────────────────────────────────────────────────────────────
function StatsRow({ total, dialed, remaining }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
      {[[total, 'Total', GOLD], [dialed, 'Dialed', '#60a5fa'], [remaining, 'Left', '#a78bfa']].map(([v, l, c]) => (
        <div key={l} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <div style={{ color: c, fontSize: '20px', fontWeight: 'bold' }}>{v}</div>
          <div style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '2px' }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

// ── Log Panel ─────────────────────────────────────────────────────────────
function LogPanel({ logs, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...style }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', flexShrink: 0 }}>Activity Log</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {logs.length === 0 && <div style={{ color: '#4a5568', fontSize: '12px', padding: '20px', textAlign: 'center' }}>No activity yet</div>}
        {logs.map((log, i) => (
          <div key={i} style={{ padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '11px' }}>
            <div style={{ color: LOG_COLORS[log.type] || '#8a9ab8', marginBottom: '1px' }}>{log.msg}</div>
            <div style={{ color: '#4a5568', fontSize: '10px' }}>{log.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Dialer ───────────────────────────────────────────────────────────
export default function PredictiveDialer({ onClose, onCallLogged }) {
  const isMobile = useIsMobile();

  const [contactLists, setContactLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [lineCount, setLineCount] = useState(isMobile ? 1 : 3);
  const [started, setStarted] = useState(false);
  const [mobileTab, setMobileTab] = useState('lines'); // 'lines' | 'log'

  const [leads, setLeads] = useState([]);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [lines, setLines] = useState(() => Array.from({ length: 3 }, () => ({ ...LINE_DEFAULT })));
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  const linesRef = useRef(lines);
  const queueRef = useRef([]);
  const queueIndexRef = useRef(0);
  const runningRef = useRef(false);
  const timersRef = useRef({});
  const pollsRef = useRef({});

  linesRef.current = lines;
  runningRef.current = running;

  useEffect(() => {
    base44.entities.ContactList.list('-created_date', 100).then(lists => {
      setContactLists(lists);
      if (lists.length > 0) setSelectedListId(lists[0].id);
    }).catch(() => {});
    return () => {
      Object.values(timersRef.current).forEach(clearInterval);
      Object.values(pollsRef.current).forEach(clearInterval);
    };
  }, []);

  const addLog = (type, msg) => {
    setLogs(prev => [{ type, msg, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 80));
  };

  const loadLeads = async (listId) => {
    setLoadingLeads(true);
    try {
      const all = await base44.entities.Lead.filter({ contactListId: listId });
      const dialable = all.filter(l => l.phone && l.status !== 'not_interested' && l.status !== 'converted');
      const neverCalled = dialable.filter(l => !l.lastCalledAt).sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      const called = dialable.filter(l => l.lastCalledAt).sort((a, b) => new Date(a.lastCalledAt) - new Date(b.lastCalledAt));
      const sorted = [...neverCalled, ...called];
      setLeads(sorted);
      queueRef.current = sorted;
      setQueue(sorted);
    } catch (e) {
      addLog('error', 'Failed to load leads: ' + e.message);
    }
    setLoadingLeads(false);
  };

  const handleStart = async () => {
    if (!selectedListId) return;
    await loadLeads(selectedListId);
    setStarted(true);
  };

  const getNextLead = () => {
    const idx = queueIndexRef.current;
    const q = queueRef.current;
    if (idx >= q.length) return null;
    queueIndexRef.current = idx + 1;
    setQueueIndex(idx + 1);
    return q[idx];
  };

  const startLineTimer = (lineIdx) => {
    clearInterval(timersRef.current[lineIdx]);
    const start = Date.now();
    timersRef.current[lineIdx] = setInterval(() => {
      setLines(prev => {
        const updated = [...prev];
        updated[lineIdx] = { ...updated[lineIdx], duration: Math.floor((Date.now() - start) / 1000) };
        return updated;
      });
    }, 1000);
  };

  const endLine = (lineIdx, finalStatus) => {
    clearInterval(timersRef.current[lineIdx]);
    clearInterval(pollsRef.current[lineIdx]);
    setLines(prev => {
      const updated = [...prev];
      updated[lineIdx] = { ...updated[lineIdx], status: finalStatus };
      return updated;
    });
  };

  const hangupLine = async (callSid) => {
    try { await base44.functions.invoke('twilioCall', { action: 'hangupCall', callSid }); } catch {}
  };

  const dialLine = useCallback(async (lineIdx) => {
    const lead = getNextLead();
    if (!lead) {
      addLog('system', 'Queue exhausted — no more leads.');
      return;
    }

    setLines(prev => {
      const updated = [...prev];
      updated[lineIdx] = { ...LINE_DEFAULT, lead, status: 'calling' };
      return updated;
    });

    addLog('call', `Line ${lineIdx + 1}: Calling ${lead.firstName} ${lead.lastName} (${lead.phone})`);

    try {
      const res = await base44.functions.invoke('twilioCall', { action: 'makeCall', to: lead.phone });
      const sid = res.data?.callSid;

      setLines(prev => {
        const updated = [...prev];
        updated[lineIdx] = { ...updated[lineIdx], callSid: sid, status: 'connected' };
        return updated;
      });

      startLineTimer(lineIdx);
      addLog('connected', `Line ${lineIdx + 1}: Connected — ${lead.firstName} ${lead.lastName}`);
      try { await base44.entities.Lead.update(lead.id, { lastCalledAt: new Date().toISOString() }); } catch {}

      pollsRef.current[lineIdx] = setInterval(async () => {
        try {
          const s = await base44.functions.invoke('twilioCall', { action: 'getCallStatus', callSid: sid });
          const { status, isVoicemail } = s.data || {};

          if (isVoicemail) {
            clearInterval(pollsRef.current[lineIdx]);
            clearInterval(timersRef.current[lineIdx]);
            try { await base44.functions.invoke('twilioCall', { action: 'hangupCall', callSid: sid }); } catch {}
            addLog('voicemail', `Line ${lineIdx + 1}: Voicemail — skipped (${lead.firstName} ${lead.lastName})`);
            endLine(lineIdx, 'voicemail');
            setTimeout(() => { if (runningRef.current) dialLine(lineIdx); }, 1000);
            return;
          }

          if (['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(status)) {
            clearInterval(pollsRef.current[lineIdx]);
            clearInterval(timersRef.current[lineIdx]);
            const dur = linesRef.current[lineIdx]?.duration || 0;
            try {
              await base44.entities.LeadHistory.create({
                leadId: lead.id, type: 'call',
                content: `Predictive dialer call — ${formatDuration(dur)}`,
                callDurationSeconds: dur, twilioCallSid: sid,
              });
              onCallLogged && onCallLogged(lead.id);
            } catch {}
            addLog('ended', `Line ${lineIdx + 1}: Ended — ${lead.firstName} ${lead.lastName} (${formatDuration(dur)})`);
            endLine(lineIdx, 'ended');
            setTimeout(() => { if (runningRef.current) dialLine(lineIdx); }, 1500);
          }
        } catch {}
      }, 3000);

    } catch (e) {
      addLog('error', `Line ${lineIdx + 1}: Failed — ${e.message}`);
      endLine(lineIdx, 'no_answer');
      setTimeout(() => { if (runningRef.current) dialLine(lineIdx); }, 2000);
    }
  }, []);

  const startDialing = () => {
    setRunning(true);
    runningRef.current = true;
    const rem = queueRef.current.length - queueIndexRef.current;
    addLog('system', `Starting — ${rem} leads, ${lineCount} line${lineCount > 1 ? 's' : ''}`);
    for (let i = 0; i < lineCount; i++) setTimeout(() => dialLine(i), i * 800);
  };

  const stopDialing = async () => {
    setRunning(false);
    runningRef.current = false;
    Object.values(pollsRef.current).forEach(clearInterval);
    Object.values(timersRef.current).forEach(clearInterval);
    linesRef.current.forEach(async (line) => {
      if (line.callSid && (line.status === 'calling' || line.status === 'connected')) {
        try { await base44.functions.invoke('twilioCall', { action: 'hangupCall', callSid: line.callSid }); } catch {}
      }
    });
    setLines(Array.from({ length: 3 }, () => ({ ...LINE_DEFAULT })));
    addLog('system', 'Dialer stopped.');
  };

  const resetQueue = () => {
    queueRef.current = leads;
    queueIndexRef.current = 0;
    setQueueIndex(0);
    addLog('system', 'Queue reset.');
  };

  const remaining = Math.max(0, queue.length - queueIndex);

  // ── Setup screen ────────────────────────────────────────────────────────
  if (!started) {
    return (
      <SetupScreen
        contactLists={contactLists}
        selectedListId={selectedListId}
        setSelectedListId={setSelectedListId}
        lineCount={lineCount}
        setLineCount={setLineCount}
        onStart={handleStart}
        onClose={onClose}
        loading={loadingLeads}
      />
    );
  }

  // ── Mobile layout ───────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#060c18', zIndex: 10000, fontFamily: 'Georgia, serif', display: 'flex', flexDirection: 'column' }}>

        {/* Mobile Header */}
        <div style={{ background: '#0d1b2a', borderBottom: '1px solid rgba(184,147,58,0.25)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: running ? '#4ade80' : '#4a5568', boxShadow: running ? '0 0 8px #4ade80' : 'none' }} />
            <span style={{ color: GOLD, fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' }}>Dialer</span>
            <span style={{ background: 'rgba(184,147,58,0.15)', color: GOLD, border: '1px solid rgba(184,147,58,0.3)', borderRadius: '4px', padding: '2px 8px', fontSize: '10px' }}>{lineCount} Line{lineCount > 1 ? 's' : ''}</span>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#8a9ab8', cursor: 'pointer', fontSize: '18px', width: '34px', height: '34px', borderRadius: '8px' }}>×</button>
        </div>

        {/* Stats */}
        <div style={{ padding: '12px 16px', flexShrink: 0 }}>
          <StatsRow total={queue.length} dialed={queueIndex} remaining={remaining} />
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {[['lines', '📞 Lines'], ['log', '📋 Log']].map(([id, label]) => (
            <button key={id} onClick={() => setMobileTab(id)}
              style={{ flex: 1, background: 'none', border: 'none', borderBottom: mobileTab === id ? `2px solid ${GOLD}` : '2px solid transparent', color: mobileTab === id ? GOLD : '#6b7280', padding: '10px', cursor: 'pointer', fontSize: '13px', fontFamily: 'Georgia, serif' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {mobileTab === 'lines' && (
            <>
              {lines.slice(0, lineCount).map((line, i) => (
                <LineCard key={i} line={line} index={i} onHangup={hangupLine} />
              ))}
            </>
          )}
          {mobileTab === 'log' && (
            <LogPanel logs={logs} style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: '10px', overflow: 'hidden' }} />
          )}
        </div>

        {/* Bottom controls */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', background: '#0d1b2a', flexShrink: 0, display: 'flex', gap: '10px' }}>
          {!running ? (
            <button onClick={startDialing} disabled={loadingLeads || remaining === 0}
              style={{ flex: 1, background: (loadingLeads || remaining === 0) ? 'rgba(74,222,128,0.2)' : 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', border: 'none', borderRadius: '10px', padding: '16px', cursor: (loadingLeads || remaining === 0) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
              {loadingLeads ? 'Loading…' : remaining === 0 ? 'Queue Empty' : `▶ Start (${remaining})`}
            </button>
          ) : (
            <button onClick={stopDialing}
              style={{ flex: 1, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', border: 'none', borderRadius: '10px', padding: '16px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
              ■ Stop
            </button>
          )}
          <button onClick={resetQueue} disabled={running}
            style={{ padding: '16px 18px', background: 'rgba(255,255,255,0.06)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', cursor: running ? 'not-allowed' : 'pointer', fontSize: '16px' }}>
            ↺
          </button>
        </div>
      </div>
    );
  }

  // ── Desktop layout ──────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: 'Georgia, serif', padding: '20px' }}>
      <div style={{ background: '#0d1b2a', border: `1px solid rgba(184,147,58,0.4)`, borderRadius: '10px', width: '100%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 120px rgba(0,0,0,0.9)' }}>

        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', borderRadius: '10px 10px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: running ? '#4ade80' : '#4a5568', boxShadow: running ? '0 0 10px #4ade80' : 'none' }} />
            <span style={{ color: GOLD, fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase' }}>Predictive Dialer</span>
            <span style={{ background: 'rgba(184,147,58,0.15)', color: GOLD, border: '1px solid rgba(184,147,58,0.3)', borderRadius: '4px', padding: '2px 10px', fontSize: '11px' }}>{lineCount} Lines</span>
            <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '4px', padding: '2px 10px', fontSize: '11px' }}>AMD On</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '22px' }}>×</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left panel */}
          <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
            <StatsRow total={queue.length} dialed={queueIndex} remaining={remaining} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lines.slice(0, lineCount).map((line, i) => (
                <LineCard key={i} line={line} index={i} onHangup={hangupLine} />
              ))}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
              {!running ? (
                <button onClick={startDialing} disabled={loadingLeads || remaining === 0}
                  style={{ flex: 1, background: (loadingLeads || remaining === 0) ? 'rgba(74,222,128,0.2)' : 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', border: 'none', borderRadius: '8px', padding: '14px', cursor: (loadingLeads || remaining === 0) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                  {loadingLeads ? 'Loading…' : remaining === 0 ? 'Queue Empty' : `▶ Start Dialing (${remaining} leads)`}
                </button>
              ) : (
                <button onClick={stopDialing}
                  style={{ flex: 1, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', border: 'none', borderRadius: '8px', padding: '14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                  ■ Stop Dialer
                </button>
              )}
              <button onClick={resetQueue} disabled={running}
                style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: running ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                ↺ Reset
              </button>
            </div>
          </div>

          {/* Log panel */}
          <LogPanel logs={logs} style={{ width: '280px', borderLeft: '1px solid rgba(255,255,255,0.07)' }} />
        </div>
      </div>
    </div>
  );
}