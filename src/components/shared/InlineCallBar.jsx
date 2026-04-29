import { useState } from 'react';

const GOLD = '#b8933a';

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
}) {
  const { callStatus, duration, muted, isActive, dialerError, dialerReady,
          dial, hangup, toggleMute, reset, fmt, initDevice } = dialer;

  const [dtmfInput, setDtmfInput] = useState('');
  const [showKeypad, setShowKeypad] = useState(false);
  const [logging, setLogging] = useState(false);

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

  const handleDial = async () => {
    if (!dialerReady && callStatus === 'idle') await initDevice();
    dial(phone);
  };

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
  const Btn = ({ onClick, disabled, children, color = '#8a9ab8', bg = 'rgba(255,255,255,0.05)', border = 'rgba(255,255,255,0.12)', bold }) => (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      background: bg, color, border: `1px solid ${border}`,
      borderRadius: '4px', padding: '5px 10px', cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '10px', fontWeight: bold ? 'bold' : 'normal',
      opacity: disabled ? 0.4 : 1, whiteSpace: 'nowrap', letterSpacing: '0.3px',
      transition: 'all 0.15s',
    }}>
      {children}
    </button>
  );

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
            {name || phone}
          </div>
          <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '0.5px' }}>
            {phone} · <span style={{ color: statusColor }}>{statusLabel}</span>
          </div>
        </div>

        {/* Timer */}
        {(isActive || callStatus === 'ended') && (
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
          <Btn onClick={handleDial} color='#4ade80' bg='rgba(74,222,128,0.1)' border='rgba(74,222,128,0.35)' bold>
            <span>📞</span> {phone}
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

        {/* CONNECTED — mute + keypad + hangup */}
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

      {/* ── Error ── */}
      {dialerError && (
        <div style={{ color: '#ef4444', fontSize: '10px', lineHeight: 1.4 }}>
          ⚠ {dialerError}
        </div>
      )}
    </div>
  );
}