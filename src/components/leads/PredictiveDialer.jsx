import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const NUM_LINES = 3;

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

export default function PredictiveDialer({ onClose, onCallLogged }) {
  const [leads, setLeads] = useState([]);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [lines, setLines] = useState(() => Array.from({ length: NUM_LINES }, () => ({ ...LINE_DEFAULT })));
  const [running, setRunning] = useState(false);
  const [microphones, setMicrophones] = useState([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [logs, setLogs] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  const linesRef = useRef(lines);
  const queueRef = useRef([]);
  const queueIndexRef = useRef(0);
  const runningRef = useRef(false);
  const timersRef = useRef({});
  const pollsRef = useRef({});

  linesRef.current = lines;
  runningRef.current = running;

  useEffect(() => {
    loadLeads();
    navigator.mediaDevices?.enumerateDevices().then(devices => {
      const mics = devices.filter(d => d.kind === 'audioinput');
      setMicrophones(mics);
      if (mics.length > 0) setSelectedMic(mics[0].deviceId);
    }).catch(() => {});
    return () => {
      Object.values(timersRef.current).forEach(clearInterval);
      Object.values(pollsRef.current).forEach(clearInterval);
    };
  }, []);

  const loadLeads = async () => {
    setLoadingLeads(true);
    try {
      const all = await base44.entities.Lead.list('-created_date', 2000);
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

  const addLog = (type, msg) => {
    setLogs(prev => [{ type, msg, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 60));
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

      // Stamp lastCalledAt
      try { await base44.entities.Lead.update(lead.id, { lastCalledAt: new Date().toISOString() }); } catch {}

      // Poll for status + AMD voicemail detection
      pollsRef.current[lineIdx] = setInterval(async () => {
        try {
          const s = await base44.functions.invoke('twilioCall', { action: 'getCallStatus', callSid: sid });
          const { status, isVoicemail } = s.data || {};

          // ── Voicemail detected → hang up immediately ──
          if (isVoicemail) {
            clearInterval(pollsRef.current[lineIdx]);
            clearInterval(timersRef.current[lineIdx]);
            try { await base44.functions.invoke('twilioCall', { action: 'hangupCall', callSid: sid }); } catch {}
            addLog('voicemail', `Line ${lineIdx + 1}: Voicemail detected — hung up (${lead.firstName} ${lead.lastName})`);
            endLine(lineIdx, 'voicemail');
            setTimeout(() => { if (runningRef.current) dialLine(lineIdx); }, 1000);
            return;
          }

          // ── Call ended naturally ──
          if (['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(status)) {
            clearInterval(pollsRef.current[lineIdx]);
            clearInterval(timersRef.current[lineIdx]);
            const dur = linesRef.current[lineIdx]?.duration || 0;

            try {
              await base44.entities.LeadHistory.create({
                leadId: lead.id,
                type: 'call',
                content: `Predictive dialer call — ${formatDuration(dur)}`,
                callDurationSeconds: dur,
                twilioCallSid: sid,
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
    const remaining = queueRef.current.length - queueIndexRef.current;
    addLog('system', `Starting predictive dialer — ${remaining} leads in queue`);
    for (let i = 0; i < NUM_LINES; i++) {
      setTimeout(() => dialLine(i), i * 800);
    }
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
    setLines(Array.from({ length: NUM_LINES }, () => ({ ...LINE_DEFAULT })));
    addLog('system', 'Dialer stopped.');
  };

  const resetQueue = () => {
    queueRef.current = leads;
    queueIndexRef.current = 0;
    setQueueIndex(0);
    addLog('system', 'Queue reset.');
  };

  const remaining = Math.max(0, queue.length - queueIndex);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: 'Georgia, serif', padding: '20px' }}>
      <div style={{ background: '#0d1b2a', border: `1px solid rgba(184,147,58,0.4)`, borderRadius: '8px', width: '100%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 120px rgba(0,0,0,0.9)' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', borderRadius: '8px 8px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: running ? '#4ade80' : '#4a5568', boxShadow: running ? '0 0 10px #4ade80' : 'none' }} />
            <span style={{ color: GOLD, fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase' }}>Predictive Dialer</span>
            <span style={{ background: 'rgba(184,147,58,0.15)', color: GOLD, border: '1px solid rgba(184,147,58,0.3)', borderRadius: '2px', padding: '2px 10px', fontSize: '11px' }}>{NUM_LINES} Lines</span>
            <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '2px', padding: '2px 10px', fontSize: '11px' }}>AMD On</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '22px' }}>×</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left panel */}
          <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
              {[
                [queue.length, 'Total Leads', GOLD],
                [queueIndex, 'Dialed', '#60a5fa'],
                [remaining, 'Remaining', '#a78bfa'],
              ].map(([v, l, c]) => (
                <div key={l} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ color: c, fontSize: '22px', fontWeight: 'bold' }}>{v}</div>
                  <div style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '3px' }}>{l}</div>
                </div>
              ))}
            </div>

            {/* 3 Lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lines.map((line, i) => {
                const col = LINE_COLORS[line.status] || '#4a5568';
                return (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${line.status === 'connected' ? 'rgba(74,222,128,0.3)' : line.status === 'calling' ? 'rgba(245,158,11,0.3)' : line.status === 'voicemail' ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.07)'}`, borderLeft: `4px solid ${col}`, borderRadius: '4px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: col, flexShrink: 0, boxShadow: line.status === 'connected' ? `0 0 8px ${col}` : 'none' }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {line.lead ? `${line.lead.firstName} ${line.lead.lastName}` : `Line ${i + 1}`}
                        </div>
                        {line.lead?.phone && <div style={{ color: '#6b7280', fontSize: '11px', fontFamily: 'monospace' }}>{line.lead.phone}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      {(line.status === 'connected' || line.status === 'ended') && (
                        <div style={{ color: '#4ade80', fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>{formatDuration(line.duration)}</div>
                      )}
                      <span style={{ color: col, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>{STATUS_LABEL[line.status] || 'Idle'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mic selector */}
            {microphones.length > 1 && (
              <div>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '5px' }}>🎙 Microphone</label>
                <select value={selectedMic} onChange={e => setSelectedMic(e.target.value)} disabled={running}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                  {microphones.map(mic => (
                    <option key={mic.deviceId} value={mic.deviceId}>{mic.label || `Microphone ${microphones.indexOf(mic) + 1}`}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Controls */}
            <div style={{ display: 'flex', gap: '10px' }}>
              {!running ? (
                <button onClick={startDialing} disabled={loadingLeads || remaining === 0}
                  style={{ flex: 1, background: (loadingLeads || remaining === 0) ? 'rgba(74,222,128,0.2)' : 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', border: 'none', borderRadius: '6px', padding: '14px', cursor: (loadingLeads || remaining === 0) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                  {loadingLeads ? 'Loading Leads…' : remaining === 0 ? 'Queue Empty' : `▶ Start Dialing (${remaining} leads)`}
                </button>
              ) : (
                <button onClick={stopDialing}
                  style={{ flex: 1, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', border: 'none', borderRadius: '6px', padding: '14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                  ■ Stop Dialer
                </button>
              )}
              <button onClick={resetQueue} disabled={running}
                style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: running ? 'not-allowed' : 'pointer', fontSize: '12px' }}>
                ↺ Reset
              </button>
              <button onClick={loadLeads} disabled={running || loadingLeads}
                style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: running ? 'not-allowed' : 'pointer', fontSize: '12px' }}>
                ↻
              </button>
            </div>
          </div>

          {/* Right: Activity Log */}
          <div style={{ width: '300px', borderLeft: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>Activity Log</div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {logs.length === 0 && <div style={{ color: '#4a5568', fontSize: '12px', padding: '20px', textAlign: 'center' }}>No activity yet</div>}
              {logs.map((log, i) => {
                const logColors = { call: '#f59e0b', connected: '#4ade80', ended: '#6b7280', voicemail: '#a78bfa', error: '#ef4444', system: '#60a5fa' };
                return (
                  <div key={i} style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '11px' }}>
                    <div style={{ color: logColors[log.type] || '#8a9ab8', marginBottom: '2px' }}>{log.msg}</div>
                    <div style={{ color: '#4a5568', fontSize: '10px' }}>{log.time}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}