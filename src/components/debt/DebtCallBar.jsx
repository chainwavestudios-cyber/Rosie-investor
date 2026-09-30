/**
 * DebtCallBar.jsx — Compact Twilio call control bar for debt leads.
 * Uses useInlineDialer (Twilio Voice SDK) to place a real outbound call
 * to the lead's phone. Shows Live Call button, call status, timer, mute,
 * and Hang Up. Designed to sit in the ClientProfileModal / DebtLeadCard header.
 */
import { useInlineDialer } from '@/hooks/useInlineDialer';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const GOLD = '#10b981';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';

export default function DebtCallBar({ lead, onCallEnded }) {
  const { user: coachUser } = useDebtCoachAuth();
  const agentName = coachUser?.username || 'debt-agent';
  const phone = lead?.phone || '';

  const dialer = useInlineDialer({
    agentName,
    leadId: lead?.id || null,
    onCallLogged: () => { onCallEnded?.(); },
  });

  const { callStatus, duration, muted, isActive, dialerError, dial, hangup, toggleMute, fmt } = dialer;

  const statusColor = {
    idle: '#6b7280', calling: AMBER, ringing: AMBER, connected: GOLD, ended: RED,
  }[callStatus] || '#6b7280';

  const statusLabel = {
    idle: 'Ready', calling: 'Calling…', ringing: 'Ringing…', connected: 'Connected', ended: 'Call ended',
  }[callStatus] || '';

  const handleDial = () => { if (phone) dial(phone); };
  const handleHangup = async () => { hangup(); };

  if (!phone) {
    return (
      <div style={{ padding: '8px 12px', background: 'rgba(107,114,128,0.06)', border: '1px solid rgba(107,114,128,0.15)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#6b7280', fontSize: '11px' }}>📞 No phone number on this lead — add one to place a call.</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.25)', border: `1px solid ${isActive ? 'rgba(16,185,129,0.3)' : callStatus === 'ended' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Row 1: status + number + timer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusColor, boxShadow: `0 0 ${['calling','ringing','connected'].includes(callStatus) ? '8px' : '4px'} ${statusColor}`, animation: ['calling','ringing','connected'].includes(callStatus) ? 'pulse 1.2s infinite' : 'none', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📞 {phone}</div>
          <div style={{ color: '#4a5568', fontSize: '9px' }}><span style={{ color: statusColor }}>{statusLabel}</span></div>
        </div>
        {(isActive || callStatus === 'ended') && duration > 0 && (
          <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold', color: callStatus === 'connected' ? GOLD : callStatus === 'ended' ? RED : AMBER, letterSpacing: '1px', flexShrink: 0 }}>{fmt(duration)}</div>
        )}
      </div>

      {/* Row 2: action buttons */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {/* IDLE — Live Call button */}
        {(callStatus === 'idle' || callStatus === 'ready') && (
          <button onClick={handleDial} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '7px 18px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
            📞 Live Call
          </button>
        )}

        {/* CALLING / RINGING — Cancel */}
        {(callStatus === 'calling' || callStatus === 'ringing') && (
          <button onClick={handleHangup} style={{ background: 'rgba(239,68,68,0.15)', color: RED, border: '1px solid rgba(239,68,68,0.35)', borderRadius: '4px', padding: '7px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>📵 Cancel</button>
        )}

        {/* CONNECTED — mute + hangup */}
        {callStatus === 'connected' && (
          <>
            <button onClick={toggleMute} style={{ background: muted ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)', color: muted ? RED : '#8a9ab8', border: `1px solid ${muted ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', padding: '7px 12px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>{muted ? '🔇 Muted' : '🎙 Mute'}</button>
            <button onClick={handleHangup} style={{ background: 'rgba(239,68,68,0.15)', color: RED, border: '1px solid rgba(239,68,68,0.35)', borderRadius: '4px', padding: '7px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>📵 Hang Up</button>
          </>
        )}

        {/* ENDED — redial */}
        {callStatus === 'ended' && (
          <button onClick={() => dialer.reset()} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '7px 14px', cursor: 'pointer', fontSize: '11px' }}>↩ Redial</button>
        )}
      </div>

      {dialerError && <div style={{ color: RED, fontSize: '10px' }}>⚠ {dialerError}</div>}
    </div>
  );
}