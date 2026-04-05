/**
 * RosieVoiceAgent — Production Deepgram Voice Agent
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getPortalSettings } from '@/lib/portalSettings';

const GOLD = '#b8933a';
const DG_WS_URL = 'wss://agent.deepgram.com/v1/listen';

export const AURA2_VOICES = [
  { id: 'aura-2-asteria-en',   name: 'Asteria',   gender: 'F', tone: 'Warm · Professional',    featured: true },
  { id: 'aura-2-luna-en',      name: 'Luna',      gender: 'F', tone: 'Calm · Clear',            featured: true },
  { id: 'aura-2-orpheus-en',   name: 'Orpheus',   gender: 'M', tone: 'Authoritative · Rich',    featured: true },
  { id: 'aura-2-hera-en',      name: 'Hera',      gender: 'F', tone: 'Confident · Polished',    featured: true },
  { id: 'aura-2-orion-en',     name: 'Orion',     gender: 'M', tone: 'Deep · Trustworthy',      featured: true },
  { id: 'aura-2-thalia-en',    name: 'Thalia',    gender: 'F', tone: 'Bright · Engaging',       featured: true },
  { id: 'aura-2-amalthea-en',  name: 'Amalthea',  gender: 'F', tone: 'Soft · Nurturing' },
  { id: 'aura-2-andromeda-en', name: 'Andromeda', gender: 'F', tone: 'Elegant · Refined' },
  { id: 'aura-2-apollo-en',    name: 'Apollo',    gender: 'M', tone: 'Smooth · Melodic' },
  { id: 'aura-2-arcas-en',     name: 'Arcas',     gender: 'M', tone: 'Steady · Reliable' },
  { id: 'aura-2-aries-en',     name: 'Aries',     gender: 'M', tone: 'Bold · Direct' },
  { id: 'aura-2-athena-en',    name: 'Athena',    gender: 'F', tone: 'Intelligent · Clear' },
  { id: 'aura-2-atlas-en',     name: 'Atlas',     gender: 'M', tone: 'Measured · Strong' },
  { id: 'aura-2-aurora-en',    name: 'Aurora',    gender: 'F', tone: 'Upbeat · Fresh' },
  { id: 'aura-2-callista-en',  name: 'Callista',  gender: 'F', tone: 'Graceful · Warm' },
  { id: 'aura-2-cora-en',      name: 'Cora',      gender: 'F', tone: 'Friendly · Approachable' },
  { id: 'aura-2-cordelia-en',  name: 'Cordelia',  gender: 'F', tone: 'Gentle · Sincere' },
  { id: 'aura-2-delia-en',     name: 'Delia',     gender: 'F', tone: 'Light · Cheerful' },
  { id: 'aura-2-draco-en',     name: 'Draco',     gender: 'M', tone: 'Serious · Commanding' },
  { id: 'aura-2-electra-en',   name: 'Electra',   gender: 'F', tone: 'Dynamic · Assertive' },
  { id: 'aura-2-harmonia-en',  name: 'Harmonia',  gender: 'F', tone: 'Balanced · Soothing' },
  { id: 'aura-2-helena-en',    name: 'Helena',    gender: 'F', tone: 'Classic · Composed' },
  { id: 'aura-2-hermes-en',    name: 'Hermes',    gender: 'M', tone: 'Crisp · Efficient' },
  { id: 'aura-2-hyperion-en',  name: 'Hyperion',  gender: 'M', tone: 'Resonant · Formal' },
  { id: 'aura-2-iris-en',      name: 'Iris',      gender: 'F', tone: 'Vibrant · Expressive' },
  { id: 'aura-2-janus-en',     name: 'Janus',     gender: 'M', tone: 'Versatile · Neutral' },
  { id: 'aura-2-juno-en',      name: 'Juno',      gender: 'F', tone: 'Regal · Assured' },
  { id: 'aura-2-jupiter-en',   name: 'Jupiter',   gender: 'M', tone: 'Powerful · Authoritative' },
  { id: 'aura-2-mars-en',      name: 'Mars',      gender: 'M', tone: 'Strong · Decisive' },
  { id: 'aura-2-minerva-en',   name: 'Minerva',   gender: 'F', tone: 'Wise · Articulate' },
  { id: 'aura-2-neptune-en',   name: 'Neptune',   gender: 'M', tone: 'Flowing · Calm' },
  { id: 'aura-2-odysseus-en',  name: 'Odysseus',  gender: 'M', tone: 'Experienced · Warm' },
  { id: 'aura-2-ophelia-en',   name: 'Ophelia',   gender: 'F', tone: 'Delicate · Poetic' },
  { id: 'aura-2-pandora-en',   name: 'Pandora',   gender: 'F', tone: 'Curious · Lively' },
  { id: 'aura-2-phoebe-en',    name: 'Phoebe',    gender: 'F', tone: 'Gentle · Optimistic' },
  { id: 'aura-2-pluto-en',     name: 'Pluto',     gender: 'M', tone: 'Deep · Mysterious' },
  { id: 'aura-2-saturn-en',    name: 'Saturn',    gender: 'M', tone: 'Formal · Methodical' },
  { id: 'aura-2-selene-en',    name: 'Selene',    gender: 'F', tone: 'Smooth · Luminous' },
  { id: 'aura-2-theia-en',     name: 'Theia',     gender: 'F', tone: 'Radiant · Strong' },
  { id: 'aura-2-vesta-en',     name: 'Vesta',     gender: 'F', tone: 'Steadfast · Warm' },
  { id: 'aura-2-zeus-en',      name: 'Zeus',      gender: 'M', tone: 'Commanding · Bold' },
];

function buildDGSettings(cfg) {
  return {
    type: 'Settings',
    audio: {
      input:  { encoding: 'linear16', sample_rate: 16000 },
      output: { encoding: 'linear16', sample_rate: 24000, container: 'none' },
    },
    agent: {
      greeting: cfg.chatbotGreeting || "Hi! I'm Rosie. How can I help you today?",
      listen: {
        model: 'nova-3',
        provider: { type: 'deepgram' },
      },
      think: {
        provider: {
          type: cfg.llmProvider || 'anthropic',
          model: cfg.llmModel || 'claude-sonnet-4-5',
        },
        prompt: [
          cfg.chatbotContext || 'You are Rosie, a helpful investment assistant for Rosie AI LLC.',
          cfg.knowledgeBase ? `\n\n--- KNOWLEDGE BASE ---\n${cfg.knowledgeBase}` : '',
        ].join(''),
      },
      speak: {
        model: cfg.voiceModel || 'aura-2-asteria-en',
        provider: { type: 'deepgram' },
      },
    },
  };
}

export default function RosieVoiceAgent() {
  const [settings] = useState(getPortalSettings);
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
    setPhase('connecting');
    setTranscript([]);

    const cfg = getPortalSettings();

    if (!cfg.deepgramApiKey) {
      setError('No Deepgram API key configured. Ask the admin to add one in Portal Controls → AI Chatbot.');
      setPhase('error');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
    } catch (e) {
      setError('Microphone access denied. Please allow microphone access and try again.');
      setPhase('error');
      return;
    }

    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    audioCtxRef.current = ctx;

    const ws = new WebSocket(DG_WS_URL, ['token', cfg.deepgramApiKey]);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setPhase('active');
      ws.send(JSON.stringify(buildDGSettings(cfg)));

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
        }
        ws.send(int16.buffer);
      };

      source.connect(processor);
      processor.connect(ctx.destination);
    };

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
            setError(`Deepgram error: ${msg.description || msg.code}`);
            break;
          default:
            break;
        }
      } catch {}
    };

    ws.onerror = () => {
      setError('WebSocket connection failed. Check your API key and network.');
      setPhase('error');
    };

    ws.onclose = () => {
      setPhase('idle');
      cleanup(false);
    };
  }, [playNextChunk]);

  const cleanup = useCallback((updatePhase = true) => {
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch {} processorRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
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

  const cfg = getPortalSettings();
  const voiceName = AURA2_VOICES.find(v => v.id === cfg.voiceModel)?.name || 'Asteria';

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed', bottom: '32px', right: '32px',
          background: 'linear-gradient(135deg, #b8933a, #d4aa50)',
          color: '#0a0f1e', border: 'none', borderRadius: '50px',
          padding: '14px 24px', cursor: 'pointer',
          fontSize: '13px', fontWeight: '700', letterSpacing: '1px',
          boxShadow: '0 8px 32px rgba(184,147,58,0.5)',
          display: 'flex', alignItems: 'center', gap: '10px',
          zIndex: 500, fontFamily: 'Georgia, serif',
        }}
      >
        <span style={{ fontSize: '18px' }}>🎙</span> Talk to Rosie
      </button>
    );
  }

  const statusColor = { idle: '#6b7280', connecting: '#f59e0b', active: '#4ade80', error: '#ef4444' }[phase];
  const statusLabel = { idle: 'Ready', connecting: 'Connecting…', active: userSpeaking ? 'Listening…' : agentSpeaking ? 'Speaking…' : 'Listening…', error: 'Error' }[phase];

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px',
      width: '400px', height: '560px',
      background: '#0d1b2a', border: '1px solid rgba(184,147,58,0.3)',
      borderRadius: '4px', display: 'flex', flexDirection: 'column',
      boxShadow: '0 24px 80px rgba(0,0,0,0.7)', zIndex: 500,
      fontFamily: 'Georgia, serif', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(184,147,58,0.2), rgba(184,147,58,0.08))',
        borderBottom: '1px solid rgba(184,147,58,0.2)',
        padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
            background: phase === 'active' && agentSpeaking ? 'linear-gradient(135deg, #b8933a, #d4aa50)' : 'rgba(184,147,58,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: phase === 'active' && agentSpeaking ? '0 0 16px rgba(184,147,58,0.6)' : 'none',
            transition: 'all 0.3s',
            animation: phase === 'active' && agentSpeaking ? 'pulse 1s ease-in-out infinite' : 'none',
          }}>
            <span style={{ fontSize: '16px' }}>🎙</span>
          </div>
          <div>
            <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>Rosie AI · Voice Agent</div>
            <div style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', background: statusColor, borderRadius: '50%', display: 'inline-block' }} />
              <span style={{ color: statusColor }}>{statusLabel}</span>
              {phase === 'active' && <span style={{ color: '#4a5568', marginLeft: '4px' }}>· {voiceName} voice</span>}
            </div>
          </div>
        </div>
        <button onClick={() => { disconnect(); setIsOpen(false); }}
          style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' }}>×</button>
      </div>

      {/* Transcript */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {transcript.length === 0 && phase === 'idle' && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4a5568' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎙</div>
            <div style={{ color: '#6b7280', fontSize: '14px', lineHeight: 1.6, marginBottom: '8px' }}>
              Talk to Rosie about the investment opportunity, our platform, or the subscription process.
            </div>
            <div style={{ color: '#4a5568', fontSize: '11px' }}>Powered by Deepgram Voice Agent API</div>
          </div>
        )}
        {transcript.length === 0 && phase === 'connecting' && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</div>
            <div>Connecting to Deepgram…</div>
          </div>
        )}
        {transcript.length === 0 && phase === 'active' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 16px',
              background: 'linear-gradient(135deg, rgba(184,147,58,0.3), rgba(184,147,58,0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px',
              boxShadow: agentSpeaking ? '0 0 24px rgba(184,147,58,0.5)' : 'none',
              animation: agentSpeaking ? 'pulse 1s ease-in-out infinite' : 'none',
              transition: 'all 0.3s',
            }}>🎙</div>
            <div style={{ color: GOLD, fontSize: '13px' }}>
              {agentSpeaking ? 'Rosie is speaking…' : 'Speak now — Rosie is listening'}
            </div>
            <div style={{ color: '#4a5568', fontSize: '11px', marginTop: '8px' }}>You can interrupt at any time</div>
          </div>
        )}
        {transcript.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              background: msg.role === 'user' ? 'linear-gradient(135deg, #b8933a, #d4aa50)' : 'rgba(255,255,255,0.06)',
              color: msg.role === 'user' ? '#0a0f1e' : '#c4cdd8',
              padding: '10px 14px', borderRadius: '3px', fontSize: '13px', lineHeight: 1.55,
              border: msg.role !== 'user' ? '1px solid rgba(255,255,255,0.07)' : 'none',
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', padding: '12px', color: '#fca5a5', fontSize: '12px', lineHeight: 1.5 }}>
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {phase === 'idle' || phase === 'error' ? (
          <button onClick={connect} style={{
            width: '100%', background: 'linear-gradient(135deg, #b8933a, #d4aa50)',
            color: '#0a0f1e', border: 'none', borderRadius: '2px',
            padding: '13px', cursor: 'pointer', fontWeight: '700',
            fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase',
            fontFamily: 'Georgia, serif',
          }}>
            {phase === 'error' ? '↺ Try Again' : '🎙 Start Conversation'}
          </button>
        ) : phase === 'connecting' ? (
          <button disabled style={{
            width: '100%', background: 'rgba(184,147,58,0.3)', color: '#6b7280',
            border: 'none', borderRadius: '2px', padding: '13px',
            fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'not-allowed',
          }}>Connecting…</button>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{
              flex: 1, background: userSpeaking ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${userSpeaking ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '2px', padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: userSpeaking ? '#4ade80' : agentSpeaking ? GOLD : '#3a4a5e',
                boxShadow: userSpeaking ? '0 0 8px #4ade80' : agentSpeaking ? `0 0 8px ${GOLD}` : 'none',
                flexShrink: 0, transition: 'all 0.2s',
                animation: (userSpeaking || agentSpeaking) ? 'pulse 0.8s ease-in-out infinite' : 'none',
              }} />
              <span style={{ color: '#6b7280', fontSize: '12px' }}>
                {userSpeaking ? 'You are speaking' : agentSpeaking ? 'Rosie is speaking' : 'Listening…'}
              </span>
            </div>
            <button onClick={disconnect} style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#ef4444', borderRadius: '2px', padding: '10px 16px',
              cursor: 'pointer', fontSize: '12px', fontFamily: 'Georgia, serif', letterSpacing: '1px',
            }}>End</button>
          </div>
        )}
        <div style={{ color: '#2d3748', fontSize: '10px', textAlign: 'center', marginTop: '8px' }}>
          Powered by Deepgram Voice Agent API · Nova-3 STT · Aura-2 TTS
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.1)} }
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}