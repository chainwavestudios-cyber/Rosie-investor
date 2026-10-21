/**
 * useAgentVoice.js — Hands-free voice for the contact-card AI agent.
 *   Mic  → Deepgram live transcription; one spoken utterance = one command.
 *   Reply → text in the chat by default; the mic opens straight back up.
 *           Optional: 🔊 Voice replies reads the answer out with Deepgram Aura.
 * The mic feed is muted while the agent thinks or talks so it never transcribes
 * its own voice. Browser support: Chrome/Edge/Safari desktop.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const TTS_DEFAULT_VOICE = 'aura-2-thalia-en';
const TTS_TIMEOUT_MS = 25000;

export function useAgentVoice({ onUtterance }) {
  const [status, setStatus] = useState('off'); // off | connecting | listening | thinking | speaking | error
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const [speakReplies, setSpeakRepliesState] = useState(false); // text replies by default

  const statusRef = useRef('off');
  const keyRef = useRef('');
  const speakRepliesRef = useRef(false);
  const wsRef = useRef(null);
  const ctxRef = useRef(null);
  const streamRef = useRef(null);
  const micGainRef = useRef(null);
  const nodesRef = useRef([]);
  const audioRef = useRef(null);
  const pendingRef = useRef('');
  const lastUtteranceRef = useRef('');
  const onUtteranceRef = useRef(onUtterance);

  useEffect(() => { onUtteranceRef.current = onUtterance; }, [onUtterance]);

  const setPhase = useCallback((next) => { statusRef.current = next; setStatus(next); }, []);

  /** Replies are text by default — this turns the spoken replies back on. */
  const setSpeakReplies = useCallback((on) => {
    speakRepliesRef.current = !!on;
    setSpeakRepliesState(!!on);
  }, []);

  const setMicMuted = useCallback((muted) => {
    if (micGainRef.current) micGainRef.current.gain.value = muted ? 0 : 1;
  }, []);

  const stop = useCallback(() => {
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
    nodesRef.current.forEach(n => { try { n.disconnect(); } catch {} });
    nodesRef.current = [];
    micGainRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (ctxRef.current) { try { ctxRef.current.close(); } catch {} ctxRef.current = null; }
    if (audioRef.current) { try { audioRef.current.pause(); } catch {} audioRef.current = null; }
    pendingRef.current = '';
    setInterim('');
    setError('');
    setPhase('off');
  }, [setPhase]);

  const start = useCallback(async () => {
    if (statusRef.current !== 'off' && statusRef.current !== 'error') return;
    setError('');
    setPhase('connecting');
    try {
      let key = '';
      try {
        const res = await base44.functions.invoke('deepgramToken', {});
        key = res?.data?.key || res?.key || '';
      } catch { key = ''; }
      if (!key) key = import.meta.env.VITE_DEEPGRAM_API_KEY || '';
      if (!key) throw new Error('No Deepgram key available.');
      keyRef.current = key;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      if (ctx.state === 'suspended') await ctx.resume();
      ctxRef.current = ctx;

      const params = new URLSearchParams({
        model: 'nova-3',
        punctuate: 'true',
        smart_format: 'true',
        interim_results: 'true',
        utterance_end_ms: '1200',
        endpointing: '500',
        encoding: 'linear16',
        sample_rate: String(ctx.sampleRate),
        channels: '1',
      });

      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['token', key]);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        const source = ctx.createMediaStreamSource(stream);
        const micGain = ctx.createGain();
        micGain.gain.value = 1;
        micGainRef.current = micGain;
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;
        nodesRef.current.push(source, micGain, processor, silentGain);

        source.connect(micGain);
        micGain.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(ctx.destination);

        processor.onaudioprocess = (ev) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const data = ev.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(data.length);
          for (let i = 0; i < data.length; i++) {
            const s = Math.max(-1, Math.min(1, data[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          ws.send(pcm.buffer);
        };
        setPhase('listening');
      };

      ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        if (msg.type !== 'Results') return;

        const text = msg.channel?.alternatives?.[0]?.transcript?.trim() || '';
        if (!msg.is_final) { setInterim(text); return; }

        if (text) pendingRef.current = `${pendingRef.current} ${text}`.trim();
        setInterim(pendingRef.current);

        const finished = msg.speech_final || msg.from_finalize;
        if (!finished) return;

        const utterance = pendingRef.current.trim();
        pendingRef.current = '';
        setInterim('');
        if (!utterance || utterance === lastUtteranceRef.current) return;
        lastUtteranceRef.current = utterance;
        setMicMuted(true);
        setPhase('thinking');
        onUtteranceRef.current?.(utterance);
      };

      ws.onerror = () => { setError('Deepgram connection error.'); setPhase('error'); };
      ws.onclose = () => {
        if (statusRef.current !== 'off' && statusRef.current !== 'error') setPhase('error');
      };
    } catch (e) {
      setError(e?.message || 'Could not start the microphone.');
      setPhase('error');
      try { wsRef.current?.close(); } catch {}
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      if (ctxRef.current) { try { ctxRef.current.close(); } catch {} ctxRef.current = null; }
      setMicMuted(true);
    }
  }, [setMicMuted, setPhase]);

  /** Speak a reply through the speakers. Deepgram Aura voice. */
  const speak = useCallback(async (raw) => {
    const text = String(raw || '').replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
    if (statusRef.current === 'off') return;
    // Nothing to say — hand the mic straight back instead of leaving it muted
    if (!text) {
      setMicMuted(false);
      lastUtteranceRef.current = '';
      setPhase('listening');
      return;
    }
    setMicMuted(true);
    setPhase('speaking');
    try {
      const res = await fetch(`https://api.deepgram.com/v1/speak?model=${TTS_DEFAULT_VOICE}&encoding=mp3`, {
        method: 'POST',
        headers: { Authorization: `Token ${keyRef.current}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 1800) }),
        signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Voice error (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        if (statusRef.current === 'off') return;
        setMicMuted(false);
        lastUtteranceRef.current = '';
        setPhase('listening');
      };
      await audio.play();
    } catch (e) {
      setError(e?.message || 'Could not play the voice reply.');
      if (statusRef.current !== 'off') { setMicMuted(false); setPhase('listening'); }
    }
  }, [setMicMuted, setPhase]);

  /** Called by the agent when a reply is ready — keeps the loop moving. */
  const idle = useCallback(() => {
    if (statusRef.current === 'off' || statusRef.current === 'error') return;
    setMicMuted(false);
    lastUtteranceRef.current = '';
    setPhase('listening');
  }, [setMicMuted, setPhase]);

  /**
   * Reply after each command. Text is the default: the answer lands in the chat
   * and the mic opens straight back up so the agent can keep talking. With
   * 🔊 Voice replies on, the answer is read out loud instead.
   */
  const speakIfActive = useCallback((text) => {
    if (statusRef.current === 'off') return;
    if (!speakRepliesRef.current) { idle(); return; }
    speak(text);
  }, [speak, idle]);

  useEffect(() => () => stop(), [stop]);

  return { status, interim, error, start, stop, speak, speakIfActive, idle, speakReplies, setSpeakReplies };
}

export default useAgentVoice;