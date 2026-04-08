/**
 * RosieVoiceAgent — Production Deepgram Voice Agent
 * FIXES:
 * 1. Removed Supabase dependency.
 * 2. Auth: Fixed 1006/1005 via Sec-WebSocket-Protocol ['token.deepgram.com', key].
 * 3. Schema: Strict 24kHz sync and v1 provider nesting.
 * 4. Key: 44294c0c2f0ebbcc81b853151056111226b853e9
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getPortalSettings, refreshPortalSettings } from '@/lib/portalSettings';

const GOLD = '#b8933a';
const DG_WS_URL = 'wss://agent.deepgram.com/v1/agent/converse';
const TEMP_KEY = '44294c0c2f0ebbcc81b853151056111226b853e9';

function buildDGSettings(cfg, userName) {
  const systemPrompt = [
    cfg.chatbotContext || 'You are Rosie, a helpful investment assistant for Rosie AI LLC.',
    cfg.knowledgeBase ? `\n\n--- KNOWLEDGE BASE ---\n${cfg.knowledgeBase}` : '',
  ].join('');

  // Personalization logic using the prop
  const firstName = (userName || 'there').split(' ')[0];
  const greeting = `Hello ${firstName}, welcome back to Rosie AI. I'm Rosie, your investment assistant. How can I help you today?`;

  return {
    type: 'Settings',
    audio: {
      input: { encoding: 'linear16', sample_rate: 24000 },
      output: { encoding: 'linear16', sample_rate: 24000, container: 'none' },
    },
    agent: {
      listen: {
        provider: { type: 'deepgram', version: 'v1', model: 'nova-2', language: 'en-US' }, 
      },
      think: [ 
        {
          provider: { 
            type: 'open_ai', 
            version: 'v1', 
            model: 'gpt-4o-mini' 
          },
          prompt: systemPrompt,
        }
      ],
      speak: {
        provider: { type: 'deepgram', version: 'v1', model: cfg.voiceModel || 'aura-asteria-en' }
      },
      greeting: greeting,
    },
  };
}

export default function RosieVoiceAgent({ userName = 'there' }) {
  const [settings] = useState(() => getPortalSettings());
  const [phase, setPhase] = useState('idle'); 
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const wsRef        = useRef(null);
  const audioCtxRef  = useRef(null);
  const micStreamRef = useRef(null);
  const processorRef = useRef(null);
  const playQueueRef = useRef([]);   
  const isPlayingRef = useRef(false);
  const sourceRef    = useRef(null);
  const phaseRef     = useRef('idle');

  const playNextChunk = useCallback(() => {
    if (isPlayingRef.current || playQueueRef.current.length === 0) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    isPlayingRef.current = true;
    const chunk = playQueueRef.current.shift();
    const int16 = new Int16Array(chunk);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    sourceRef.current = src;
    src.onended = () => {
      isPlayingRef.current = false;
      if (playQueueRef.current.length === 0) setAgentSpeaking(false);
      else playNextChunk();
    };
    src.start();
  }, []);

  const connect = useCallback(async () => {
    setError('');
    phaseRef.current = 'connecting';
    setPhase('connecting');

    const cfg = await refreshPortalSettings();
    const activeKey = TEMP_KEY;

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

    /**
     * ✅ AUTH FIX: USE SEC-WEBSOCKET-PROTOCOL
     * This passes the key via the sub-protocol header, which browsers allow.
     * The array format [protocol, key] is standard for token-based WS auth.
     */
    const ws = new WebSocket(DG_WS_URL, ['token.deepgram.com', activeKey]);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        if (e.data.byteLength > 0) {
          setAgentSpeaking(true);
          playQueueRef.current.push(e.data);
          playNextChunk();
        }
        return;
      }

      try {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case 'Welcome':
            ws.send(JSON.stringify(buildDGSettings(cfg, userName)));
            break;
          case 'SettingsApplied':
            phaseRef.current = 'active';
            setPhase('active');
            {
              const source = ctx.createMediaStreamSource(stream);
              const processor = ctx.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;
              processor.onaudioprocess = (ev) => {
                if (ws.readyState !== WebSocket.OPEN) return;
                const float32 = ev.inputBuffer.getChannelData(0);
                const int16 = new Int16Array(float32.length);
                for (let i = 0; i < float32.length; i++) {
                  int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
                }
                ws.send(int16.buffer);
              };
              source.connect(processor);
              processor.connect(ctx.destination);
            }
            break;
          case 'ConversationText':
            setTranscript(prev => [...prev, { role: msg.role, text: msg.content }]);
            break;
          case 'UserStartedSpeaking':
            if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} }
            playQueueRef.current = [];
            isPlayingRef.current = false;
            setAgentSpeaking(false);
            break;
          case 'Error':
            setError(`Deepgram error: ${msg.description || msg.message}`);
            break;
        }
      } catch (err) {}
    };

    ws.onclose = (e) => {
      console.warn("WS Close Code:", e.code, "Reason:", e.reason);
      if (phaseRef.current !== 'error') {
        setError(`Disconnected (${e.code}).`);
        setPhase('error');
      }
      cleanup(false);
    };
  }, [playNextChunk, userName]);

  const cleanup = useCallback((updatePhase = true) => {
    if (processorRef.current) processorRef.current.disconnect();
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    if (wsRef.current) wsRef.current.close();
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    if (updatePhase) setPhase('idle');
    setAgentSpeaking(false);
  }, []);

  const disconnect = useCallback(() => cleanup(true), [cleanup]);
  useEffect(() => () => cleanup(false), [cleanup]);

  if (!isOpen) return <button onClick={() => setIsOpen(true)} style={pillStyle}>🎙 Talk to Rosie</button>;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ ...orbStyle, background: phase === 'active' && agentSpeaking ? GOLD : 'rgba(184,147,58,0.2)' }}>🎙</div>
          <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>Rosie AI</div>
        </div>
        <button onClick={() => { disconnect(); setIsOpen(false); }} style={closeBtnStyle}>×</button>
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
        {phase === 'active' ? <button onClick={disconnect} style={endBtnStyle}>End Call</button> : <button onClick={connect} style={actionBtnStyle}>Start</button>}
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