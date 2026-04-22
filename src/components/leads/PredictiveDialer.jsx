import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// Load Twilio Client SDK dynamically
const loadTwilioClient = async () => {
  if (window.Twilio) return window.Twilio.Device;
  const script = document.createElement('script');
  script.src = 'https://sdk.twilio.com/js/client/v1.15.0/twilio.min.js';
  return new Promise((resolve) => {
    script.onload = () => resolve(window.Twilio.Device);
    document.body.appendChild(script);
  });
};

// Request microphone permission for mobile
const requestMicrophonePermission = async () => {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    return true;
  } catch (e) {
    console.error('Microphone permission denied:', e);
    return false;
  }
};

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const DEFAULT_SETTINGS = {
  lineCount: 2,
  lines: ['TWILIO_FROM_NUMBER', 'TWILIO_FROM_NUMBER_2'],
  wrapUpTime: 30,       // seconds after call before next dial
  maxRingTime: 19,      // seconds before giving up
  maxAttempts: 3,       // max retries per number
  retryPeriodMinutes: 30, // minutes before retry
};

const LINE_OPTIONS = [
  { key: 'TWILIO_FROM_NUMBER', label: 'Line 1' },
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
  connected: 'Connected', human: '🟢 Human Answered!',
  ended: 'Ended', voicemail: 'Voicemail', no_answer: 'No Answer', abandoned: 'Abandoned',
};

function formatDuration(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

// ── Settings Panel ────────────────────────────────────────────────────────
function SettingsPanel({ settings, onChange }) {
  const inp = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' };

  const toggleLine = (key) => {
    const current = settings.lines;
    if (current.includes(key)) {
      if (current.length <= 2) return; // min 2
      onChange({ ...settings, lines: current.filter(k => k !== key), lineCount: current.length - 1 });
    } else {
      if (current.length >= 3) return; // max 3
      onChange({ ...settings, lines: [...current, key], lineCount: current.length + 1 });
    }
  };

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '20px', marginBottom: '16px' }}>
      <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>⚙️ Dialer Settings</div>

      {/* Line Selection */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Active Lines (select 2–3)</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {LINE_OPTIONS.map(({ key, label }) => {
            const active = settings.lines.includes(key);
            return (
              <button key={key} onClick={() => toggleLine(key)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `2px solid ${active ? GOLD : 'rgba(255,255,255,0.1)'}`, background: active ? `rgba(184,147,58,0.15)` : 'transparent', color: active ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Wrap-Up Time (sec)</label>
          <input type="number" min="0" max="300" value={settings.wrapUpTime}
            onChange={e => onChange({ ...settings, wrapUpTime: Number(e.target.value) })} style={inp} />
          <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '3px' }}>After-call work time before next dial</div>
        </div>
        <div>
          <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Max Ring Time (sec)</label>
          <input type="number" min="10" max="60" value={settings.maxRingTime}
            onChange={e => onChange({ ...settings, maxRingTime: Number(e.target.value) })} style={inp} />
          <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '3px' }}>Recommended: 19–20 sec</div>
        </div>
        <div>
          <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Max Attempts per Number</label>
          <input type="number" min="1" max="40" value={settings.maxAttempts}
            onChange={e => onChange({ ...settings, maxAttempts: Number(e.target.value) })} style={inp} />
        </div>
        <div>
          <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Retry Period (minutes)</label>
          <input type="number" min="1" max="43200" value={settings.retryPeriodMinutes}
            onChange={e => onChange({ ...settings, retryPeriodMinutes: Number(e.target.value) })} style={inp} />
          <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '3px' }}>Delay before retrying a number</div>
        </div>
      </div>
    </div>
  );
}

