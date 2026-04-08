/**
 * RosieVoiceAgent — Production Deepgram Voice Agent
 * * Updates:
 * - Hardcoded Temp API Key for testing
 * - Endpoint: wss://api.deepgram.com/v1/agent/converse
 * - Fixed LLM Model: gpt-4o-mini
 * - Fixed Settings Schema
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getPortalSettings, refreshPortalSettings } from '@/lib/portalSettings';

const GOLD = '#b8933a';
const DG_WS_URL = 'wss://api.deepgram.com/v1/agent/converse';
// YOUR TEMP KEY
const TEMP_KEY = '092aa81ccc2ed9f89a6aa448a5fee102f6043567';

export const AURA_VOICES = [
  { id: 'aura-asteria-en',   name: 'Asteria',   gender: 'F', tone: 'Warm · Professional',    featured: true },
  { id: 'aura-luna-en',      name: 'Luna',      gender: 'F', tone: 'Calm · Clear',            featured: true },
  { id: 'aura-orpheus-en',   name: 'Orpheus',   gender: 'M', tone: 'Authoritative · Rich',    featured: true },
  { id: 'aura-hera-en',      name: 'Hera',      gender: 'F', tone: 'Confident · Polished',    featured: true },
  { id: 'aura-orion-en',     name: 'Orion',     gender: 'M', tone: 'Deep · Trustworthy',      featured: true },
  { id: 'aura-thalia-en',    name: 'Thalia',    gender: 'F', tone: 'Bright · Engaging',       featured: true },
  { id: 'aura-cora-en',      name: 'Cora',      gender: 'F', tone: 'Friendly · Approachable' },
  { id: 'aura-zeus-en',      name: 'Zeus',      gender: 'M', tone: 'Commanding · Bold' },
];

function buildDGSettings(cfg, userName) {
  const systemPrompt = [
    cfg.chatbotContext || 'You are Rosie, a helpful investment assistant for Rosie AI LLC.',
    cfg.knowledgeBase ? `\n\n--- KNOWLEDGE BASE ---\n${cfg.knowledgeBase}` : '',
  ].join('');

  const firstName = (userName || 'there').split(' ')[0];
  const greeting = `Hello ${firstName}, welcome to Rosie AI. I'm Rosie, your investment assistant. How can I help you today?`;

  return {
    type: 'Settings',
    audio: {
      input:  { encoding: 'linear16', sample_rate: 16000 },
      output: { encoding: 'linear16', sample_rate: 24000, container: 'none' },
    },
    agent: {
      language: 'en',
      greeting,
      listen: {
        model: 'nova-3', 
      },
      think: {
        provider: { type: 'open_ai' },
        model: 'gpt-4o-mini', 
        instructions: systemPrompt,
      },
      speak: {
        model: cfg.voiceModel || 'aura-asteria-en',
      },
    },
  };
}

export default function RosieVoiceAgent({ userName = 'there' }) {
  const [settings] = useState(() => getPortalSettings());
  const [phase, setPhase] = useState('idle'); 
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
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
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

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
    setTranscript([]);

    const cfg = await refreshPortalSettings();
    
    // Priority: Temp Key -> Settings Key
    const activeKey = TEMP_KEY || cfg.deepgramApiKey;

    if (!activeKey) {
      setError('No API key available.');
      setPhase('error');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
    } catch (e) {
      setError('Mic access denied.');
      setPhase('error');
      return;
    }

    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    audioCtxRef.current = ctx;

    const wsUrl = `${DG_WS_URL}?token=${activeKey}`;
    const ws = new WebSocket(wsUrl);
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
            setTranscript(prev => [...prev, { role: msg.role, text: msg.content, ts: Date.now() }]);
            break;
          case 'UserStartedSpeaking':
            setUserSpeaking(true);
            if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} }
            playQueueRef.current = [];
            isPlayingRef.current = false;
            setAgentSpeaking(false);
            break;
          case 'AgentStartedSpeaking':
            setUserSpeaking(false);
            setAgentSpeaking(true);
            break;
          case 'Error':
            setError(`Deepgram error: ${msg.message || msg.description}`);
            break;
          default:
            break;
        }
      } catch {}
    };

    ws.onclose = (e) => {
      if (phaseRef.current !== 'error') {
        setError(`Disconnected (Code: ${e.code}).`);
        setPhase('error');
      }
      cleanup(false);
    };

    ws.onerror = (err) => console.error("WS Error:", err);

  }, [playNextChunk, userName]);

  const cleanup = useCallback((updatePhase = true) => {
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null;
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    playQueueRef.current = [];
    isPlayingRef.current = false;
    if (updatePhase) setPhase('idle');
    setAgentSpeaking(false);
    setUserSpeaking(false);
  }, []);

  const disconnect = useCallback(() => cleanup(true), [cleanup]);
  useEffect(() => () => cleanup(false), [cleanup]);

  if (!settings.chatbotEnabled) return null;

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} style={pillStyle}>
        🎙 Talk to Rosie
      </button>
    );
  }

  const statusColor = { idle: '#6b7280', connecting: '#f59e0b', active: '#4ade80', error: '#ef4444' }[phase];

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ ...orbStyle, background: phase === 'active' && agentSpeaking ? GOLD : 'rgba(184,147,58,0.2)' }}>🎙</div>
          <div>
            <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>Rosie AI</div>
            <div style={{ fontSize: '10px', color: statusColor }}>● {phase}</div>
          </div>
        </div>
        <button onClick={() => { disconnect(); setIsOpen(false); }} style={closeBtnStyle}>×</button>
      </div>

      {/* Transcript Area */}
      <div style={transcriptAreaStyle}>
        {transcript.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ ...bubbleStyle, background: msg.role === 'user' ? GOLD : 'rgba(255,255,255,0.06)', color: msg.role === 'user' ? '#000' : '#fff' }}>
              {msg.text}
            </div>
          </div>
        ))}
        {error && <div style={errorStyle}>⚠ {error}</div>}
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        {(phase === 'idle' || phase === 'error') ? (
          <button onClick={connect} style={actionBtnStyle}>Start Conversation</button>
        ) : (
          <button onClick={disconnect} style={endBtnStyle}>End Call</button>
        )}
      </div>
    </div>
  );
}

// Minimalist Styles
const pillStyle = { position: 'fixed', bottom: '32px', right: '32px', background: GOLD, color: '#000', border: 'none', borderRadius: '50px', padding: '14px 24px', cursor: 'pointer', fontWeight: 'bold', zIndex: 500 };
const containerStyle = { position: 'fixed', bottom: '24px', right: '24px', width: '380px', height: '520px', background: '#0a1118', border: `1px solid ${GOLD}44`, borderRadius: '8px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', zIndex: 500, overflow: 'hidden' };
const headerStyle = { padding: '15px', borderBottom: '1px solid #ffffff11', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const orbStyle = { width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const closeBtnStyle = { background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '20px' };
const transcriptAreaStyle = { flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' };
const bubbleStyle = { maxWidth: '80%', padding: '8px 12px', borderRadius: '12px', fontSize: '13px' };
const errorStyle = { color: '#ff4444', fontSize: '11px', textAlign: 'center', marginTop: '10px' };
const footerStyle = { padding: '15px' };
const actionBtnStyle = { width: '100%', padding: '12px', background: GOLD, border: 'none', fontWeight: 'bold', cursor: 'pointer' };
const endBtnStyle = { width: '100%', padding: '12px', background: '#ff444422', color: '#ff4444', border: '1px solid #ff444444', cursor: 'pointer' };