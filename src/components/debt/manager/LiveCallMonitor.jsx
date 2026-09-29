import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';

export default function LiveCallMonitor({ dialerUsername, session, managerUsername, onTakeover }) {
  const [mode, setMode] = useState('none'); // 'none' | 'listen' | 'whisper' | 'barge'
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [liveTranscript, setLiveTranscript] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  const pcRef = useRef(null);
  const audioRef = useRef(null);
  const localStreamRef = useRef(null);

  const isOnCall = session?.status === 'on_call';
  const leadId = session?.currentCallLeadId;
  const leadName = session?.currentCallLeadName;
  const phone = session?.currentCallPhone;
  const callStartedAt = session?.currentCallStartedAt;
  const callMode = session?.currentCallMode;

  // Live transcript polling — read the lead's transcriptJson which auto-saves every 5s
  useEffect(() => {
    if (!isOnCall || !leadId) { setLiveTranscript([]); return; }
    let active = true;
    const poll = async () => {
      try {
        const lead = await base44.entities.DebtLead.get(leadId);
        if (!active) return;
        try { setLiveTranscript(JSON.parse(lead.transcriptJson || '[]')); } catch { setLiveTranscript([]); }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [isOnCall, leadId]);

  // Call timer
  useEffect(() => {
    if (!isOnCall || !callStartedAt) { setCallDuration(0); return; }
    const tick = () => setCallDuration(Math.floor((Date.now() - new Date(callStartedAt).getTime()) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isOnCall, callStartedAt]);

  // Cleanup WebRTC on unmount or mode change
  const cleanupWebRTC = useCallback(() => {
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (audioRef.current) { audioRef.current.srcObject = null; }
  }, []);

  useEffect(() => () => cleanupWebRTC(), [cleanupWebRTC]);

  const startMonitor = async (monitorMode) => {
    if (!isOnCall) { setError('Dialer is not on a call.'); return; }
    setError(''); setConnecting(true); setMode(monitorMode);
    try {
      // Stop any existing connection
      cleanupWebRTC();

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcRef.current = pc;

      // For whisper/barge, add the manager's mic audio
      if (monitorMode === 'whisper' || monitorMode === 'barge') {
        try {
          const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = localStream;
          localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        } catch { setError('Could not access microphone for whisper/barge.'); }
      }

      // Receive audio from agent
      pc.ontrack = (event) => {
        if (!audioRef.current) audioRef.current = new Audio();
        audioRef.current.srcObject = event.streams[0];
        audioRef.current.play().catch(() => {});
      };

      // Create offer (with option to receive audio)
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete (includes candidates in SDP)
      await new Promise(resolve => {
        if (pc.iceGatheringState === 'complete') return resolve();
        pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') resolve(); };
        setTimeout(resolve, 3000); // Timeout after 3s
      });

      // Send offer to backend
      await base44.functions.invoke('managerCallControl', {
        action: 'startMonitor',
        managerUsername,
        dialerUsername,
        monitorMode,
        offerSdp: pc.localDescription.sdp,
      });

      // Poll for answer
      let attempts = 0;
      const pollAnswer = async () => {
        if (attempts++ > 20) { setError('Agent did not respond to monitoring request.'); setConnecting(false); return; }
        try {
          const res = await base44.functions.invoke('managerCallControl', { action: 'getSession', managerUsername, dialerUsername });
          const sess = res?.data?.session || res?.session;
          if (sess?.webrtcAnswerSdp) {
            await pc.setRemoteDescription({ type: 'answer', sdp: sess.webrtcAnswerSdp });
            setConnecting(false);
          } else {
            setTimeout(pollAnswer, 1000);
          }
        } catch { setTimeout(pollAnswer, 1000); }
      };
      pollAnswer();
    } catch (e) { setError('Monitor failed: ' + (e?.message || String(e))); setConnecting(false); setMode('none'); }
  };

  const stopMonitor = async () => {
    cleanupWebRTC();
    setMode('none');
    setConnecting(false);
    try {
      await base44.functions.invoke('managerCallControl', { action: 'stopMonitor', managerUsername, dialerUsername });
    } catch {}
  };

  const handleTakeover = async () => {
    if (!window.confirm('Take over this call? The agent will be disconnected.')) return;
    try {
      await base44.functions.invoke('managerCallControl', { action: 'takeover', managerUsername, dialerUsername });
      onTakeover?.();
    } catch (e) { setError('Takeover failed: ' + (e?.message || String(e))); }
  };

  if (!isOnCall) {
    return (
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '30px', textAlign: 'center' }}>
        <div style={{ color: '#4a5568', fontSize: '13px' }}>📵 Dialer is not currently on a call.</div>
      </div>
    );
  }

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', overflow: 'hidden' }}>
      {/* Call info bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', background: 'rgba(239,68,68,0.04)' }}>
        <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} /> LIVE CALL
        </span>
        <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{leadName || 'Unknown'}</span>
        {phone && <span style={{ color: '#8a9ab8', fontSize: '12px' }}>📞 {phone}</span>}
        <span style={{ color: callMode === 'close' ? GOLD : '#60a5fa', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '2px', background: callMode === 'close' ? 'rgba(16,185,129,0.12)' : 'rgba(96,165,250,0.12)' }}>{callMode || 'open'}</span>
        <span style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace', marginLeft: 'auto' }}>
          {Math.floor(callDuration / 60)}:{String(callDuration % 60).padStart(2, '0')}
        </span>
        {callStartedAt && <span style={{ color: '#6b7280', fontSize: '10px' }}>Connected: {new Date(callStartedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
      </div>

      {/* Control buttons */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {mode === 'none' && !connecting && (
          <>
            <button onClick={() => startMonitor('listen')} style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>🎧 Listen</button>
            <button onClick={() => startMonitor('whisper')} style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}> Whisper (Agent Only)</button>
            <button onClick={() => startMonitor('barge')} style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>📢 Barge (Both Parties)</button>
            <button onClick={handleTakeover} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>⚡ Take Over</button>
          </>
        )}
        {connecting && <span style={{ color: '#f59e0b', fontSize: '12px' }}>⏳ Connecting to agent…</span>}
        {mode !== 'none' && !connecting && (
          <>
            <span style={{ color: mode === 'listen' ? '#60a5fa' : mode === 'whisper' ? '#f59e0b' : '#a855f7', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>
              ● {mode} Active
            </span>
            <button onClick={stopMonitor} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>⏹ Stop</button>
            <button onClick={handleTakeover} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>⚡ Take Over</button>
          </>
        )}
      </div>

      {error && <div style={{ padding: '8px 16px', color: '#ef4444', fontSize: '11px' }}>⚠ {error}</div>}

      {/* Live transcript */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>📝 Live Transcript</div>
        <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '10px' }}>
          {liveTranscript.length === 0 ? (
            <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px 0', fontSize: '12px' }}>No transcript lines yet.</div>
          ) : (
            liveTranscript.slice(-50).map((msg, i) => {
              const isAgent = msg.speaker === 0;
              return (
                <div key={i} style={{ marginBottom: '4px', display: 'flex', gap: '8px' }}>
                  <span style={{ color: isAgent ? '#60a5fa' : '#10b981', fontSize: '10px', fontWeight: 'bold', flexShrink: 0, minWidth: '60px' }}>{isAgent ? 'Agent' : 'Customer'}</span>
                  <span style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{msg.text}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}