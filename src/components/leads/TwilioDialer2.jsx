import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Device } from '@twilio/voice-sdk';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const LINE_CONFIG = [
  { key: 'TWILIO_FROM_NUMBER_2', label: 'Line 1', color: '#60a5fa' },
  { key: 'TWILIO_FROM_NUMBER_3', label: 'Line 2', color: '#a78bfa' },
];

const fmt = (secs) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const fmtDate = (dt) => {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
};

// ── Line State ────────────────────────────────────────────────────────────
const blankLine = (idx) => ({
  idx,
  status: 'idle', // idle | initializing | ready | calling | ringing | connected | ended
  callSid: null,
  lead: null,
  manualNumber: '',
  duration: 0,
  muted: false,
  device: null,
  call: null,
  statusMsg: 'Initializing…',
  monitorCall: null, // active monitor/barge connection
  monitorMode: null, // 'listen' | 'barge'
});

export default function TwilioDialer2({ initialLead, onClose, onCallLogged, onCallStart, onCallEnd, onCallStream }) {
  const [lines, setLines]           = useState([blankLine(0), blankLine(1)]);
  const [activeTab, setActiveTab]   = useState('dialer'); // 'dialer' | 'monitor' | 'history'
  const [callHistory, setCallHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [micDevices, setMicDevices] = useState([]);
  const [selectedMicId, setSelectedMicId] = useState('');
  const [monitorMicId, setMonitorMicId]   = useState('');
  const [error, setError]           = useState('');

  const linesRef   = useRef(lines);
  const timersRef  = useRef({});

  linesRef.current = lines;

  const HISTORY_PAGE_SIZE = 20;

  useEffect(() => {
    // Enumerate mics
    navigator.mediaDevices.enumerateDevices().then(devs => {
      const mics = devs.filter(d => d.kind === 'audioinput');
      setMicDevices(mics);
      if (mics.length > 0) setSelectedMicId(mics[0].deviceId);
      const internal = mics.find(m => /built.in|internal|macbook/i.test(m.label)) || mics[1] || mics[0];
      if (internal) setMonitorMicId(internal.deviceId);
    });

    // Init both lines
    initLine(0);
    initLine(1);

    // Load call history
    loadHistory();

    return () => {
      Object.values(timersRef.current).forEach(clearInterval);
      linesRef.current.forEach(line => {
        try { line.device?.destroy(); } catch {}
      });
    };
  }, []);

  const updateLine = (idx, updates) => {
    setLines(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
  };

  const initLine = async (idx) => {
    updateLine(idx, { status:'initializing', statusMsg:'Getting token…' });
    try {
      const tokenRes = await base44.functions.invoke('twilioClientToken2', {});
      const token = tokenRes?.data?.token;
      if (!token) throw new Error('No token');

      const device = new Device(token, {
        codecPreferences: ['opus', 'pcmu'],
        fakeLocalDTMF: true,
        enableRingingState: true,
        logLevel: 'error',
        ...(selectedMicId ? { audioConstraints: { deviceId: { exact: selectedMicId } } } : {}),
      });

      device.on('registered', () => updateLine(idx, { status:'ready', statusMsg:'Ready', device }));
      device.on('error', (err) => updateLine(idx, { statusMsg:`Error: ${err.message}`, status:'idle' }));
      device.on('tokenWillExpire', async () => {
        try {
          const res = await base44.functions.invoke('twilioClientToken2', {});
          if (res?.data?.token) device.updateToken(res.data.token);
        } catch {}
      });

      await device.register();
      updateLine(idx, { device, status:'ready', statusMsg:'Ready' });
    } catch(e) {
      updateLine(idx, { status:'idle', statusMsg:`Init failed: ${e.message}` });
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const results = await base44.entities.LeadHistory.filter({ type: 'call' });
      results.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setCallHistory(results.slice(0, 100));
    } catch {}
    setHistoryLoading(false);
  };

  const startTimer = (idx) => {
    clearInterval(timersRef.current[idx]);
    const start = Date.now();
    timersRef.current[idx] = setInterval(() => {
      setLines(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], duration: Math.floor((Date.now() - start) / 1000) };
        return next;
      });
    }, 1000);
  };

  const stopTimer = (idx) => clearInterval(timersRef.current[idx]);

  const dial = async (idx) => {
    const line = linesRef.current[idx];
    if (!line.device || !['ready','ended'].includes(line.status)) return;
    const to = line.lead?.phone || line.manualNumber;
    if (!to) return;

    updateLine(idx, { status:'calling', statusMsg:'Connecting…', duration:0, callSid:null });

    try {
      const call = await line.device.connect({
        params: { To: to, FromLine: LINE_CONFIG[idx].key },
      });

      call.on('ringing', () => updateLine(idx, { status:'ringing', statusMsg:'Ringing…', call }));
      call.on('accept', (c) => {
        const sid = c.parameters?.CallSid || null;
        updateLine(idx, { status:'connected', statusMsg:'Connected', callSid:sid, call });
        startTimer(idx);
        onCallStart?.();
        // Expose remote (prospect) + local (agent) streams for ScriptAssistant
        try {
          const remoteStream = c.getRemoteStream?.() || null;
          const localStream  = c.getLocalStream?.()  || null;
          onCallStream?.({ remoteStream, localStream, call: c });
        } catch (e) { console.warn('[TwilioDialer2] getRemoteStream failed:', e.message); }
      });
      call.on('disconnect', () => {
        stopTimer(idx);
        const dur = linesRef.current[idx].duration;
        const sid = linesRef.current[idx].callSid;
        updateLine(idx, { status:'ended', statusMsg:'Call Ended', call:null });
        if (linesRef.current[idx].lead?.id) {
          base44.entities.LeadHistory.create({
            leadId: linesRef.current[idx].lead.id,
            type: 'call',
            content: `Call via Dialer 2 Line ${idx+1} — ${fmt(dur)}`,
            callDurationSeconds: dur,
            twilioCallSid: sid,
          }).catch(() => {});
          onCallLogged?.(linesRef.current[idx].lead.id);
        }
        onCallEnd?.(); onCallStream?.(null);
        loadHistory();
      });
      call.on('error', (err) => {
        stopTimer(idx);
        updateLine(idx, { status:'ended', statusMsg:`Error: ${err.message}`, call:null });
      });

      updateLine(idx, { call, status:'calling' });
    } catch(e) {
      updateLine(idx, { status:'ready', statusMsg:`Failed: ${e.message}` });
    }
  };

  const hangup = (idx) => {
    const line = linesRef.current[idx];
    try { line.call?.disconnect(); } catch {}
    stopTimer(idx);
    updateLine(idx, { status:'ready', statusMsg:'Ready', call:null, callSid:null, duration:0 });
  };

  const toggleMute = (idx) => {
    const line = linesRef.current[idx];
    const newMuted = !line.muted;
    try { line.call?.mute(newMuted); } catch {}
    updateLine(idx, { muted: newMuted });
  };

  // ── Monitor / Barge ───────────────────────────────────────────────────
  const startMonitor = async (idx, mode) => {
    const line = linesRef.current[idx];
    if (!line.callSid) return;

    // If already monitoring, disconnect first
    if (line.monitorCall) {
      try { line.monitorCall.disconnect(); } catch {}
      updateLine(idx, { monitorCall:null, monitorMode:null });
      if (line.monitorMode === mode) return; // toggle off
    }

    try {
      // Use the monitor device (line 0's device for listen, barge uses its own)
      const monitorDevice = linesRef.current[0].device || linesRef.current[1].device;
      if (!monitorDevice) return;

      const monitorCall = await monitorDevice.connect({
        params: {
          To: line.callSid,
          MonitorMode: mode, // 'listen' or 'barge'
          FromLine: 'MONITOR',
        },
      });

      monitorCall.on('disconnect', () => updateLine(idx, { monitorCall:null, monitorMode:null }));
      updateLine(idx, { monitorCall, monitorMode: mode });
    } catch(e) {
      setError(`Monitor failed: ${e.message}`);
    }
  };

  const statusColor = { idle:'#4a5568', initializing:'#f59e0b', ready:'#4ade80', calling:'#f59e0b', ringing:'#f59e0b', connected:'#4ade80', ended:'#6b7280' };

  const pagedHistory = callHistory.slice((historyPage-1)*HISTORY_PAGE_SIZE, historyPage*HISTORY_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(callHistory.length / HISTORY_PAGE_SIZE));

  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'9px 12px', color:'#e8e0d0', fontSize:'14px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'20px' }}>
      <div style={{ background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'8px', width:'100%', maxWidth:'680px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 40px 100px rgba(0,0,0,0.8)', fontFamily:'Georgia, serif' }}>

        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(184,147,58,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <span style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>📞 Direct Dialer 2</span>
            <span style={{ color:'#4a5568', fontSize:'11px' }}>Lines 1 & 2 ({LINE_CONFIG[0].key.slice(-1)} + {LINE_CONFIG[1].key.slice(-1)})</span>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            {/* Mic selector */}
            <select value={selectedMicId} onChange={e => setSelectedMicId(e.target.value)}
              style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'4px 8px', color:'#8a9ab8', fontSize:'10px', outline:'none', cursor:'pointer', maxWidth:'160px' }}>
              {micDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,6)}`}</option>)}
            </select>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'6px 12px', cursor:'pointer', fontSize:'11px' }}>✕ Close</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          {[['dialer','📞 Dialer'],['monitor','📡 Monitor'],['history','📋 History']].map(([id,label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ background:'none', border:'none', borderBottom: activeTab===id ? `2px solid ${GOLD}` : '2px solid transparent', color: activeTab===id ? GOLD : '#6b7280', padding:'10px 20px', cursor:'pointer', fontSize:'11px', letterSpacing:'1px' }}>
              {label}
            </button>
          ))}
        </div>

        {error && <div style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', fontSize:'11px', padding:'8px 20px' }}>{error} <button onClick={() => setError('')} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', marginLeft:'8px' }}>×</button></div>}

        {/* ── DIALER TAB ── */}
        {activeTab === 'dialer' && (
          <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'16px' }}>
            {lines.map((line, idx) => {
              const lc = LINE_CONFIG[idx];
              const isActive = ['calling','ringing','connected'].includes(line.status);
              return (
                <div key={idx} style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${isActive ? lc.color + '55' : 'rgba(255,255,255,0.07)'}`, borderLeft:`4px solid ${lc.color}`, borderRadius:'8px', padding:'16px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:statusColor[line.status], boxShadow:`0 0 8px ${statusColor[line.status]}` }} />
                      <span style={{ color:lc.color, fontSize:'12px', fontWeight:'bold', letterSpacing:'1px' }}>{lc.label}</span>
                      <span style={{ color:'#4a5568', fontSize:'10px' }}>{lc.key}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <span style={{ color:statusColor[line.status], fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px' }}>{line.statusMsg}</span>
                      {line.status === 'connected' && <span style={{ color:'#4ade80', fontFamily:'monospace', fontSize:'13px', fontWeight:'bold' }}>{fmt(line.duration)}</span>}
                    </div>
                  </div>

                  {/* Number input */}
                  <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
                    <input
                      value={line.lead?.phone || line.manualNumber}
                      onChange={e => updateLine(idx, { manualNumber: e.target.value })}
                      placeholder="Enter number or select lead…"
                      disabled={isActive}
                      style={{ ...inp, flex:1, fontSize:'13px' }}
                      onKeyDown={e => { if(e.key==='Enter' && !isActive) dial(idx); }}
                    />
                    {line.lead && (
                      <button onClick={() => updateLine(idx, { lead:null, manualNumber:'' })}
                        style={{ background:'rgba(255,255,255,0.05)', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'8px', cursor:'pointer', fontSize:'12px' }}>×</button>
                    )}
                  </div>

                  {line.lead && (
                    <div style={{ color:'#8a9ab8', fontSize:'11px', marginBottom:'8px' }}>
                      👤 {line.lead.firstName} {line.lead.lastName} · {line.lead.state || '—'}
                    </div>
                  )}

                  {/* Controls */}
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                    {line.status === 'ready' && (
                      <button onClick={() => dial(idx)}
                        style={{ flex:1, background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', border:'none', borderRadius:'6px', padding:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }}>
                        📞 Call
                      </button>
                    )}
                    {isActive && (
                      <>
                        <button onClick={() => hangup(idx)}
                          style={{ flex:1, background:'linear-gradient(135deg,#ef4444,#b91c1c)', color:'#fff', border:'none', borderRadius:'6px', padding:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }}>
                          📵 Hang Up
                        </button>
                        <button onClick={() => toggleMute(idx)}
                          style={{ background: line.muted ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.07)', color: line.muted ? '#f59e0b' : '#8a9ab8', border:`1px solid ${line.muted ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius:'6px', padding:'10px 14px', cursor:'pointer', fontSize:'12px' }}>
                          {line.muted ? '🔇 Muted' : '🎙 Mute'}
                        </button>
                      </>
                    )}
                    {line.status === 'ended' && (
                      <button onClick={() => updateLine(idx, { status:'ready', statusMsg:'Ready', duration:0 })}
                        style={{ flex:1, background:'rgba(255,255,255,0.06)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', padding:'10px', cursor:'pointer', fontSize:'12px' }}>
                        ↻ Reset
                      </button>
                    )}
                    {line.status === 'initializing' && (
                      <button onClick={() => initLine(idx)}
                        style={{ flex:1, background:'rgba(245,158,11,0.1)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.25)', borderRadius:'6px', padding:'10px', cursor:'pointer', fontSize:'12px' }}>
                        ⏳ Initializing…
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── MONITOR TAB ── */}
        {activeTab === 'monitor' && (
          <div style={{ padding:'20px' }}>
            <div style={{ marginBottom:'16px' }}>
              <h3 style={{ color:'#e8e0d0', margin:'0 0 4px', fontSize:'16px', fontWeight:'normal' }}>📡 Line Monitor</h3>
              <p style={{ color:'#6b7280', fontSize:'12px', margin:0 }}>Listen or barge into live calls without the other party knowing you're listening.</p>
            </div>

            {/* Monitor mic selector */}
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px', background:'rgba(0,0,0,0.15)', borderRadius:'6px', padding:'10px 14px' }}>
              <span style={{ color:'#4a5568', fontSize:'10px', textTransform:'uppercase', letterSpacing:'1.5px', flexShrink:0 }}>🎙 Monitor Mic</span>
              <select value={monitorMicId} onChange={e => setMonitorMicId(e.target.value)}
                style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'5px 8px', color:'#e8e0d0', fontSize:'11px', outline:'none', cursor:'pointer' }}>
                {micDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,6)}`}</option>)}
              </select>
              <span style={{ color:'#4a5568', fontSize:'9px', flexShrink:0 }}>Used for Barge only</span>
            </div>

            {/* Line status cards */}
            {lines.map((line, idx) => {
              const lc = LINE_CONFIG[idx];
              const isLive = line.status === 'connected';
              const isListening = line.monitorMode === 'listen';
              const isBarging = line.monitorMode === 'barge';

              return (
                <div key={idx} style={{ background: isLive ? 'rgba(74,222,128,0.04)' : 'rgba(255,255,255,0.02)', border:`1px solid ${isLive ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.07)'}`, borderLeft:`4px solid ${lc.color}`, borderRadius:'8px', padding:'16px', marginBottom:'12px' }}>
                  
                  {/* Line header */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:statusColor[line.status], boxShadow: isLive ? `0 0 8px ${statusColor[line.status]}` : 'none' }} />
                      <span style={{ color:lc.color, fontSize:'13px', fontWeight:'bold' }}>{lc.label}</span>
                      <span style={{ color:statusColor[line.status], fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px' }}>{line.status}</span>
                    </div>
                    {isLive && <span style={{ color:'#4ade80', fontFamily:'monospace', fontSize:'14px', fontWeight:'bold' }}>{fmt(line.duration)}</span>}
                  </div>

                  {/* Call details */}
                  {isLive && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'14px' }}>
                      <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:'4px', padding:'8px' }}>
                        <div style={{ color:'#4a5568', fontSize:'8px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px' }}>Lead</div>
                        <div style={{ color:'#e8e0d0', fontSize:'12px', fontWeight:'bold' }}>{line.lead ? `${line.lead.firstName} ${line.lead.lastName}` : '—'}</div>
                      </div>
                      <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:'4px', padding:'8px' }}>
                        <div style={{ color:'#4a5568', fontSize:'8px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px' }}>Phone</div>
                        <div style={{ color:'#4ade80', fontFamily:'monospace', fontSize:'12px' }}>{line.lead?.phone || line.manualNumber || '—'}</div>
                      </div>
                      <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:'4px', padding:'8px' }}>
                        <div style={{ color:'#4a5568', fontSize:'8px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px' }}>Duration</div>
                        <div style={{ color:'#f59e0b', fontFamily:'monospace', fontSize:'12px', fontWeight:'bold' }}>{fmt(line.duration)}</div>
                      </div>
                    </div>
                  )}

                  {!isLive && (
                    <div style={{ color:'#4a5568', fontSize:'12px', marginBottom:'12px', textAlign:'center', padding:'8px' }}>
                      No active call on this line
                    </div>
                  )}

                  {/* Monitor controls */}
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button
                      onClick={() => startMonitor(idx, 'listen')}
                      disabled={!isLive}
                      style={{
                        flex:1, padding:'9px', borderRadius:'6px', cursor: isLive ? 'pointer' : 'not-allowed',
                        background: isListening ? 'rgba(96,165,250,0.25)' : 'rgba(96,165,250,0.08)',
                        color: isListening ? '#60a5fa' : isLive ? '#60a5fa' : '#4a5568',
                        border:`1px solid ${isListening ? 'rgba(96,165,250,0.5)' : 'rgba(96,165,250,0.2)'}`,
                        fontWeight: isListening ? 'bold' : 'normal', fontSize:'12px',
                      }}>
                      {isListening ? '🔊 Listening…' : '👂 Listen'}
                    </button>
                    <button
                      onClick={() => startMonitor(idx, 'barge')}
                      disabled={!isLive}
                      style={{
                        flex:1, padding:'9px', borderRadius:'6px', cursor: isLive ? 'pointer' : 'not-allowed',
                        background: isBarging ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.08)',
                        color: isBarging ? '#ef4444' : isLive ? '#ef4444' : '#4a5568',
                        border:`1px solid ${isBarging ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.2)'}`,
                        fontWeight: isBarging ? 'bold' : 'normal', fontSize:'12px',
                      }}>
                      {isBarging ? '🎙 Barging In…' : '🎤 Barge In'}
                    </button>
                    {(isListening || isBarging) && (
                      <button onClick={() => { try { line.monitorCall?.disconnect(); } catch {} updateLine(idx, { monitorCall:null, monitorMode:null }); }}
                        style={{ background:'rgba(255,255,255,0.06)', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', padding:'9px 14px', cursor:'pointer', fontSize:'12px' }}>
                        Stop
                      </button>
                    )}
                  </div>

                  {isListening && <div style={{ color:'#60a5fa', fontSize:'10px', marginTop:'6px', textAlign:'center' }}>🔇 Silent — caller cannot hear you</div>}
                  {isBarging  && <div style={{ color:'#ef4444', fontSize:'10px', marginTop:'6px', textAlign:'center' }}>🎙 Both parties can hear you</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === 'history' && (
          <div style={{ padding:'20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <div>
                <h3 style={{ color:'#e8e0d0', margin:'0 0 2px', fontSize:'16px', fontWeight:'normal' }}>📋 Call History</h3>
                <p style={{ color:'#6b7280', fontSize:'12px', margin:0 }}>{callHistory.length} calls · Page {historyPage} of {totalPages}</p>
              </div>
              <button onClick={loadHistory} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'5px 12px', cursor:'pointer', fontSize:'11px' }}>↻ Refresh</button>
            </div>

            {historyLoading && <div style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading…</div>}

            {!historyLoading && callHistory.length === 0 && (
              <div style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>No call history yet</div>
            )}

            {!historyLoading && (
              <>
                <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'16px' }}>
                  {pagedHistory.map((call, i) => (
                    <div key={call.id || i} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:'12px', alignItems:'center', padding:'10px 14px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'6px' }}>
                      <div>
                        <div style={{ color:'#e8e0d0', fontSize:'12px', fontWeight:'bold', marginBottom:'2px' }}>
                          {call.content?.slice(0, 60) || 'Call'}
                        </div>
                        <div style={{ color:'#4a5568', fontSize:'10px' }}>{call.leadId || '—'}</div>
                      </div>
                      <div style={{ color:'#4ade80', fontFamily:'monospace', fontSize:'11px', whiteSpace:'nowrap' }}>
                        {call.callDurationSeconds ? fmt(call.callDurationSeconds) : '—'}
                      </div>
                      <div style={{ color:'#6b7280', fontSize:'10px', whiteSpace:'nowrap', textAlign:'right' }}>
                        {fmtDate(call.created_date)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'8px' }}>
                    <button onClick={() => setHistoryPage(p => Math.max(1, p-1))} disabled={historyPage===1}
                      style={{ background:'rgba(255,255,255,0.05)', color: historyPage===1 ? '#4a5568' : '#e8e0d0', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'5px 14px', cursor: historyPage===1 ? 'not-allowed' : 'pointer', fontSize:'12px' }}>← Prev</button>
                    <span style={{ color:'#6b7280', fontSize:'12px' }}>Page {historyPage} of {totalPages}</span>
                    <button onClick={() => setHistoryPage(p => Math.min(totalPages, p+1))} disabled={historyPage===totalPages}
                      style={{ background:'rgba(255,255,255,0.05)', color: historyPage===totalPages ? '#4a5568' : '#e8e0d0', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'5px 14px', cursor: historyPage===totalPages ? 'not-allowed' : 'pointer', fontSize:'12px' }}>Next →</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}