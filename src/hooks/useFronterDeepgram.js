/**
 * useFronterDeepgram.js — Live transcription hook for fronter calls.
 * Captures mic audio → Deepgram (diarize + punctuate) → transcript lines.
 * Start on call connect, stop on disconnect. Caller saves lines every 5s.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useFronterDeepgram() {
  const [lines, setLines] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const linesRef = useRef([]);

  const start = useCallback(async (micDeviceId) => {
    try {
      linesRef.current = [];
      setLines([]);

      // Get Deepgram token
      const tokenRes = await base44.functions.invoke('deepgramToken', {});
      const token = tokenRes?.data?.key || tokenRes?.key;
      if (!token) throw new Error('No Deepgram token');

      // Get mic stream
      const constraints = { audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Audio processing at 16kHz mono
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Open Deepgram WebSocket with diarization
      const params = new URLSearchParams({
        model: 'nova-3',
        diarize: 'true',
        punctuate: 'true',
        smart_format: 'true',
        interim_results: 'false',
      });
      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['token', token]);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        source.connect(processor);
        processor.connect(audioCtx.destination);
        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const data = e.inputBuffer.getChannelData(0);
            const pcm = new Int16Array(data.length);
            for (let i = 0; i < data.length; i++) {
              const s = Math.max(-1, Math.min(1, data[i]));
              pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            if (ws.readyState === WebSocket.OPEN) ws.send(pcm.buffer);
          }
        };
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'Results' && data.channel?.alternatives?.[0]) {
            const alt = data.channel.alternatives[0];
            const transcript = alt.transcript;
            if (transcript && transcript.trim()) {
              const speaker = alt.words?.[0]?.speaker ?? 0;
              const line = { speaker, text: transcript.trim(), time: new Date().toISOString() };
              linesRef.current = [...linesRef.current, line];
              setLines([...linesRef.current]);
            }
          }
        } catch {}
      };

      ws.onclose = () => setConnected(false);
      ws.onerror = () => setConnected(false);
    } catch (e) {
      console.error('Deepgram start failed:', e);
    }
  }, []);

  const stop = useCallback(() => {
    if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch {} processorRef.current = null; }
    setConnected(false);
  }, []);

  const getLines = useCallback(() => linesRef.current, []);
  const clear = useCallback(() => { linesRef.current = []; setLines([]); }, []);

  useEffect(() => () => stop(), [stop]);

  return { lines, connected, start, stop, getLines, clear };
}