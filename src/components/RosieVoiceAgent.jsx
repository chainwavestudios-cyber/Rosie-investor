/**
 * RosieVoiceAgent — Production Deepgram Voice Agent
 * * CRITICAL BUG FIXES:
 * 1. Correct Loop Index: Fixed the inputData.length typo to prevent buffer corruption.
 * 2. Feedback Loop: Removed processor.connect(ctx.destination) to kill the mic echo.
 * 3. Timing: Switched back to precise time-scheduling for zero-gap playback.
 * 4. Key: 44294c0c2f0ebbcc81b853151056111226b853e9
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getPortalSettings, refreshPortalSettings } from '@/lib/portalSettings';

const GOLD = '#b8933a';
const DG_WS_URL = 'wss://agent.deepgram.com/v1/agent/converse';
const TEMP_KEY = '44294c0c2f0ebbcc81b853151056111226b853e9';

function buildDGSettings(cfg, userName) {
  const firstName = (userName || 'Steph').split(' ')[0];
  const systemPrompt = [
    cfg.chatbotContext || 'You are Rosie, a helpful investment assistant.',
    cfg.knowledgeBase ? `\n\n--- KNOWLEDGE BASE ---\n${cfg.knowledgeBase}` : '',
  ].join('');

  return {
    type: 'Settings',
    audio: {
      input:  { encoding: 'linear16', sample_rate: 24000 },
      output: { encoding: 'linear16', sample_rate: 24000, container: 'none' },
    },
    agent: {
      listen: { provider: { type: 'deepgram', version: 'v1', model: 'nova-2', language: 'en-US' } },
      think: [{ provider: { type: 'open_ai', version: 'v1', model: 'gpt-4o-mini' }, prompt: systemPrompt }],
      speak: { provider: { type: 'deepgram', version: 'v1', model: cfg.voiceModel || 'aura-asteria-en' } },
      greeting: `Hello ${firstName}, I'm Rosie. How can I assist you today?`,
    },
  };
}

export default function RosieVoiceAgent({ userName = 'Steph' }) {
  const [phase, setPhase] = useState('idle'); 
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const wsRef        = useRef(null);
  const audioCtxRef  = useRef(null);
  const micStreamRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef    = useRef(null);
  const nextStartTimeRef = useRef(0);

  const playChunk = useCallback((arrayBuffer) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const int16 = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    sourceRef.current = src;

    // Time-accurate scheduling to prevent gaps
    const now = ctx.currentTime;
    if (nextStartTimeRef.current < now) {
      nextStartTimeRef.current = now + 0.05; // Tiny 50ms initial buffer
    }
    src.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;

    src.onended = () => {
        // Only set speaking false if we've reached the end of the scheduled audio
        if (ctx.currentTime >= nextStartTimeRef.current - 0.01) {
            setAgentSpeaking(false);
        }
    };
  }, []);

  const connect = useCallback(async () => {
    setError('');
    setPhase('connecting');

    const cfg = await refreshPortalSettings();

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
    } catch (e) {
      setError('Mic access denied.');
      setPhase('error');
      return;
    }

    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    audioCtxRef.current = ctx;
    nextStartTimeRef.current = 0;

    const ws = new WebSocket(DG_WS_URL, ['token', TEMP_KEY]);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        setAgentSpeaking(true);
        playChunk(e.data);
        return;
      }

      try {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case 'Welcome':
            ws.send(JSON.stringify(buildDGSettings(cfg, userName)));
            break;
          case 'SettingsApplied':
            setPhase('active');
            const source = ctx.createMediaStreamSource(stream);
            // 4096 samples at 24kHz is ~170ms chunks
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (ev) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              const inputData = ev.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              
              for (let i = 0; i < inputData.length; i++) { // ✅ Corrected Length Fix
                const s = Math.max(-1, Math.min(1, inputData[i]));
                int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              ws.send(int16.buffer);
            };

            source.connect(processor);
            
            /** * ✅ FEEDBACK FIX: 
             * Do NOT connect to ctx.destination. 
             * We connect to a GainNode with 0 volume to keep the processor clock running 
             * in browsers that require a destination to trigger onaudioprocess.
             */
            const silence = ctx.createGain();
            silence.gain.value = 0;
            processor.connect(silence);
            silence.connect(ctx.destination);
            break;

          case 'ConversationText':
            setTranscript(prev => [...prev, { role: msg.role, text: msg.content }]);
            break;
          case 'UserStartedSpeaking':
            // Interrupt: Kill the audio clock and stop sources
            if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} }
            nextStartTimeRef.current = 0;
            setAgentSpeaking(false);
            break;
        }
      } catch (err) {}
    };

    ws.onclose = (e) => {
      setPhase('error');
      setError(`Disconnected (${e.code})`);
      cleanup(false);
    };
  }, [playChunk, userName]);

  const cleanup = useCallback((updatePhase = true) => {
    if (processorRef.current) processorRef.current.disconnect();
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    if (wsRef.current) wsRef.current.close();
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    if (updatePhase) setPhase('idle');
    setAgentSpeaking(false);
  }, []);

  if (!isOpen) return <button onClick={() => setIsOpen(true)} style={pillStyle}>🎙 Talk to Rosie</button>;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ ...orbStyle, background: phase === 'active' && agentSpeaking ? GOLD : 'rgba(184,147,58,0.2)' }}>🎙</div>
          <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>Rosie AI</div>
        </div>
        <button onClick={() => { cleanup(); setIsOpen(false); }} style={closeBtnStyle}>×</button>
      </div>
      <div style={transcriptAreaStyle}>
        {transcript.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.role === 'user' ? 'right' : 'left', margin: '10px 0' }}>
            <span style={{ ...bubbleStyle, background: msg.role === 'user' ? GOLD : '#222', color: msg.role === 'user' ? '#000' : '#fff' }}>
              {msg.text}
            </span>
          </div>
        ))}
        {error && <div style={errorStyle}>⚠ {error}</div>}
      </div>
      <div style={footerStyle}>
        {phase === 'active' ? <button onClick={() => cleanup()} style={endBtnStyle}>End Call</button> : <button onClick={connect} style={actionBtnStyle}>Start</button>}
      </div>
    </div>
  );
}

