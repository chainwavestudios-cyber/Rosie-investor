import { useState, useEffect, useRef } from 'react';
import VoiceFXPanel from './VoiceFXPanel';
import { usePortalAuth } from '@/lib/PortalAuthContext';

const GOLD = '#b8933a';
const ADMIN_USERS = ['admin', 'steph'];

/**
 * InlineCallBar
 * Compact call control bar that lives inside a contact card.
 * Receives dialer state/actions from useInlineDialer hook.
 *
 * Props:
 *   phone           — number to dial
 *   name            — display name
 *   dialer          — object from useInlineDialer()
 *   onLogCall       — async fn() called to log the call after hangup
 *   // Predictive dialer props (lead card only)
 *   isPredictive    — bool: currently in predictive dialer mode
 *   isDialerPaused  — bool: predictive paused on this lead
 *   onPauseCampaign — fn: pause the campaign
 *   onDisconnectNext— fn: hangup + move to next lead
 *   onSaveResume    — fn: save + resume campaign
 */
export default function InlineCallBar({
  phone, name, dialer,
  onLogCall,
  isPredictive, isDialerPaused,
  onPauseCampaign, onDisconnectNext, onSaveResume,
  showCallLog, onToggleCallLog,
}) {
  const {
    callStatus, duration, muted, isActive, dialerError,
    dial, hangup, answer, reject, toggleMute, reset, fmt,
    callerId, setCallerId, lines,
    micDevices, micDeviceId, setMicDeviceId,
    outputDevices, outputDeviceId, setOutputDeviceId,
    incomingCall, callDirection,
  } = dialer;

  const [dtmfInput, setDtmfInput] = useState('');
  const [showKeypad, setShowKeypad] = useState(false);
  const [logging, setLogging] = useState(false);
  const [showFX, setShowFX] = useState(false);
  const [speakerVol, setSpeakerVol] = useState(() => parseFloat(localStorage.getItem('speakerVol') ?? '1'));
  const [micVol, setMicVol] = useState(() => parseFloat(localStorage.getItem('micVol') ?? '1'));
  const [testingMic, setTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const micTestRef = useRef(null); // { stream, analyser, animFrame }
  const audioCtxRef = useRef(null);

  const { portalUser } = usePortalAuth();
  const username = portalUser?.username || '';
  const isAdmin = ADMIN_USERS.includes(username);

  // Load saved defaults for mic + output on mount
  useEffect(() => {
    if (!username || !micDevices || micDevices.length === 0) return;
    const saved = localStorage.getItem(`defaultMic_${username}`);
    if (saved && micDevices.some(m => m.deviceId === saved) && micDeviceId !== saved) {
      setMicDeviceId(saved);
    }
  }, [username, micDevices]);

  useEffect(() => {
    if (!username || !outputDevices || outputDevices.length === 0) return;
    const saved = localStorage.getItem(`defaultOutput_${username}`);
    if (saved && outputDevices.some(d => d.deviceId === saved) && outputDeviceId !== saved) {
      setOutputDeviceId(saved);
    }
  }, [username, outputDevices]);

  const saveDefaults = () => {
    if (!username) return;
    if (micDeviceId) localStorage.setItem(`defaultMic_${username}`, micDeviceId);
    if (outputDeviceId) localStorage.setItem(`defaultOutput_${username}`, outputDeviceId);
  };

  const startMicTest = async () => {
    stopMicTest();
    setTestingMic(true);
    try {
      const constraints = { audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicLevel(Math.min(100, avg * micVol * 2.5));
        micTestRef.current.animFrame = requestAnimationFrame(tick);
      };
      micTestRef.current = { stream, analyser, animFrame: requestAnimationFrame(tick) };
    } catch {
      setTestingMic(false);
    }
  };

  const stopMicTest = () => {
    if (micTestRef.current) {
      cancelAnimationFrame(micTestRef.current.animFrame);
      micTestRef.current.stream?.getTracks().forEach(t => t.stop());
      micTestRef.current = null;
    }
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    setTestingMic(false);
    setMicLevel(0);
  };

  // Clean up mic test on unmount
  useEffect(() => () => stopMicTest(), []);

  // Populate mic list on first render (requires mic permission)
  useEffect(() => {
    if (!micDevices || micDevices.length > 0) return;
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => navigator.mediaDevices.enumerateDevices())
      .catch(() => {});
  }, [micDevices]);

  const statusColor = {
    idle:        '#4a5568',
    initializing:'#f59e0b',
    ready:       '#4ade80',
    calling:     '#f59e0b',
    ringing:     '#f59e0b',
    connected:   '#4ade80',
    ended:       '#ef4444',
  }[callStatus] || '#4a5568';

  const statusLabel = {
    idle:        'Ready to call',
    initializing:'Connecting…',
    ready:       'Ready',
    calling:     'Calling…',
    ringing:     'Ringing…',
    connected:   'Connected',
    ended:       'Call ended',
  }[callStatus] || '';

  const handleHangup = async () => {
    hangup();
    if (onLogCall) {
      setLogging(true);
      await onLogCall();
      setLogging(false);
    }
  };

  const handleAnswer = async () => {
    answer();
  };

  const handleReject = () => {
    reject();
  };

  const handleDial = () => dial(phone);

  const pressKey = (k) => {
    setDtmfInput(p => p + k);
    dialer.sendDigit(k);
  };

  const KEYS = ['1','2','3','4','5','6','7','8','9','*','0','#'];

  // ── Pulsing dot ──────────────────────────────────────────────────────
  const Dot = ({ color, pulse }) => (
    <div style={{
      width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
      background: color,
      boxShadow: `0 0 ${pulse ? '8px' : '4px'} ${color}`,
      animation: pulse ? 'pulse 1.2s ease-in-out infinite' : 'none',
    }} />
  );

  // ── Compact btn ──────────────────────────────────────────────────────
  const Btn = ({ onClick, disabled, children, color = '#8a9ab8', bg = 'rgba(255,255,255,0.05)', border = 'rgba(255,255,255,0.12)', bold, extraStyle = {} }) => (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      background: bg, color, border: `1px solid ${border}`,
      borderRadius: '4px', padding: '5px 10px', cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '10px', fontWeight: bold ? 'bold' : 'normal',
      opacity: disabled ? 0.4 : 1, whiteSpace: 'nowrap', letterSpacing: '0.3px',
      transition: 'all 0.15s',
      ...extraStyle,
    }}>
      {children}
    </button>
  );

  // ── Incoming call banner ─────────────────────────────────────────────
  // Show when there's an inbound call ringing and this bar's phone matches
  // OR when the global incomingCall exists and this is the matched lead's card
  const isThisIncoming = incomingCall && callStatus === 'idle';

  if (isThisIncoming) {
    const callerName = incomingCall.lead?.name || incomingCall.lead?.firstName
      ? `${incomingCall.lead.firstName || ''} ${incomingCall.lead.lastName || ''}`.trim()
      : incomingCall.from || 'Unknown Caller';

    return (
      <div style={{
        background: 'rgba(74,222,128,0.08)',
        border: '1px solid rgba(74,222,128,0.4)',
        borderRadius: '5px',
        padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: '8px',
        animation: 'incoming-pulse 1s ease-in-out infinite',
      }}>
        <style>{`
          @keyframes incoming-pulse {
            0%, 100% { border-color: rgba(74,222,128,0.4); box-shadow: 0 0 0 rgba(74,222,128,0); }
            50%       { border-color: rgba(74,222,128,0.8); box-shadow: 0 0 12px rgba(74,222,128,0.2); }
          }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Dot color="#4ade80" pulse />
          <div style={{ flex: 1 }}>
            <div style={{ color: '#4ade80', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 'bold' }}>
              📲 Incoming Call
            </div>
            <div style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold' }}>{callerName}</div>
            <div style={{ color: '#4a5568', fontSize: '9px' }}>{incomingCall.from}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <Btn
            onClick={handleAnswer}
            color="#fff"
            bg="linear-gradient(135deg,#22c55e,#16a34a)"
            border="transparent"
            bold
            extraStyle={{ flex: 1, justifyContent: 'center' }}
          >
            📞 Answer
          </Btn>
          <Btn
            onClick={handleReject}
            color="#fff"
            bg="linear-gradient(135deg,#ef4444,#b91c1c)"
            border="transparent"
            bold
            extraStyle={{ flex: 1, justifyContent: 'center' }}
          >
            📵 Decline
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(0,0,0,0.25)',
      border: `1px solid ${isActive ? 'rgba(74,222,128,0.25)' : callStatus === 'ended' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: '5px',
      padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: '7px',
      transition: 'border-color 0.3s',
    }}>

      {/* ── Row 1: status dot + name/number + timer ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Dot color={statusColor} pulse={['calling','ringing','connected'].includes(callStatus)} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {callDirection === 'inbound' ? '📲 ' : ''}{name || phone}
          </div>
          <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '0.5px' }}>
            {phone} · <span style={{ color: statusColor }}>{statusLabel}</span>
          </div>
        </div>

        {/* Timer */}
        {(isActive || callStatus === 'ended') && duration > 0 && (
          <div style={{
            fontFamily: 'monospace', fontSize: '15px', fontWeight: 'bold',
            color: callStatus === 'connected' ? '#4ade80' : callStatus === 'ended' ? '#ef4444' : '#f59e0b',
            letterSpacing: '1px', flexShrink: 0,
          }}>
            {fmt(duration)}
          </div>
        )}
      </div>

      {/* ── Row 2: Call action buttons ── */}
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>

        {/* IDLE / READY — dial */}
        {(callStatus === 'idle' || callStatus === 'ready') && phone && (
          <div style={{ position:'relative', display:'inline-block' }}>
            <style>{`
              @keyframes neon-spin {
                0%   { background-position: 0% 50%; }
                100% { background-position: 200% 50%; }
              }
              .neon-dial-wrap::before {
                content: '';
                position: absolute;
                inset: -2px;
                border-radius: 8px;
                background: linear-gradient(90deg, #4ade80, #00ffaa, #4ade80, #00ffaa);
                background-size: 200% 100%;
                animation: neon-spin 1.8s linear infinite;
                z-index: 0;
              }
              .neon-dial-wrap::after {
                content: '';
                position: absolute;
                inset: -4px;
                border-radius: 10px;
                background: linear-gradient(90deg, #4ade80, #00ffaa, #4ade80, #00ffaa);
                background-size: 200% 100%;
                animation: neon-spin 1.8s linear infinite;
                filter: blur(6px);
                opacity: 0.5;
                z-index: 0;
              }
              .neon-dial-inner {
                position: relative;
                z-index: 1;
              }
            `}</style>
            <div className="neon-dial-wrap" style={{ position:'relative', display:'inline-block', borderRadius:'8px' }}>
              <Btn onClick={handleDial} color='#4ade80' bg='rgba(10,20,15,0.95)' border='transparent' bold extraStyle={{ borderRadius:'6px', position:'relative', zIndex:1 }}>
                <span>📞</span> {phone}
              </Btn>
            </div>
          </div>
        )}

        {/* 🎙 Voice FX — admin only, shown when idle/ready/ended */}
        {isAdmin && (callStatus === 'idle' || callStatus === 'ready' || callStatus === 'ended') && (
          <Btn onClick={() => setShowFX(true)} color={GOLD} bg='rgba(184,147,58,0.08)' border='rgba(184,147,58,0.25)'>
            🎙 FX
          </Btn>
        )}
        {/* 📋 Call Log — shown always */}
        {onToggleCallLog && (
          <Btn onClick={onToggleCallLog}
            color={showCallLog ? '#60a5fa' : '#8a9ab8'}
            bg={showCallLog ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.04)'}
            border={showCallLog ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.1)'}>
            📋 Log
          </Btn>
        )}

        {/* INITIALIZING */}
        {callStatus === 'initializing' && (
          <span style={{ color: '#f59e0b', fontSize: '10px' }}>⏳ Connecting to Twilio…</span>
        )}

        {/* CALLING / RINGING — cancel */}
        {(callStatus === 'calling' || callStatus === 'ringing') && (
          <Btn onClick={handleHangup} color='#ef4444' bg='rgba(239,68,68,0.12)' border='rgba(239,68,68,0.35)' bold>
            📵 Cancel
          </Btn>
        )}

        {/* CONNECTED — mute + keypad + FX + hangup */}
        {callStatus === 'connected' && (
          <>
            <Btn onClick={toggleMute}
              color={muted ? '#ef4444' : '#8a9ab8'}
              bg={muted ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)'}
              border={muted ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}>
              {muted ? '🔇 Muted' : '🎙 Mute'}
            </Btn>
            <Btn onClick={() => setShowKeypad(p => !p)} color='#8a9ab8'>
              {showKeypad ? '🔢 Hide' : '🔢 Keys'}
            </Btn>
            {isAdmin && (
              <Btn onClick={() => setShowFX(true)} color={GOLD} bg='rgba(184,147,58,0.1)' border='rgba(184,147,58,0.3)'>
                🎙 FX
              </Btn>
            )}
            <Btn onClick={handleHangup} color='#ef4444' bg='rgba(239,68,68,0.12)' border='rgba(239,68,68,0.35)' bold>
              📵 Hang Up
            </Btn>
          </>
        )}

        {/* ENDED — redial */}
        {callStatus === 'ended' && (
          <>
            <Btn onClick={reset} color='#8a9ab8'>{logging ? '⏳ Saving…' : '↩ Redial'}</Btn>
          </>
        )}

        {/* ── PREDICTIVE DIALER CONTROLS (lead card only) ── */}
        {isPredictive && isDialerPaused && (
          <>
            <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />
            {onPauseCampaign && (
              <Btn onClick={onPauseCampaign} color={GOLD} bg='rgba(184,147,58,0.08)' border='rgba(184,147,58,0.25)'>
                ⏸ Pause Campaign
              </Btn>
            )}
            {onDisconnectNext && (
              <Btn onClick={async () => { await handleHangup(); onDisconnectNext(); }}
                color='#60a5fa' bg='rgba(96,165,250,0.08)' border='rgba(96,165,250,0.25)'>
                📵 → Next Lead
              </Btn>
            )}
            {onSaveResume && (
              <Btn onClick={async () => { await handleHangup(); onSaveResume(); }}
                color='#4ade80' bg='rgba(74,222,128,0.1)' border='rgba(74,222,128,0.3)' bold>
                💾 Save & Resume ▶
              </Btn>
            )}
          </>
        )}
      </div>

      {/* ── DTMF Keypad ── */}
      {showKeypad && callStatus === 'connected' && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '7px' }}>
          {dtmfInput && (
            <div style={{ textAlign: 'center', fontFamily: 'monospace', color: '#e8e0d0', letterSpacing: '4px', fontSize: '13px', marginBottom: '6px' }}>
              {dtmfInput}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '4px' }}>
            {KEYS.map(k => (
              <button key={k} onClick={() => pressKey(k)} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '3px', padding: '7px', color: '#e8e0d0', fontSize: '13px',
                cursor: 'pointer', fontFamily: 'monospace',
              }}>{k}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Call from selector ── */}
      {lines && lines.length > 1 && !isActive && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'6px' }}>
          <select value={callerId} onChange={e => setCallerId(e.target.value)}
            style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'3px', padding:'4px 8px', color:'#6b7280', fontSize:'10px', outline:'none', cursor:'pointer' }}>
            {lines.map(l => <option key={l.number} value={l.number}>📞 {l.label} — {l.number}</option>)}
          </select>
        </div>
      )}

      {/* ── Audio device selectors + volume + mic test ── */}
      {(micDevices?.length > 0 || outputDevices?.length > 0) && !isActive && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'6px', display:'flex', flexDirection:'column', gap:'5px' }}>
          <style>{`
            .audio-slider { -webkit-appearance:none; appearance:none; height:4px; border-radius:2px; outline:none; cursor:pointer; }
            .audio-slider::-webkit-slider-thumb { -webkit-appearance:none; width:12px; height:12px; border-radius:50%; background:#b8933a; cursor:pointer; }
          `}</style>

          {/* Mic selector */}
          {micDevices?.length > 0 && (
            <select value={micDeviceId} onChange={e => { setMicDeviceId(e.target.value); if (testingMic) setTimeout(startMicTest, 100); }}
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'3px', padding:'4px 8px', color:'#6b7280', fontSize:'10px', outline:'none', cursor:'pointer' }}>
              {micDevices.map(m => (
                <option key={m.deviceId} value={m.deviceId}>🎙 {m.label || `Microphone ${m.deviceId.slice(0,6)}`}</option>
              ))}
            </select>
          )}

          {/* Mic volume + test */}
          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <span style={{ color:'#4a5568', fontSize:'9px', width:'50px', flexShrink:0 }}>🎙 Mic Vol</span>
            <input type="range" min="0" max="2" step="0.05" value={micVol}
              onChange={e => { const v = parseFloat(e.target.value); setMicVol(v); localStorage.setItem('micVol', v); }}
              className="audio-slider"
              style={{ flex:1, background:`linear-gradient(to right, #b8933a ${(micVol/2)*100}%, rgba(255,255,255,0.1) ${(micVol/2)*100}%)` }} />
            <span style={{ color:'#6b7280', fontSize:'9px', width:'24px', textAlign:'right' }}>{Math.round(micVol*100)}%</span>
            <button onClick={testingMic ? stopMicTest : startMicTest}
              style={{ background: testingMic ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.1)', color: testingMic ? '#ef4444' : '#4ade80', border: `1px solid ${testingMic ? 'rgba(239,68,68,0.35)' : 'rgba(74,222,128,0.3)'}`, borderRadius:'3px', padding:'2px 7px', cursor:'pointer', fontSize:'9px', whiteSpace:'nowrap', flexShrink:0 }}>
              {testingMic ? '■ Stop' : '▶ Test'}
            </button>
          </div>

          {/* Mic level meter */}
          {testingMic && (
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <span style={{ color:'#4ade80', fontSize:'9px', width:'50px', flexShrink:0 }}>📊 Level</span>
              <div style={{ flex:1, height:'6px', background:'rgba(255,255,255,0.08)', borderRadius:'3px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${micLevel}%`, background: micLevel > 70 ? '#ef4444' : micLevel > 40 ? '#f59e0b' : '#4ade80', borderRadius:'3px', transition:'width 0.05s' }} />
              </div>
              <span style={{ color:'#4a5568', fontSize:'9px', width:'24px', textAlign:'right' }}>{Math.round(micLevel)}%</span>
            </div>
          )}

          {/* Speaker selector */}
          {outputDevices?.length > 0 && (
            <select value={outputDeviceId} onChange={e => setOutputDeviceId(e.target.value)}
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'3px', padding:'4px 8px', color:'#6b7280', fontSize:'10px', outline:'none', cursor:'pointer' }}>
              {outputDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>🔊 {d.label || `Speaker ${d.deviceId.slice(0,6)}`}</option>
              ))}
            </select>
          )}

          {/* Speaker volume */}
          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <span style={{ color:'#4a5568', fontSize:'9px', width:'50px', flexShrink:0 }}>🔊 Volume</span>
            <input type="range" min="0" max="1" step="0.02" value={speakerVol}
              onChange={e => { const v = parseFloat(e.target.value); setSpeakerVol(v); localStorage.setItem('speakerVol', v); }}
              className="audio-slider"
              style={{ flex:1, background:`linear-gradient(to right, #b8933a ${speakerVol*100}%, rgba(255,255,255,0.1) ${speakerVol*100}%)` }} />
            <span style={{ color:'#6b7280', fontSize:'9px', width:'24px', textAlign:'right' }}>{Math.round(speakerVol*100)}%</span>
          </div>

          {username && (
            <button onClick={saveDefaults} title="Save mic and speaker as defaults"
              style={{ background:'rgba(184,147,58,0.1)', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'3px', padding:'3px 8px', color:GOLD, fontSize:'9px', cursor:'pointer', alignSelf:'flex-start' }}>
              ★ Save as Default
            </button>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {dialerError && (
        <div style={{ color: '#ef4444', fontSize: '10px', lineHeight: 1.4 }}>
          ⚠ {dialerError}
        </div>
      )}

      {/* ── Voice FX Panel ── */}
      {showFX && <VoiceFXPanel onClose={() => setShowFX(false)} />}
    </div>
  );
}