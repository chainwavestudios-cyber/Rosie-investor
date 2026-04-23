import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

import { Device } from '@twilio/voice-sdk';

// ── Constants ─────────────────────────────────────────────────────────────
const GOLD         = '#b8933a';
const DARK         = '#0a0f1e';
const CALLBACK_URL = 'https://www.rosieai.tech/api/apps/69cd2741578c9b5ce655395b/functions/twilioCallCallback';

const DEFAULT_SETTINGS = {
  lineCount: 2,
  lines: ['TWILIO_FROM_NUMBER', 'TWILIO_FROM_NUMBER_2'],
  wrapUpTime: 30,
  maxRingTime: 19,
  maxAttempts: 3,
  retryPeriodMinutes: 30,
};

const LINE_OPTIONS = [
  { key: 'TWILIO_FROM_NUMBER',   label: 'Line 1' },
  { key: 'TWILIO_FROM_NUMBER_2', label: 'Line 2' },
  { key: 'TWILIO_FROM_NUMBER_3', label: 'Line 3' },
];

const LINE_COLORS = {
  idle: '#4a5568', calling: '#f59e0b', ringing: '#f59e0b',
  connected: '#4ade80', human: '#4ade80', ended: '#6b7280',
  voicemail: '#a78bfa', no_answer: '#ef4444', abandoned: '#ef4444',
};

const STATUS_LABEL = {
  idle: 'Idle', calling: 'Calling…', ringing: 'Ringing…',
  connected: 'Connected', human: '🟢 Human!',
  ended: 'Ended', voicemail: 'Voicemail', no_answer: 'No Answer', abandoned: 'Abandoned',
};

const LOG_COLORS = {
  call: '#f59e0b', human: '#4ade80', voicemail: '#a78bfa',
  no_answer: '#ef4444', abandoned: '#ef4444', connected: '#4ade80',
  ended: '#6b7280', error: '#ef4444', system: '#60a5fa',
};

// ── Helpers ───────────────────────────────────────────────────────────────
const fmt = (secs) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

const blankLine = () => ({ lead: null, callSid: null, status: 'idle', duration: 0, amdResult: null });

