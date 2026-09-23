/**
 * useDebtBobVoice.js — Deepgram Voice Agent hook for BOB training.
 * Handles: mic enumeration, ring tone, WebSocket to Deepgram Agent,
 * audio playback (Bob's voice), mic streaming, transcript tracking.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const DG_WS_URL = 'wss://agent.deepgram.com/v1/agent/converse';

function useRingTone() {
  const ctxRef = useRef(null);
  const play = useCallback((onPickup) => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { setTimeout(onPickup, 3800); return; }
    const ctx = new AC();
    ctxRef.current = ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const playRing = (startAt) => {
      [440, 480].forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(0.18, startAt + 0.04);
        gain.gain.setValueAtTime(0.18, startAt + 1.96);
        gain.gain.linearRampToValueAtTime(0, startAt + 2.0);
        osc.start(startAt); osc.stop(startAt + 2.0);
      });
    };
    const now = ctx.currentTime + 0.1;
    playRing(now);
    setTimeout(onPickup, 3800);
  }, []);
  const stop = useCallback(() => {
    if (ctxRef.current) { try { ctxRef.current.close(); } catch {} ctxRef.current = null; }
  }, []);
  return { play, stop };
}

export function useDebtBobVoice({ onTranscript, onLog } = {}) {
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [micDevices, setMicDevices] = useState([]);
  const [micDeviceId, setMicDeviceId] = useState('');
  const [ringPhase, setRingPhase] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState('');

  const wsRef = useRef(null);
  const recorderRef = useRef(null);
  const recordDestRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const processorRef = useRef(null);
  const nextStartRef = useRef(0);
  const listeningRef = useRef(false);
  const ring = useRingTone();

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => navigator.mediaDevices.enumerateDevices())
      .then(devices => {
        const mics = devices.filter(d => d.kind === 'audioinput');
        setMicDevices(mics);
        if (mics.length > 0 && !micDeviceId) setMicDeviceId(mics[0].deviceId);
      })
      .catch(() => {});
  }, []);

  const playChunk = useCallback((buf) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const int16 = new Int16Array(buf);
    const f32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768.0;
    const ab = ctx.createBuffer(1, f32.length, 24000);
    ab.copyToChannel(f32, 0);
    const src = ctx.createBufferSource();
    src.buffer = ab; src.connect(ctx.destination);
    if (recordDestRef.current) src.connect(recordDestRef.current);
    const now = ctx.currentTime;
    if (nextStartRef.current < now) nextStartRef.current = now + 0.05;
    src.start(nextStartRef.current);
    nextStartRef.current += ab.duration;
    src.onended = () => { if (ctx.currentTime >= nextStartRef.current - 0.01) setAgentSpeaking(false); };
  }, []);

  const cleanup = useCallback((updatePhase = true) => {
    listeningRef.current = false;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      const rec = recorderRef.current;
      rec.onstop = async () => {
        setIsRecording(false);
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];
        if (blob.size < 2000) return;
        try {
          const file = new File([blob], `bob-training-${Date.now()}.webm`, { type: 'audio/webm' });
          const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
          setRecordingUrl(file_url);
          onLog?.('session_end', `🎵 Recording saved: ${file_url}`);
        } catch (e) { console.warn('[BOB] Recording upload failed:', e); }
      };
      try { rec.stop(); } catch {}
    }
    recorderRef.current = null; recordDestRef.current = null;
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch {} }
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    if (wsRef.current) { try { wsRef.current.close(); } catch {} }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} }
    audioCtxRef.current = null; micStreamRef.current = null; wsRef.current = null;
    if (updatePhase) setPhase('idle');
    ring.stop();
  }, [ring, onLog]);

  const startCall = useCallback(async ({ apiKey, systemPrompt, voiceModel, greeting, sessionLabel }) => {
    setError(''); setPhase('ringing'); setRingPhase(true);
    onLog?.('session_start', `📞 ${sessionLabel} started.`);

    ring.play(async () => {
      setRingPhase(false); setPhase('connecting');

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true });
        micStreamRef.current = stream;
      } catch {
        setError('Microphone access denied.');
        setPhase('error');
        return;
      }

      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      audioCtxRef.current = ctx; nextStartRef.current = 0;
      const recordDest = ctx.createMediaStreamDestination();
      recordDestRef.current = recordDest;

      const ws = new WebSocket(DG_WS_URL, ['token', apiKey]);
      ws.binaryType = 'arraybuffer'; wsRef.current = ws;
      console.log('[BOB] Connecting to Deepgram Voice Agent, key prefix:', apiKey.slice(0, 8) + '...');

      ws.onopen = () => console.log('[BOB] WebSocket open ✓ — waiting for Welcome message');

      ws.onmessage = (e) => {
        if (e.data instanceof ArrayBuffer) { setAgentSpeaking(true); playChunk(e.data); return; }
        try {
          const msg = JSON.parse(e.data);
          switch (msg.type) {
            case 'Welcome':
              ws.send(JSON.stringify({
                type: 'Settings',
                audio: { input: { encoding: 'linear16', sample_rate: 24000 }, output: { encoding: 'linear16', sample_rate: 24000, container: 'none' } },
                agent: {
                  listen: { provider: { type: 'deepgram', version: 'v2', model: 'flux-general-en' } },
                  think: { provider: { type: 'open_ai', model: 'gpt-4.1-mini' }, prompt: systemPrompt },
                  speak: { provider: { type: 'deepgram', model: voiceModel } },
                  greeting,
                },
              }));
              break;
            case 'SettingsApplied': {
              const source = ctx.createMediaStreamSource(stream);
              const processor = ctx.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;
              processor.onaudioprocess = (ev) => {
                if (ws.readyState !== WebSocket.OPEN || !listeningRef.current) return;
                const input = ev.inputBuffer.getChannelData(0);
                const int16 = new Int16Array(input.length);
                for (let i = 0; i < input.length; i++) { const s = Math.max(-1, Math.min(1, input[i])); int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; }
                ws.send(int16.buffer);
              };
              source.connect(processor);
              source.connect(recordDestRef.current);
              const silence = ctx.createGain(); silence.gain.value = 0;
              processor.connect(silence); silence.connect(ctx.destination);
              try {
                const recorder = new MediaRecorder(recordDestRef.current.stream);
                chunksRef.current = [];
                recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
                recorder.start(1000);
                recorderRef.current = recorder;
                setIsRecording(true);
              } catch (e) { console.warn('[BOB] Recording failed:', e); }
              setPhase('active');
              break;
            }
            case 'AgentAudioDone': listeningRef.current = true; break;
            case 'ConversationText': {
              const entry = { role: msg.role === 'user' ? 'trainee' : 'bob', text: msg.content, time: new Date().toISOString() };
              onTranscript?.(entry);
              onLog?.('transcript', `[${entry.role === 'bob' ? '🤖 BOB' : '🎙 TRAINEE'}] ${msg.content}`);
              break;
            }
            case 'UserStartedSpeaking':
              try { if (audioCtxRef.current) nextStartRef.current = 0; } catch {}
              setAgentSpeaking(false);
              break;
            case 'Error':
              console.error('[BOB] Deepgram Error:', msg.code, msg.description);
              setError(`Deepgram: ${msg.code} — ${msg.description}`);
              onLog?.('session_end', `❌ Deepgram error: ${msg.code} — ${msg.description}`);
              break;
            case 'Warning':
              console.warn('[BOB] Deepgram Warning:', msg.code, msg.description);
              break;
            default:
              console.log('[BOB] Unhandled message type:', msg.type, msg);
          }
        } catch (e) { console.error('[BOB] Message parse error:', e); }
      };

      ws.onerror = () => {
        setError('WebSocket error — check Deepgram API key.');
        onLog?.('session_end', '❌ WebSocket error.');
      };

      ws.onclose = (e) => {
        const codeMsg = {
          1000: 'Normal close', 1006: 'Connection dropped (network or bad API key)',
          1008: 'Auth failed — check Deepgram API key', 4000: 'Invalid API key',
          4001: 'Unauthorized', 4002: 'Insufficient credits',
        }[e.code] || `Close code ${e.code}`;
        setError(e.code !== 1000 ? `Disconnected: ${codeMsg}` : '');
        setPhase('idle'); ring.stop(); cleanup(false);
        onLog?.('session_end', `📵 Call ended. ${codeMsg}.`);
      };
    });
  }, [micDeviceId, playChunk, ring, onTranscript, onLog, cleanup]);

  const hangup = useCallback(() => { cleanup(true); }, [cleanup]);

  useEffect(() => () => cleanup(false), [cleanup]);

  return { phase, error, agentSpeaking, micDevices, micDeviceId, setMicDeviceId, ringPhase, startCall, hangup, isRecording, recordingUrl };
}