// STYLES
const pillStyle = { position: 'fixed', bottom: '32px', right: '32px', background: GOLD, color: '#000', borderRadius: '50px', padding: '14px 24px', cursor: 'pointer', fontWeight: 'bold', zIndex: 1000 };
const containerStyle = { position: 'fixed', bottom: '24px', right: '24px', width: '380px', height: '520px', background: '#0a1118', border: `1px solid ${GOLD}44`, borderRadius: '8px', display: 'flex', flexDirection: 'column', zIndex: 1000 };
const headerStyle = { padding: '15px', borderBottom: '1px solid #ffffff11', display: 'flex', justifyContent: 'space-between' };
const orbStyle = { width: '30px', height: '30px', borderRadius: '50%' };
const closeBtnStyle = { background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '20px' };
const transcriptAreaStyle = { flex: 1, overflowY: 'auto', padding: '15px' };
const bubbleStyle = { padding: '8px 12px', borderRadius: '12px', fontSize: '13px', maxWidth: '80%', display: 'inline-block' };
const errorStyle = { color: '#ff4444', fontSize: '11px', textAlign: 'center', marginTop: '10px' };
const footerStyle = { padding: '15px' };
const actionBtnStyle = { width: '100%', padding: '12px', background: GOLD, border: 'none', fontWeight: 'bold', cursor: 'pointer' };
const endBtnStyle = { width: '100%', padding: '12px', background: '#ff444422', color: '#ff4444', border: '1px solid #ff444444', cursor: 'pointer' };