// ── Settings Panel ────────────────────────────────────────────────────────
function SettingsPanel({ settings, onChange }) {
  const inp = {
    width: '100%', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
    padding: '8px 12px', color: '#e8e0d0', fontSize: '13px',
    outline: 'none', boxSizing: 'border-box',
  };

  const toggleLine = (key) => {
    const cur = settings.lines;
    if (cur.includes(key)) {
      if (cur.length <= 2) return;
      onChange({ ...settings, lines: cur.filter(k => k !== key), lineCount: cur.length - 1 });
    } else {
      if (cur.length >= 3) return;
      onChange({ ...settings, lines: [...cur, key], lineCount: cur.length + 1 });
    }
  };

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '20px', marginBottom: '16px' }}>
      <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>⚙️ Dialer Settings</div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
          Active Lines (2–3)
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {LINE_OPTIONS.map(({ key, label }) => {
            const active = settings.lines.includes(key);
            return (
              <button key={key} onClick={() => toggleLine(key)} style={{
                flex: 1, padding: '10px', borderRadius: '8px',
                border: `2px solid ${active ? GOLD : 'rgba(255,255,255,0.1)'}`,
                background: active ? 'rgba(184,147,58,0.15)' : 'transparent',
                color: active ? GOLD : '#6b7280',
                cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
              }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {[
          ['Wrap-Up Time (sec)', 'wrapUpTime',         0,     300,   'After-call pause before next dial'],
          ['Max Ring Time (sec)', 'maxRingTime',        10,    60,    'Recommended: 19–20s'],
          ['Max Attempts',        'maxAttempts',        1,     40,    'Per number before skipping'],
          ['Retry Period (min)',   'retryPeriodMinutes', 1,     43200, 'Wait before redialing'],
        ].map(([label, key, min, max, hint]) => (
          <div key={key}>
            <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</label>
            <input type="number" min={min} max={max} value={settings[key]}
              onChange={e => onChange({ ...settings, [key]: Number(e.target.value) })}
              style={inp} />
            <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '3px' }}>{hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Line Card ─────────────────────────────────────────────────────────────
function LineCard({ line, index, onHangup }) {
  const col      = LINE_COLORS[line.status] || '#4a5568';
  const isHuman  = line.status === 'human' || line.status === 'connected';
  const isActive = ['calling', 'ringing', 'connected', 'human'].includes(line.status);

  return (
    <div style={{
      background: isHuman ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isHuman ? 'rgba(74,222,128,0.5)' : isActive ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`,
      borderLeft: `4px solid ${col}`,
      borderRadius: '10px', padding: '14px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      transition: 'all 0.2s',
      boxShadow: isHuman ? '0 0 20px rgba(74,222,128,0.2)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
        <div style={{
          width: '10px', height: '10px', borderRadius: '50%', background: col, flexShrink: 0,
          boxShadow: isActive ? `0 0 8px ${col}` : 'none',
          animation: isActive && !isHuman ? 'pulse 1.5s infinite' : 'none',
        }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>
            {LINE_OPTIONS[index]?.label || `Line ${index + 1}`}
          </div>
          <div style={{ color: isHuman ? '#4ade80' : '#e8e0d0', fontSize: '14px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {line.lead ? `${line.lead.firstName} ${line.lead.lastName}` : 'Waiting…'}
          </div>
          {line.lead?.phone && (
            <div style={{ color: '#6b7280', fontSize: '12px', fontFamily: 'monospace' }}>{line.lead.phone}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {line.duration > 0 && (
          <div style={{ color: isHuman ? '#4ade80' : '#8a9ab8', fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>
            {fmt(line.duration)}
          </div>
        )}
        <span style={{ color: col, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
          {STATUS_LABEL[line.status] || 'Idle'}
        </span>
        {isActive && line.callSid && !isHuman && (
          <button onClick={() => onHangup(line.callSid)} style={{
            background: 'rgba(239,68,68,0.15)', color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px',
            padding: '5px 10px', cursor: 'pointer', fontSize: '12px',
          }}>📵</button>
        )}
      </div>
    </div>
  );
}

// ── Log Panel ─────────────────────────────────────────────────────────────
function LogPanel({ logs }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>
        Activity Log
      </div>
      <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '4px' }}>
        {logs.length === 0 && (
          <div style={{ color: '#4a5568', fontSize: '12px', padding: '20px', textAlign: 'center' }}>No activity yet</div>
        )}
        {logs.map((log, i) => (
          <div key={i} style={{ padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '11px' }}>
            <span style={{ color: LOG_COLORS[log.type] || '#8a9ab8' }}>{log.msg}</span>
            <span style={{ color: '#4a5568', fontSize: '10px', float: 'right' }}>{log.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Predictive Dialer ────────────────────────────────────────────────
export default function PredictiveDialer({ contactLists, onClose, onCallLogged, onLeadConnected }) {
  const [settings, setSettings]               = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings]       = useState(true);
  const [selectedListId, setSelectedListId]   = useState('');
  const [started, setStarted]                 = useState(false);
  const [running, setRunning]                 = useState(false);
  const [lines, setLines]                     = useState([blankLine(), blankLine(), blankLine()]);
  const [logs, setLogs]                       = useState([]);
  const [wrapUpCountdown, setWrapUpCountdown] = useState(0);
  const [stats, setStats]                     = useState({ dialed: 0, humans: 0, voicemails: 0, abandoned: 0 });
  const [queue, setQueue]                     = useState([]);
  const [queueIndex, setQueueIndex]           = useState(0);
  const [twilioDevice, setTwilioDevice]       = useState(null);
  const [activeCall, setActiveCall]           = useState(null);
  const [deviceReady, setDeviceReady]         = useState(false);
  const [micDevices, setMicDevices]           = useState([]);
  const [selectedMicId, setSelectedMicId]     = useState('');

  const linesRef       = useRef(lines);
  const queueRef       = useRef([]);
  const queueIndexRef  = useRef(0);
  const runningRef     = useRef(false);
  const settingsRef    = useRef(settings);
  const timersRef      = useRef({});
  const pollsRef       = useRef({});
  const ringTimersRef  = useRef({});
  const wrapTimerRef   = useRef(null);
  const connectingRef  = useRef(false);
  const deviceRef      = useRef(null);

  linesRef.current    = lines;
  runningRef.current  = running;
  settingsRef.current = settings;

  // ── Logging ──────────────────────────────────────────────────────────
  const addLog = useCallback((type, msg) => {
    setLogs(prev => [{ type, msg, time: fmtTime(new Date()) }, ...prev].slice(0, 150));
  }, []);

  // ── Twilio Device Init ────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      // Request microphone
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(d => d.kind === 'audioinput');
        setMicDevices(mics);
        if (mics.length > 0) setSelectedMicId(mics[0].deviceId);
      } catch {
        addLog('error', '🎤 Microphone access denied — please allow mic and refresh');
        return;
      }

      // Get access token
      let token;
      try {
        const tokenRes = await base44.functions.invoke('twilioClientToken', {});
        token = tokenRes?.data?.token;
        if (!token) throw new Error('No token returned');
      } catch (e) {
        addLog('error', `Token fetch failed: ${e.message}`);
        return;
      }

      // Initialize Twilio Device v2
      try {
        const device = new Device(token, {
          codecPreferences: ['opus', 'pcmu'],
          fakeLocalDTMF: true,
          enableRingingState: true,
          logLevel: 'error',
          ...(selectedMicId ? { audioConstraints: { deviceId: { exact: selectedMicId } } } : {}),
        });

        device.on('registered', () => {
          addLog('system', '📞 Twilio ready');
          setDeviceReady(true);
        });
        device.on('error', (err) => {
          addLog('error', `Twilio: ${err.message || err.description || 'Unknown error'}`);
        });
        device.on('incoming', (call) => {
          addLog('system', `Incoming call from ${call.parameters.From}`);
        });
        device.on('tokenWillExpire', async () => {
          try {
            const res = await base44.functions.invoke('twilioClientToken', {});
            if (res?.data?.token) device.updateToken(res.data.token);
          } catch {}
        });
        device.on('unregistered', () => {
          addLog('error', 'Twilio device unregistered');
          setDeviceReady(false);
        });

        await device.register();
        deviceRef.current = device;
        setTwilioDevice(device);

      } catch (e) {
        addLog('error', `Twilio init failed: ${e.message}`);
      }
    };

    init();

    return () => {
      Object.values(timersRef.current).forEach(clearInterval);
      Object.values(pollsRef.current).forEach(clearInterval);
      Object.values(ringTimersRef.current).forEach(clearTimeout);
      clearInterval(wrapTimerRef.current);
      try { deviceRef.current?.destroy(); } catch {}
    };
  }, [addLog]);

  // ── Lead Loading ──────────────────────────────────────────────────────
  const loadLeads = async (listId) => {
    const all = await base44.entities.Lead.filter({ contactListId: listId });
    const now = new Date();
    const s   = settingsRef.current;

    const dialable = all.filter(l => {
      if (!l.phone) return false;
      if (['not_interested', 'converted', 'do_not_call'].includes(l.status)) return false;
      if ((l.callAttempts || 0) >= s.maxAttempts) return false;
      if (l.lastCalledAt) {
        const retryAfter = new Date(new Date(l.lastCalledAt).getTime() + s.retryPeriodMinutes * 60000);
        if (retryAfter > now) return false;
      }
      return true;
    });

    const neverCalled = dialable.filter(l => !l.lastCalledAt).sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    const called      = dialable.filter(l =>  l.lastCalledAt).sort((a, b) => new Date(a.lastCalledAt) - new Date(b.lastCalledAt));
    const sorted = [...neverCalled, ...called];

    queueRef.current      = sorted;
    queueIndexRef.current = 0;
    setQueue(sorted);
    setQueueIndex(0);
    return sorted;
  };

  const handleStart = async () => {
    if (!selectedListId) return;
    addLog('system', 'Loading leads…');
    try {
      const loaded = await loadLeads(selectedListId);
      if (!loaded?.length) { addLog('error', 'No dialable leads in this list.'); return; }
      setStarted(true);
      setShowSettings(false);
      addLog('system', `✅ Loaded ${loaded.length} leads — ready to dial`);
    } catch (e) {
      addLog('error', `Load failed: ${e.message}`);
    }
  };

  const handleReset = async () => {
    if (!selectedListId) return;
    addLog('system', 'Resetting…');
    setStats({ dialed: 0, humans: 0, voicemails: 0, abandoned: 0 });
    setLines([blankLine(), blankLine(), blankLine()]);
    await loadLeads(selectedListId);
    addLog('system', `Reset — ${queueRef.current.length} leads ready`);
  };

  // ── Line Helpers ──────────────────────────────────────────────────────
  const getNextLead = () => {
    const idx = queueIndexRef.current;
    if (idx >= queueRef.current.length) return null;
    queueIndexRef.current = idx + 1;
    setQueueIndex(idx + 1);
    return queueRef.current[idx];
  };

  const updateLine = (idx, updates) => {
    setLines(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
  };

  const startLineTimer = (lineIdx) => {
    clearInterval(timersRef.current[lineIdx]);
    const start = Date.now();
    timersRef.current[lineIdx] = setInterval(() => {
      setLines(prev => {
        const next = [...prev];
        next[lineIdx] = { ...next[lineIdx], duration: Math.floor((Date.now() - start) / 1000) };
        return next;
      });
    }, 1000);
  };

  const cleanLine = (lineIdx, finalStatus) => {
    clearInterval(timersRef.current[lineIdx]);
    clearInterval(pollsRef.current[lineIdx]);
    clearTimeout(ringTimersRef.current[lineIdx]);
    updateLine(lineIdx, { status: finalStatus, callSid: null, amdResult: null });
  };

  const hangupCall = async (callSid) => {
    if (!callSid) return;
    try { await base44.functions.invoke('twilioCall', { action: 'hangupCall', callSid }); } catch {}
  };

  // ── AMD Poll — reads CallStatus entity written by webhook ─────────────
  const startAMDPoll = (lineIdx, sid, lead, attempts) => {
    clearInterval(pollsRef.current[lineIdx]);

    pollsRef.current[lineIdx] = setInterval(async () => {
      try {
        const currentLine = linesRef.current[lineIdx];
        if (!['ringing', 'calling'].includes(currentLine.status)) {
          clearInterval(pollsRef.current[lineIdx]);
          return;
        }

        const results = await base44.entities.CallStatus.filter({ callSid: sid });
        if (!results?.length) return;

        const record     = results[0];
        const answeredBy = record.answeredBy || '';
        const status     = record.status     || '';

        // ── HUMAN — connect instantly ─────────────────────────────────
        if (answeredBy === 'human') {
          clearInterval(pollsRef.current[lineIdx]);
          clearTimeout(ringTimersRef.current[lineIdx]);
          addLog('human', `Line ${lineIdx + 1}: 🟢 HUMAN ANSWERED — ${lead.firstName} ${lead.lastName}`);
          updateLine(lineIdx, { status: 'human', amdResult: 'human' });
          await handleAutoConnect(lineIdx, lead, sid);
          return;
        }

        // ── VOICEMAIL — hang up and move on ──────────────────────────
        if (['machine_end_beep', 'machine_end_silence', 'machine_end_other'].includes(answeredBy)) {
          clearInterval(pollsRef.current[lineIdx]);
          clearTimeout(ringTimersRef.current[lineIdx]);
          addLog('voicemail', `Line ${lineIdx + 1}: 📬 Voicemail — ${lead.firstName} ${lead.lastName}`);
          setStats(s => ({ ...s, voicemails: s.voicemails + 1 }));
          await hangupCall(sid);
          base44.entities.LeadHistory.create({ leadId: lead.id, type: 'not_available', content: `Voicemail detected (attempt #${attempts})`, twilioCallSid: sid }).catch(() => {});
          try { await base44.entities.CallStatus.delete(record.id); } catch {}
          cleanLine(lineIdx, 'voicemail');
          setTimeout(() => { if (runningRef.current) dialLine(lineIdx); }, 1000);
          return;
        }

        // ── FAX / MACHINE START ───────────────────────────────────────
        if (answeredBy === 'fax' || answeredBy === 'machine_start') {
          clearInterval(pollsRef.current[lineIdx]);
          clearTimeout(ringTimersRef.current[lineIdx]);
          addLog('voicemail', `Line ${lineIdx + 1}: 🤖 Machine/Fax — hanging up`);
          await hangupCall(sid);
          try { await base44.entities.CallStatus.delete(record.id); } catch {}
          cleanLine(lineIdx, 'voicemail');
          setTimeout(() => { if (runningRef.current) dialLine(lineIdx); }, 1000);
          return;
        }

        // ── CALL ENDED before AMD ─────────────────────────────────────
        if (['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(status)) {
          clearInterval(pollsRef.current[lineIdx]);
          clearTimeout(ringTimersRef.current[lineIdx]);
          addLog('no_answer', `Line ${lineIdx + 1}: ${status} — ${lead.firstName} ${lead.lastName}`);
          base44.entities.LeadHistory.create({ leadId: lead.id, type: 'not_available', content: `Call ${status} (attempt #${attempts})`, twilioCallSid: sid }).catch(() => {});
          try { await base44.entities.CallStatus.delete(record.id); } catch {}
          cleanLine(lineIdx, 'no_answer');
          setTimeout(() => { if (runningRef.current) dialLine(lineIdx); }, 1200);
        }
      } catch {}
    }, 800);
  };

  // ── Auto-Connect: hang up other lines, connect agent audio ───────────
  const handleAutoConnect = async (lineIdx, lead, callSid) => {
    if (connectingRef.current) {
      addLog('system', `Line ${lineIdx + 1}: Another line already connecting — dropping this one`);
      await hangupCall(callSid);
      cleanLine(lineIdx, 'abandoned');
      return;
    }
    connectingRef.current = true;

    addLog('human', `Line ${lineIdx + 1}: 🎧 Connecting agent…`);
    setStats(s => ({ ...s, humans: s.humans + 1 }));

    // Hang up all other lines in parallel — fire and don't wait
    const hangupPromises = [];
    for (let i = 0; i < 3; i++) {
      if (i === lineIdx) continue;
      const line = linesRef.current[i];
      if (!line.callSid) continue;
      if (!['calling', 'ringing', 'connected', 'human'].includes(line.status)) continue;

      clearInterval(pollsRef.current[i]);
      clearTimeout(ringTimersRef.current[i]);

      if (line.lead?.id) {
        addLog('abandoned', `Line ${i + 1}: ⚡ Dropped — ${line.lead.firstName} ${line.lead.lastName}`);
        setStats(s => ({ ...s, abandoned: s.abandoned + 1 }));
        hangupPromises.push(
          hangupCall(line.callSid).then(() =>
            base44.entities.LeadHistory.create({
              leadId: line.lead.id, type: 'call',
              content: `⚠️ ABANDONED — Line ${lineIdx + 1} connected first`,
              callDurationSeconds: line.duration,
              twilioCallSid: line.callSid,
            }).catch(() => {})
          )
        );
      } else {
        hangupPromises.push(hangupCall(line.callSid));
      }
      cleanLine(i, 'ended');
    }
    Promise.all(hangupPromises).catch(() => {});

    // Connect agent audio
    try {
      const device = deviceRef.current;
      if (!device) throw new Error('Twilio device not ready');

      // v2 SDK: device.connect() returns a Call object
      const call = await device.connect({ params: { CallSid: callSid } });

      call.on('disconnect', () => {
        addLog('system', 'Call audio disconnected');
        setActiveCall(null);
      });
      call.on('error', (err) => {
        addLog('error', `Call error: ${err.message}`);
      });

      updateLine(lineIdx, { status: 'connected' });
      setActiveCall(call);
      addLog('connected', `Line ${lineIdx + 1}: 🎧 Connected — ${lead.firstName} ${lead.lastName}`);

      // Open contact card immediately
      onLeadConnected?.(lead);

      // Log to lead history
      if (lead?.id) {
        base44.entities.Lead.update(lead.id, { lastCalledAt: new Date().toISOString() }).catch(() => {});
        base44.entities.LeadHistory.create({
          leadId: lead.id, type: 'connected',
          content: `Connected via predictive dialer`,
          twilioCallSid: callSid,
        }).catch(() => {});
      }

      // Poll for call end
      pollsRef.current[lineIdx] = setInterval(async () => {
        try {
          const s = await base44.functions.invoke('twilioCall', { action: 'getCallStatus', callSid });
          if (['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(s.data?.status)) {
            clearInterval(pollsRef.current[lineIdx]);
            const dur = linesRef.current[lineIdx]?.duration || 0;
            base44.entities.LeadHistory.create({
              leadId: lead.id, type: 'call',
              content: `Call ended — ${fmt(dur)}`,
              callDurationSeconds: dur,
              twilioCallSid: callSid,
            }).catch(() => {});
            onCallLogged?.(lead.id);
            cleanLine(lineIdx, 'ended');
            addLog('ended', `Call ended — ${lead.firstName} ${lead.lastName} (${fmt(dur)})`);
            connectingRef.current = false;
            startWrapUp();
          }
        } catch {}
      }, 3000);

    } catch (e) {
      addLog('error', `Connect failed: ${e.message}`);
      connectingRef.current = false;
    }
  };

  // ── Wrap-Up ───────────────────────────────────────────────────────────
  const startWrapUp = () => {
    const wrapTime = settingsRef.current.wrapUpTime;
    if (wrapTime <= 0) { resumeDialing(); return; }
    setWrapUpCountdown(wrapTime);
    let rem = wrapTime;
    clearInterval(wrapTimerRef.current);
    wrapTimerRef.current = setInterval(() => {
      rem--;
      setWrapUpCountdown(rem);
      if (rem <= 0) {
        clearInterval(wrapTimerRef.current);
        setWrapUpCountdown(0);
        resumeDialing();
      }
    }, 1000);
  };

  const resumeDialing = () => {
    if (!runningRef.current) return;
    settingsRef.current.lines.forEach((_, i) => {
      const line = linesRef.current[i];
      if (['idle', 'ended', 'voicemail', 'no_answer', 'abandoned'].includes(line.status)) {
        setTimeout(() => { if (runningRef.current) dialLine(i); }, i * 400);
      }
    });
  };

  // ── Dial a Single Line ────────────────────────────────────────────────
  const dialLine = useCallback(async (lineIdx) => {
    if (!runningRef.current) return;

    const lead = getNextLead();
    if (!lead) {
      addLog('system', `Line ${lineIdx + 1}: Queue exhausted`);
      setTimeout(() => {
        const anyActive = linesRef.current.some(l =>
          ['calling', 'ringing', 'connected', 'human'].includes(l.status)
        );
        if (!anyActive && runningRef.current) {
          addLog('system', '✅ All leads dialed — dialer complete');
          setRunning(false);
          runningRef.current = false;
        }
      }, 2000);
      return;
    }

    const s          = settingsRef.current;
    const fromNumber = s.lines[lineIdx] || 'TWILIO_FROM_NUMBER';

    updateLine(lineIdx, { lead, callSid: null, status: 'calling', duration: 0, amdResult: null });
    addLog('call', `Line ${lineIdx + 1}: Calling ${lead.firstName} ${lead.lastName} (${lead.phone})`);
    setStats(prev => ({ ...prev, dialed: prev.dialed + 1 }));

    const attempts = (lead.callAttempts || 0) + 1;
    base44.entities.Lead.update(lead.id, { lastCalledAt: new Date().toISOString(), callAttempts: attempts }).catch(() => {});
    base44.entities.LeadHistory.create({ leadId: lead.id, type: 'call', content: `Predictive dialer attempt #${attempts} — Line ${lineIdx + 1}` }).catch(() => {});

    // Max ring timeout
    ringTimersRef.current[lineIdx] = setTimeout(async () => {
      const cur = linesRef.current[lineIdx];
      if (['ringing', 'calling'].includes(cur.status) && cur.lead?.id === lead.id) {
        addLog('no_answer', `Line ${lineIdx + 1}: No answer (${s.maxRingTime}s) — ${lead.firstName} ${lead.lastName}`);
        if (cur.callSid) await hangupCall(cur.callSid);
        base44.entities.LeadHistory.create({ leadId: lead.id, type: 'not_available', content: `No answer after ${s.maxRingTime}s (attempt #${attempts})` }).catch(() => {});
        cleanLine(lineIdx, 'no_answer');
        setTimeout(() => { if (runningRef.current) dialLine(lineIdx); }, 1000);
      }
    }, s.maxRingTime * 1000);

    // Make the call
    try {
      const res = await base44.functions.invoke('twilioCallWithCPA', {
        toNumber: lead.phone,
        fromNumber,
        statusCallbackUrl: CALLBACK_URL,
      });

      const sid = res.data?.callSid;
      if (!sid) throw new Error(res.data?.error || 'No call SID returned');

      updateLine(lineIdx, { callSid: sid, status: 'ringing' });
      startLineTimer(lineIdx);
      addLog('call', `Line ${lineIdx + 1}: Ringing… (AMD active)`);

      startAMDPoll(lineIdx, sid, lead, attempts);

    } catch (e) {
      clearTimeout(ringTimersRef.current[lineIdx]);
      addLog('error', `Line ${lineIdx + 1}: Failed — ${e.message}`);
      cleanLine(lineIdx, 'no_answer');
      setTimeout(() => { if (runningRef.current) dialLine(lineIdx); }, 2000);
    }
  }, []);

  // ── Start / Stop ──────────────────────────────────────────────────────
  const startDialing = () => {
    if (!deviceReady) {
      addLog('error', 'Twilio not ready — please wait a moment and try again');
      return;
    }
    connectingRef.current = false;
    setRunning(true);
    runningRef.current = true;
    const rem = queueRef.current.length - queueIndexRef.current;
    addLog('system', `🚀 Starting — ${rem} leads, ${settings.lines.length} lines`);
    settings.lines.forEach((_, i) => {
      setTimeout(() => dialLine(i), i * 600);
    });
  };

  const stopDialing = async () => {
    setRunning(false);
    runningRef.current  = false;
    connectingRef.current = false;
    clearInterval(wrapTimerRef.current);
    setWrapUpCountdown(0);
    Object.values(pollsRef.current).forEach(clearInterval);
    Object.values(timersRef.current).forEach(clearInterval);
    Object.values(ringTimersRef.current).forEach(clearTimeout);

    for (const line of linesRef.current) {
      if (line.callSid && ['calling', 'ringing', 'connected', 'human'].includes(line.status)) {
        await hangupCall(line.callSid);
      }
    }
    if (activeCall) { try { activeCall.disconnect(); } catch {} }
    setLines([blankLine(), blankLine(), blankLine()]);
    addLog('system', '■ Dialer stopped');
  };

  // ── Render ────────────────────────────────────────────────────────────
  const remaining = Math.max(0, queue.length - queueIndex);
  const isMobile  = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div style={{ fontFamily: 'Georgia, serif' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '10px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: running ? '#4ade80' : '#4a5568', boxShadow: running ? '0 0 8px #4ade80' : 'none' }} />
          <h3 style={{ color: GOLD, margin: 0, fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase' }}>Predictive Dialer</h3>
          {!deviceReady && <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', animation: 'pulse 1.5s infinite' }}>⏳ Initializing…</span>}
          {deviceReady && !running && <span style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '4px', padding: '2px 8px', fontSize: '10px' }}>✓ Ready</span>}
          {running && <span style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '4px', padding: '2px 10px', fontSize: '10px', animation: 'pulse 2s infinite' }}>● LIVE</span>}
          {wrapUpCountdown > 0 && <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '2px 10px', fontSize: '11px' }}>⏱ Wrap-up: {wrapUpCountdown}s</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowSettings(s => !s)} style={{ background: 'rgba(255,255,255,0.06)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>
            ⚙️ {showSettings ? 'Hide' : 'Settings'}
          </button>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <>
          <SettingsPanel settings={settings} onChange={setSettings} />
          {micDevices.length > 0 && (
            <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#8a9ab8', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', flexShrink: 0 }}>🎙 Microphone</span>
              <select value={selectedMicId} onChange={e => setSelectedMicId(e.target.value)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '7px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', cursor: 'pointer' }}>
                {micDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 6)}`}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <select value={selectedListId} onChange={e => setSelectedListId(e.target.value)} style={{
              flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px', padding: '10px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', cursor: 'pointer',
            }}>
              <option value="">— Select Contact List —</option>
              {contactLists.map(list => (
                <option key={list.id} value={list.id}>{list.name} ({list.leadCount || 0} leads)</option>
              ))}
            </select>
            {!started ? (
              <button onClick={handleStart} disabled={!selectedListId} style={{
                padding: '10px 24px', whiteSpace: 'nowrap', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px',
                background: !selectedListId ? 'rgba(184,147,58,0.2)' : `linear-gradient(135deg,${GOLD},#d4aa50)`,
                color: DARK, border: 'none', borderRadius: '6px', cursor: !selectedListId ? 'not-allowed' : 'pointer',
              }}>Load Leads</button>
            ) : (
              <button onClick={handleReset} style={{
                padding: '10px 24px', whiteSpace: 'nowrap', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px',
                background: 'rgba(96,165,250,0.15)', color: '#60a5fa',
                border: '1px solid rgba(96,165,250,0.3)', borderRadius: '6px', cursor: 'pointer',
              }}>↻ Reset</button>
            )}
          </div>
        </>
      )}

      {/* Stats */}
      {started && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: '8px', marginBottom: '14px' }}>
          {[
            [queue.length,    'Total',     GOLD],
            [queueIndex,      'Dialed',    '#60a5fa'],
            [remaining,       'Remaining', '#a78bfa'],
            [stats.humans,    'Connected', '#4ade80'],
            [stats.abandoned, 'Abandoned', '#ef4444'],
          ].map(([v, label, color]) => (
            <div key={label} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: isMobile ? '6px' : '8px', textAlign: 'center' }}>
              <div style={{ color, fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold' }}>{v}</div>
              <div style={{ color: '#4a5568', fontSize: isMobile ? '8px' : '9px', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Line Cards */}
      {started && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
          {settings.lines.map((_, i) => (
            <LineCard key={i} line={lines[i]} index={i} onHangup={hangupCall} />
          ))}
        </div>
      )}

      {/* Controls */}
      {started && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          {!running ? (
            <button onClick={startDialing}
              disabled={remaining === 0 || wrapUpCountdown > 0 || !deviceReady}
              style={{
                flex: 1, fontWeight: 'bold', fontSize: isMobile ? '14px' : '13px',
                padding: isMobile ? '14px 10px' : '13px',
                border: 'none', borderRadius: '8px',
                cursor: (remaining === 0 || wrapUpCountdown > 0 || !deviceReady) ? 'not-allowed' : 'pointer',
                background: (remaining === 0 || wrapUpCountdown > 0 || !deviceReady)
                  ? 'rgba(74,222,128,0.2)'
                  : 'linear-gradient(135deg,#22c55e,#16a34a)',
                color: '#fff',
              }}>
              {!deviceReady ? '⏳ Initializing…' : remaining === 0 ? '✓ Queue Empty' : wrapUpCountdown > 0 ? `⏱ Wrap-up: ${wrapUpCountdown}s` : `▶ Start Dialing (${remaining} leads)`}
            </button>
          ) : (
            <button onClick={stopDialing} style={{
              flex: 1, fontWeight: 'bold', fontSize: isMobile ? '14px' : '13px',
              padding: isMobile ? '14px 10px' : '13px',
              background: 'linear-gradient(135deg,#ef4444,#b91c1c)',
              color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer',
            }}>■ Stop Dialer</button>
          )}
        </div>
      )}

      {/* Log */}
      {started && <LogPanel logs={logs} />}
    </div>
  );
}