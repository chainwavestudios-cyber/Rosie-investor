/**
 * RosieVoiceAgent — Production Deepgram Voice Agent
 *
 * Fixed for:
 * - Correct WebSocket URL: wss://api.deepgram.com/v1/agent/converse
 * - Correct Settings Schema (Direct model keys for listen/speak)
 * - LLM model name fixed (gpt-4o-mini)
 * - Voice IDs updated
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getPortalSettings, refreshPortalSettings } from '@/lib/portalSettings';

const GOLD = '#b8933a';
// CORRECT ENDPOINT
const DG_WS_URL = 'wss://api.deepgram.com/v1/agent/converse';

// Deepgram IDs typically do not include the "-2-" version number in the string
export const AURA_VOICES = [
  { id: 'aura-asteria-en',   name: 'Asteria',   gender: 'F', tone: 'Warm · Professional',    featured: true },
  { id: 'aura-luna-en',      name: 'Luna',      gender: 'F', tone: 'Calm · Clear',            featured: true },
  { id: 'aura-orpheus-en',   name: 'Orpheus',   gender: 'M', tone: 'Authoritative · Rich',    featured: true },
  { id: 'aura-hera-en',      name: 'Hera',      gender: 'F', tone: 'Confident · Polished',    featured: true },
  { id: 'aura-orion-en',     name: 'Orion',     gender: 'M', tone: 'Deep · Trustworthy',      featured: true },
  { id: 'aura-thalia-en',    name: 'Thalia',    gender: 'F', tone: 'Bright · Engaging',       featured: true },
  { id: 'aura-cora-en',      name: 'Cora',      gender: 'F', tone: 'Friendly · Approachable' },
  { id: 'aura-perseus-en',   name: 'Perseus',   gender: 'M', tone: 'Professional · Steady' },
  { id: 'aura-stella-en',    name: 'Stella',    gender: 'F', tone: 'Clear · Energetic' },
  { id: 'aura-zeus-en',      name: 'Zeus',      gender: 'M', tone: 'Commanding · Bold' },
];

/**
 * Build Deepgram Settings payload
 * Schema updated to match Deepgram Voice Agent API specs
 */
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
        model: cfg.sttModel || 'nova-3', // Simplified: No nested 'provider'
      },
      think: {
        provider: {
          type: cfg.llmProvider || 'open_ai',
        },
        model: 'gpt-4o-mini', // Fixed typo from 4.1-mini
        instructions: systemPrompt, // Key is 'instructions', not 'prompt'
      },
      speak: {
        model: cfg.voiceModel || 'aura-asteria-en', // Simplified: No nested 'provider'
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

  // ── Playback Queue ──────────────────────────────────────────────────────
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

  // ── Connect ──────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    setError('');
    phaseRef.current = 'connecting';
    setPhase('connecting');
    setTranscript([]);

    const cfg = await refreshPortalSettings();

    if (!cfg.deepgramApiKey) {
      setError('No Deepgram API key found.');
      setPhase('error');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
    } catch (e) {
      setError('Microphone access denied.');
      setPhase('error');
      return;
    }

    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    audioCtxRef.current = ctx;

    // API Key in query string for WebSocket browser client
    const wsUrl = `${DG_WS_URL}?token=${encodeURIComponent(cfg.deepgramApiKey)}`;
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
            setTranscript(prev => [...prev, {
              role: msg.role,
              text: msg.content,
              ts: Date.now(),
            }]);
            break;
          case 'UserStartedSpeaking':
            setUserSpeaking(true);
            if (sourceRef.current) {
              try { sourceRef.current.stop(); } catch {}
            }
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
      if (phaseRef.current === 'active' || phaseRef.current === 'idle') {
        setPhase('idle');
        cleanup(false);
      } else {
        setError(`Connection closed (code ${e.code}). Check API Key.`);
        setPhase('error');
        cleanup(false);
      }
    };
  }, [playNextChunk, userName]);

  // ── Cleanup ──────────────────────────────────────────────────────────
  const cleanup = useCallback((updatePhase = true) => {
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch {}
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    playQueueRef.current = [];
    isPlayingRef.current = false;
    if (updatePhase) setPhase('idle');
    setAgentSpeaking(false);
    setUserSpeaking(false);
  }, []);

  const disconnect = useCallback(() => cleanup(true), [cleanup]);

  useEffect(() => () => cleanup(false), [cleanup]);

  if (!settings.chatbotEnabled) return null;

  const voiceName = AURA_VOICES.find(v => v.id === settings.voiceModel)?.name || 'Asteria';

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} style={pillStyle}>
        <span style={{ fontSize: '18px' }}>🎙</span> Talk to Rosie
      </button>
    );
  }

  const statusColor = { idle: '#6b7280', connecting: '#f59e0b', active: '#4ade80', error: '#ef4444' }[phase];
  const statusLabel = { idle: 'Ready', connecting: 'Connecting…', active: userSpeaking ? 'Listening…' : agentSpeaking ? 'Speaking…' : 'Listening…', error: 'Error' }[phase];

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            ...orbStyle,
            background: phase === 'active' && agentSpeaking ? 'linear-gradient(135deg, #b8933a, #d4aa50)' : 'rgba(184,147,58,0.2)',
            animation: phase === 'active' && agentSpeaking ? 'pulse 1s ease-in-out infinite' : 'none',
          }}>
            <span style={{ fontSize: '16px' }}>🎙</span>
          </div>
          <div>
            <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>Rosie AI · Voice Agent</div>
            <div style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', background: statusColor, borderRadius: '50%' }} />
              <span style={{ color: statusColor }}>{statusLabel}</span>
              {phase === 'active' && <span style={{ color: '#4a5568' }}>· {voiceName}</span>}
            </div>
          </div>
        </div>
        <button onClick={() => { disconnect(); setIsOpen(false); }} style={closeBtnStyle}>×</button>
      </div>

      {/* Transcript Area */}
      <div style={transcriptAreaStyle}>
        {transcript.length === 0 && phase === 'active' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ ...statusOrbLarge, animation: agentSpeaking ? 'pulse 1s ease-in-out infinite' : 'none' }}>🎙</div>
            <div style={{ color: GOLD, fontSize: '13px' }}>{agentSpeaking ? 'Rosie is speaking…' : 'Speak now — Rosie is listening'}</div>
          </div>
        )}
        {transcript.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ ...bubbleStyle, background: msg.role === 'user' ? 'linear-gradient(135deg, #b8933a, #d4aa50)' : 'rgba(255,255,255,0.06)', color: msg.role === 'user' ? '#0a0f1e' : '#c4cdd8' }}>
              {msg.text}
            </div>
          </div>
        ))}
        {error && <div style={errorStyle}>⚠ {error}</div>}
      </div>

      {/* Footer Controls */}
      <div style={footerStyle}>
        {(phase === 'idle' || phase === 'error') ? (
          <button onClick={connect} style={actionBtnStyle}>
            {phase === 'error' ? '↺ Try Again' : '🎙 Start Conversation'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ ...indicatorStyle, borderColor: userSpeaking ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.08)' }}>
              <span style={{ ...smallOrb, background: userSpeaking ? '#4ade80' : agentSpeaking ? GOLD : '#3a4a5e' }} />
              <span style={{ color: '#6b7280', fontSize: '12px' }}>{userSpeaking ? 'You are speaking' : agentSpeaking ? 'Rosie is speaking' : 'Listening…'}</span>
            </div>
            <button onClick={disconnect} style={endBtnStyle}>End</button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.1)} }
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const pillStyle = { position: 'fixed', bottom: '32px', right: '32px', background: 'linear-gradient(135deg, #b8933a, #d4aa50)', color: '#0a0f1e', border: 'none', borderRadius: '50px', padding: '14px 24px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', letterSpacing: '1px', boxShadow: '0 8px 32px rgba(184,147,58,0.5)', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 500 };
const containerStyle = { position: 'fixed', bottom: '24px', right: '24px', width: '400px', height: '560px', background: '#0d1b2a', border: '1px solid rgba(184,147,58,0.3)', borderRadius: '4px', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', zIndex: 500, overflow: 'hidden' };
const headerStyle = { background: 'linear-gradient(135deg, rgba(184,147,58,0.2), rgba(184,147,58,0.08))', borderBottom: '1px solid rgba(184,147,58,0.2)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const orbStyle = { width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' };
const closeBtnStyle = { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' };
const transcriptAreaStyle = { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' };
const bubbleStyle = { maxWidth: '85%', padding: '10px 14px', borderRadius: '3px', fontSize: '13px', lineHeight: 1.55 };
const statusOrbLarge = { width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 16px', background: 'linear-gradient(135deg, rgba(184,147,58,0.3), rgba(184,147,58,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' };
const errorStyle = { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', padding: '12px', color: '#fca5a5', fontSize: '12px' };
const footerStyle = { padding: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' };
const actionBtnStyle = { width: '100%', background: 'linear-gradient(135deg, #b8933a, #d4aa50)', color: '#0a0f1e', border: 'none', borderRadius: '2px', padding: '13px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' };
const indicatorStyle = { flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid', borderRadius: '2px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' };
const smallOrb = { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 };
const endBtnStyle = { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', borderRadius: '2px', padding: '10px 16px', cursor: 'pointer', fontSize: '12px' };