// ── Line Card ─────────────────────────────────────────────────────────────
function LineCard({ line, index, onConnect, onHangup, isWinner }) {
  const col = LINE_COLORS[line.status] || '#4a5568';
  const isHuman = line.status === 'human';
  const isActive = ['calling', 'ringing', 'connected', 'human'].includes(line.status);

  return (
    <div style={{
      background: isHuman ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isHuman ? 'rgba(74,222,128,0.5)' : isActive ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`,
      borderLeft: `4px solid ${col}`,
      borderRadius: '10px',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      transition: 'all 0.2s',
      boxShadow: isHuman ? '0 0 20px rgba(74,222,128,0.15)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: col, flexShrink: 0, boxShadow: isActive ? `0 0 8px ${col}` : 'none' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>
            {LINE_OPTIONS[index]?.label || `Line ${index + 1}`}
          </div>
          <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {line.lead ? `${line.lead.firstName} ${line.lead.lastName}` : `Waiting…`}
          </div>
          {line.lead?.phone && <div style={{ color: '#6b7280', fontSize: '12px', fontFamily: 'monospace' }}>{line.lead.phone}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {line.duration > 0 && (
          <div style={{ color: isHuman ? '#4ade80' : '#8a9ab8', fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>{formatDuration(line.duration)}</div>
        )}
        <span style={{ color: col, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{STATUS_LABEL[line.status] || 'Idle'}</span>
        {isHuman && (
          <button onClick={() => onConnect(index)}
            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', border: 'none', borderRadius: '6px', padding: '7px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', animation: 'pulse 1s infinite' }}>
            🎧 Connect Audio
          </button>
        )}
        {isActive && line.callSid && !isHuman && (
          <button onClick={() => onHangup(line.callSid)}
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px' }}>
            📵
          </button>
        )}
      </div>
    </div>
  );
}

// ── Log Entry ─────────────────────────────────────────────────────────────
const LOG_COLORS = { call: '#f59e0b', human: '#4ade80', voicemail: '#a78bfa', no_answer: '#ef4444', abandoned: '#ef4444', connected: '#4ade80', ended: '#6b7280', error: '#ef4444', system: '#60a5fa' };

function LogPanel({ logs }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>Activity Log</div>
      <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '4px' }}>
        {logs.length === 0 && <div style={{ color: '#4a5568', fontSize: '12px', padding: '20px', textAlign: 'center' }}>No activity yet</div>}
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
export default function PredictiveDialer({ contactLists, onClose, onCallLogged }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(true);
  const [selectedListId, setSelectedListId] = useState('');
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);

  const [leads, setLeads] = useState([]);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [lines, setLines] = useState([
    { lead: null, callSid: null, status: 'idle', duration: 0, amdResult: null },
    { lead: null, callSid: null, status: 'idle', duration: 0, amdResult: null },
    { lead: null, callSid: null, status: 'idle', duration: 0, amdResult: null },
  ]);
  const [logs, setLogs] = useState([]);
  const [wrapUpCountdown, setWrapUpCountdown] = useState(0);
  const [stats, setStats] = useState({ dialed: 0, humans: 0, voicemails: 0, abandoned: 0 });
  const [twilioDevice, setTwilioDevice] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  const linesRef = useRef(lines);
  const queueRef = useRef([]);
  const queueIndexRef = useRef(0);
  const runningRef = useRef(false);
  const timersRef = useRef({});
  const pollsRef = useRef({});
  const ringTimersRef = useRef({});
  const wrapTimerRef = useRef(null);

  linesRef.current = lines;
  runningRef.current = running;

  const addLog = useCallback((type, msg) => {
    setLogs(prev => [{ type, msg, time: formatTime(new Date()) }, ...prev].slice(0, 100));
  }, []);

  useEffect(() => {
    // Initialize Twilio Device
    const initTwilio = async () => {
      // Request microphone on mobile
      const hasMic = await requestMicrophonePermission();
      if (!hasMic) {
        addLog('error', '🎤 Please allow microphone access');
        return;
      }

      const Device = await loadTwilioClient();
      try {
        const tokenRes = await base44.functions.invoke('twilioClientToken', {});
        Device.setup(tokenRes.data.token, { 
          enableRingingState: true,
          codecPreferences: ['opus', 'pcmu'],
          fakeLocalDTMF: true,
        });
        Device.on('ready', () => addLog('system', '📞 Ready'));
        Device.on('error', (error) => addLog('error', `Error: ${error.message}`));
        Device.on('connect', (connection) => {
          addLog('connected', '🎧 Connected');
          setActiveCall(connection);
        });
        Device.on('disconnect', () => {
          addLog('system', 'Disconnected');
          setActiveCall(null);
        });
        setTwilioDevice(Device);
      } catch (e) {
        addLog('error', `Init failed: ${e.message}`);
      }
    };
    initTwilio();
    return () => {
      Object.values(timersRef.current).forEach(clearInterval);
      Object.values(pollsRef.current).forEach(clearInterval);
      Object.values(ringTimersRef.current).forEach(clearTimeout);
      clearInterval(wrapTimerRef.current);
      if (twilioDevice) twilioDevice.destroy();
    };
  }, [addLog]);

  const loadLeads = async (listId) => {
    const all = await base44.entities.Lead.filter({ contactListId: listId });
    const now = new Date();
    const dialable = all.filter(l => {
      if (!l.phone) return false;
      if (l.status === 'not_interested' || l.status === 'converted') return false;
      const attempts = l.callAttempts || 0;
      if (attempts >= settings.maxAttempts) return false;
      if (l.lastCalledAt) {
        const retryAfter = new Date(new Date(l.lastCalledAt).getTime() + settings.retryPeriodMinutes * 60 * 1000);
        if (retryAfter > now) return false;
      }
      return true;
    });
    const neverCalled = dialable.filter(l => !l.lastCalledAt).sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    const called = dialable.filter(l => l.lastCalledAt).sort((a, b) => new Date(a.lastCalledAt) - new Date(b.lastCalledAt));
    const sorted = [...neverCalled, ...called];
    queueRef.current = sorted;
    setQueue(sorted);
    setLeads(sorted);
    return sorted;
  };

  const handleStart = async () => {
    if (!selectedListId) return;
    addLog('system', 'Loading leads…');
    await loadLeads(selectedListId);
    setStarted(true);
    setShowSettings(false);
  };

  const getNextLead = () => {
    const idx = queueIndexRef.current;
    const q = queueRef.current;
    if (idx >= q.length) return null;
    queueIndexRef.current = idx + 1;
    setQueueIndex(idx + 1);
    return q[idx];
  };

  const updateLine = (idx, updates) => {
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...updates };
      return updated;
    });
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

  const cleanLine = (lineIdx, finalStatus) => {
    clearInterval(timersRef.current[lineIdx]);
    clearInterval(pollsRef.current[lineIdx]);
    clearTimeout(ringTimersRef.current[lineIdx]);
    updateLine(lineIdx, { status: finalStatus, callSid: null });
  };

  const hangupCall = async (callSid) => {
    if (!callSid) return;
    try { await base44.functions.invoke('twilioCall', { action: 'hangupCall', callSid }); } catch {}
  };

  // Auto-connect when human answers (called from CPA detection)
  const handleAutoConnect = async (lineIdx, lead, callSid) => {
    if (!twilioDevice) return;

    addLog('human', `Line ${lineIdx + 1}: 🎧 Auto-connecting agent…`);
    setStats(s => ({ ...s, humans: s.humans + 1 }));

    // Hang up all other active lines
    for (let i = 0; i < 3; i++) {
      if (i === lineIdx) continue;
      const line = linesRef.current[i];
      if (line.callSid && ['calling', 'ringing', 'connected', 'human'].includes(line.status)) {
        if (line.status === 'human' && line.lead?.id) {
          addLog('abandoned', `Line ${i + 1}: Abandoned — ${line.lead.firstName} ${line.lead.lastName}`);
          setStats(s => ({ ...s, abandoned: s.abandoned + 1 }));
          try {
            await base44.entities.Lead.update(line.lead.id, { status: 'abandoned', lastCalledAt: new Date().toISOString() });
            await base44.entities.LeadHistory.create({
              leadId: line.lead.id, type: 'call',
              content: `⚠️ ABANDONED — Another line connected first.`,
              callDurationSeconds: line.duration, twilioCallSid: line.callSid,
            });
            onCallLogged && onCallLogged(line.lead.id);
          } catch {}
        }
        await hangupCall(line.callSid);
        cleanLine(i, line.status === 'human' ? 'abandoned' : 'ended');
      }
    }

    // Connect via Twilio Client — join the existing call
    try {
      const connection = await twilioDevice.connect({ params: { CallSid: callSid } });
      updateLine(lineIdx, { status: 'connected' });
      setActiveCall(connection);

      if (lead?.id) {
        try {
          await base44.entities.Lead.update(lead.id, { lastCalledAt: new Date().toISOString() });
          await base44.entities.LeadHistory.create({
            leadId: lead.id, type: 'connected',
            content: `Auto-connected via Twilio CPA`,
            twilioCallSid: callSid,
          });
        } catch {}
      }
    } catch (e) {
      addLog('error', `Auto-connect failed: ${e.message}`);
      return;
    }

    // Poll for call end
    pollsRef.current[lineIdx] = setInterval(async () => {
      try {
        const s = await base44.functions.invoke('twilioCall', { action: 'getCallStatus', callSid });
        if (['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(s.data?.status)) {
          clearInterval(pollsRef.current[lineIdx]);
          const dur = linesRef.current[lineIdx]?.duration || 0;
          try {
            await base44.entities.LeadHistory.create({
              leadId: lead.id, type: 'call',
              content: `Call ended — ${formatDuration(dur)}`,
              callDurationSeconds: dur, twilioCallSid: callSid,
            });
            onCallLogged && onCallLogged(lead.id);
          } catch {}
          cleanLine(lineIdx, 'ended');
          addLog('ended', `Call ended — ${lead?.firstName} ${lead?.lastName} (${formatDuration(dur)})`);
          startWrapUp();
        }
      } catch {}
    }, 3000);
  };

  // Manual connect for edge cases (if needed)
  const handleConnect = async (winnerIdx) => {
    if (!twilioDevice) {
      addLog('error', 'Twilio not ready yet. Please wait…');
      return;
    }

    const winnerLine = linesRef.current[winnerIdx];
    if (!winnerLine.callSid) {
      addLog('error', 'No call SID on winner line');
      return;
    }

    await handleAutoConnect(winnerIdx, winnerLine.lead, winnerLine.callSid);
  };

  const startWrapUp = () => {
    if (settings.wrapUpTime <= 0) { resumeDialing(); return; }
    setWrapUpCountdown(settings.wrapUpTime);
    let remaining = settings.wrapUpTime;
    wrapTimerRef.current = setInterval(() => {
      remaining--;
      setWrapUpCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(wrapTimerRef.current);
        setWrapUpCountdown(0);
        resumeDialing();
      }
    }, 1000);
  };

  const resumeDialing = () => {
    if (!runningRef.current) return;
    // Restart idle lines
    for (let i = 0; i < settings.lines.length; i++) {
      const line = linesRef.current[i];
      if (line.status === 'idle' || line.status === 'ended' || line.status === 'voicemail' || line.status === 'no_answer') {
        setTimeout(() => { if (runningRef.current) dialLine(i); }, i * 500);
      }
    }
  };

  const dialLine = useCallback(async (lineIdx) => {
    const lead = getNextLead();
    if (!lead) {
      addLog('system', `Line ${lineIdx + 1}: Queue exhausted.`);
      return;
    }

    const fromNumber = settings.lines[lineIdx] || 'TWILIO_FROM_NUMBER';
    updateLine(lineIdx, { lead, callSid: null, status: 'ringing', duration: 0 });
    addLog('call', `Line ${lineIdx + 1}: Calling ${lead.firstName} ${lead.lastName} (${lead.phone})`);
    setStats(s => ({ ...s, dialed: s.dialed + 1 }));

    // Log attempt immediately
    const attempts = (lead.callAttempts || 0) + 1;
    try {
      await base44.entities.Lead.update(lead.id, { lastCalledAt: new Date().toISOString(), callAttempts: attempts });
      await base44.entities.LeadHistory.create({
        leadId: lead.id, type: 'call',
        content: `Predictive dialer attempt #${attempts} — Line ${lineIdx + 1}`,
      });
    } catch {}

    // Max ring timeout
    ringTimersRef.current[lineIdx] = setTimeout(async () => {
      const currentLine = linesRef.current[lineIdx];
      if (['ringing', 'calling'].includes(currentLine.status) && currentLine.lead?.id === lead.id) {
        if (currentLine.callSid) {
          await hangupCall(currentLine.callSid);
          try {
            await base44.entities.LeadHistory.create({
              leadId: lead.id, type: 'not_available',
              content: `No answer after ${settings.maxRingTime}s — Line ${lineIdx + 1}`,
            });
          } catch {}
        }
        addLog('no_answer', `Line ${lineIdx + 1}: No answer (${settings.maxRingTime}s) — ${lead.firstName} ${lead.lastName}`);
        cleanLine(lineIdx, 'no_answer');
        setTimeout(() => { if (runningRef.current) dialLine(lineIdx); }, 1000);
      }
    }, settings.maxRingTime * 1000);

    try {
      // Get public callback URL for this app (for status callback)
      const callbackUrl = `${window.location.origin}/api/callbacks/twilio-call-status`;
      
      const res = await base44.functions.invoke('twilioCallWithCPA', {
        toNumber: lead.phone,
        fromNumber: fromNumber,
        statusCallbackUrl: callbackUrl,
      });
      const sid = res.data?.callSid;
      if (!sid) throw new Error('No call SID returned');

      updateLine(lineIdx, { callSid: sid, status: 'ringing', amdResult: null });
      startLineTimer(lineIdx);
      addLog('call', `Line ${lineIdx + 1}: Dialing with CPA enabled…`);

      // Poll for status callback updates (webhook will update via storage)
      pollsRef.current[lineIdx] = setInterval(async () => {
        try {
          const s = await base44.functions.invoke('twilioCall', { action: 'getCallStatus', callSid: sid });
          const { status, answeredBy } = s.data || {};

          // Check current line state
          const currentLine = linesRef.current[lineIdx];
          if (!['ringing', 'calling'].includes(currentLine.status)) {
            clearInterval(pollsRef.current[lineIdx]);
            return;
          }

          // AMD Result: voicemail detected
          if (answeredBy === 'machine_end_beep' || answeredBy === 'machine_start') {
            clearInterval(pollsRef.current[lineIdx]);
            clearTimeout(ringTimersRef.current[lineIdx]);
            await hangupCall(sid);
            addLog('voicemail', `Line ${lineIdx + 1}: Voicemail detected (CPA) — ${lead.firstName} ${lead.lastName}`);
            setStats(s => ({ ...s, voicemails: s.voicemails + 1 }));
            try {
              await base44.entities.LeadHistory.create({
                leadId: lead.id, type: 'not_available',
                content: `CPA: Voicemail detected (attempt #${attempts})`,
                twilioCallSid: sid,
              });
            } catch {}
            cleanLine(lineIdx, 'voicemail');
            setTimeout(() => { if (runningRef.current) dialLine(lineIdx); }, 1000);
            return;
          }

          // AMD Result: human answered — auto-connect
          if (answeredBy === 'human') {
            clearInterval(pollsRef.current[lineIdx]);
            clearTimeout(ringTimersRef.current[lineIdx]);
            addLog('human', `Line ${lineIdx + 1}: 🟢 HUMAN ANSWERED (CPA) — ${lead.firstName} ${lead.lastName}`);
            updateLine(lineIdx, { status: 'human', callSid: sid, amdResult: 'human' });
            
            // Auto-connect agent after a short delay
            setTimeout(async () => {
              await handleAutoConnect(lineIdx, lead, sid);
            }, 500);
            return;
          }

          // Call ended before AMD could detect
          if (['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(status)) {
            clearInterval(pollsRef.current[lineIdx]);
            clearTimeout(ringTimersRef.current[lineIdx]);
            addLog('no_answer', `Line ${lineIdx + 1}: ${status} (attempt #${attempts})`);
            try {
              await base44.entities.LeadHistory.create({
                leadId: lead.id, type: 'not_available',
                content: `CPA: Call ${status} (attempt #${attempts})`,
                twilioCallSid: sid,
              });
            } catch {}
            cleanLine(lineIdx, 'no_answer');
            setTimeout(() => { if (runningRef.current) dialLine(lineIdx); }, 1200);
          }
        } catch {}
      }, 2500);

    } catch (e) {
      clearTimeout(ringTimersRef.current[lineIdx]);
      addLog('error', `Line ${lineIdx + 1}: Failed — ${e.message}`);
      cleanLine(lineIdx, 'no_answer');
      setTimeout(() => { if (runningRef.current) dialLine(lineIdx); }, 2000);
    }
  }, [settings]);

  const startDialing = () => {
    setRunning(true);
    runningRef.current = true;
    const rem = queueRef.current.length - queueIndexRef.current;
    addLog('system', `Starting — ${rem} leads, ${settings.lines.length} lines`);
    settings.lines.forEach((_, i) => {
      setTimeout(() => dialLine(i), i * 800);
    });
  };

  const stopDialing = async () => {
    setRunning(false);
    runningRef.current = false;
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
    setLines([
      { lead: null, callSid: null, status: 'idle', duration: 0 },
      { lead: null, callSid: null, status: 'idle', duration: 0 },
      { lead: null, callSid: null, status: 'idle', duration: 0 },
    ]);
    addLog('system', 'Dialer stopped.');
  };

  const remaining = Math.max(0, queue.length - queueIndex);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div style={{ fontFamily: 'Georgia, serif' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', flexDirection:isMobile?'column':'row', justifyContent: 'space-between', alignItems:isMobile?'stretch':'center', gap:'10px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: running ? '#4ade80' : '#4a5568', boxShadow: running ? '0 0 8px #4ade80' : 'none' }} />
          <h3 style={{ color: GOLD, margin: 0, fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase' }}>Predictive Dialer</h3>
          {running && <span style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '4px', padding: '2px 10px', fontSize: '10px' }}>LIVE</span>}
          {wrapUpCountdown > 0 && <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '2px 10px', fontSize: '11px' }}>⏱ Wrap-up: {wrapUpCountdown}s</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowSettings(s => !s)} style={{ flex:isMobile?1:0, background: 'rgba(255,255,255,0.06)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding:isMobile?'8px 12px':'6px 12px', cursor: 'pointer', fontSize:isMobile?'12px':'11px' }}>⚙️ {showSettings ? 'Hide' : 'Show'}</button>
          <button onClick={onClose} style={{ flex:isMobile?1:0, background: 'rgba(255,255,255,0.06)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding:isMobile?'8px 12px':'6px 12px', cursor: 'pointer', fontSize:isMobile?'12px':'11px' }}>✕</button>
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <>
          <SettingsPanel settings={settings} onChange={setSettings} />

          {/* List selector + Launch */}
          {!started && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <select value={selectedListId} onChange={e => setSelectedListId(e.target.value)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '10px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                <option value="">— Select Contact List —</option>
                {contactLists.map(list => (
                  <option key={list.id} value={list.id}>{list.name} ({list.leadCount || 0} leads)</option>
                ))}
              </select>
              <button onClick={handleStart} disabled={!selectedListId}
                style={{ padding: '10px 24px', background: !selectedListId ? 'rgba(184,147,58,0.2)' : 'linear-gradient(135deg,#b8933a,#d4aa50)', color: DARK, border: 'none', borderRadius: '6px', cursor: !selectedListId ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
                Load Leads
              </button>
            </div>
          )}
        </>
      )}

      {/* Stats */}
      {started && (
        <div style={{ display: 'grid', gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(5,1fr)', gap: '8px', marginBottom: '14px' }}>
          {[[queue.length, 'Total', GOLD], [queueIndex, 'Dialed', '#60a5fa'], [remaining, 'Remaining', '#a78bfa'], [stats.humans, 'Humans', '#4ade80'], [stats.abandoned, 'Abandoned', '#ef4444']].map(([v, l, c]) => (
            <div key={l} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding:isMobile?'6px':'8px', textAlign: 'center' }}>
              <div style={{ color: c, fontSize:isMobile?'16px':'18px', fontWeight: 'bold' }}>{v}</div>
              <div style={{ color: '#4a5568', fontSize:isMobile?'8px':'9px', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '2px' }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Lines */}
      {started && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
          {settings.lines.map((_, i) => (
            <LineCard key={i} line={lines[i]} index={i} onConnect={handleConnect} onHangup={hangupCall} />
          ))}
        </div>
      )}

      {/* Controls */}
      {started && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          {!running ? (
            <button onClick={startDialing} disabled={remaining === 0 || wrapUpCountdown > 0}
              style={{ flex: 1, background: (remaining === 0 || wrapUpCountdown > 0) ? 'rgba(74,222,128,0.2)' : 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', border: 'none', borderRadius: '8px', padding:isMobile?'14px 10px':'13px', cursor: (remaining === 0 || wrapUpCountdown > 0) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize:isMobile?'14px':'13px' }}>
              {isMobile ? '▶ Start' : remaining === 0 ? '✓ Queue Empty' : wrapUpCountdown > 0 ? `Wrap-up: ${wrapUpCountdown}s…` : `▶ Start Dialing (${remaining} leads)`}
            </button>
          ) : (
            <button onClick={stopDialing}
              style={{ flex: 1, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', border: 'none', borderRadius: '8px', padding:isMobile?'14px 10px':'13px', cursor: 'pointer', fontWeight: 'bold', fontSize:isMobile?'14px':'13px' }}>
              ■ {isMobile ? 'Stop' : 'Stop Dialer'}
            </button>
          )}
        </div>
      )}

      {/* Log */}
      {started && <LogPanel logs={logs} />}
    </div>
  );
}