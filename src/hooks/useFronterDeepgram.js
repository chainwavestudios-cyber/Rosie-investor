/**
 * useFronterDeepgram.js — Live transcription hook for fronter calls.
 * Transcribes TWO audio sources separately so speakers are always correct:
 *   - fronter mic        → speaker 0 (agent)
 *   - Twilio remote leg  → speaker 1 (customer)
 * Start on call connect, stop on disconnect. Caller saves lines every 5s.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useFronterDeepgram() {
  const [lines, setLines] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketsRef = useRef([]);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const nodesRef = useRef([]);
  const linesRef = useRef([]);

  // Pipe one MediaStream into its own Deepgram socket, tagging every line with `speaker`
  const openSource = (audioCtx, stream, token, speaker) => {
    const source = audioCtx.createMediaStreamSource(stream);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    // Silent gain node — processor must reach a destination to fire, without playing audio
    const silentGain = audioCtx.createGain();
    silentGain.gain.value = 0;
    nodesRef.current.push(source, processor, silentGain);

    const params = new URLSearchParams({
      model: 'nova-3',
      punctuate: 'true',
      smart_format: 'true',
      encoding: 'linear16',
      sample_rate: String(audioCtx.sampleRate),
      channels: '1',
    });
    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['token', token]);
    socketsRef.current.push(ws);

    ws.onopen = () => {
      setConnected(true);
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioCtx.destination);
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const data = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(data.length);
        for (let i = 0; i < data.length; i++) {
          const s = Math.max(-1, Math.min(1, data[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        ws.send(pcm.buffer);
      };
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'Results' && data.is_final) {
          const text = data.channel?.alternatives?.[0]?.transcript?.trim();
          if (text) {
            linesRef.current = [...linesRef.current, { speaker, text, time: new Date().toISOString() }];
            setLines([...linesRef.current]);
          }
        }
      } catch {}
    };
  };

  const start = useCallback(async (micDeviceId, remoteStream) => {
    try {
      linesRef.current = [];
      setLines([]);

      const tokenRes = await base44.functions.invoke('deepgramToken', {});
      const token = tokenRes?.data?.key || tokenRes?.key;
      if (!token) throw new Error('No Deepgram token');

      const constraints = { audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true };
      const micStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = micStream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      openSource(audioCtx, micStream, token, 0);
      if (remoteStream) openSource(audioCtx, remoteStream, token, 1);
      else console.warn('Fronter transcription: no remote call audio — customer will not be transcribed');
    } catch (e) {
      console.error('Deepgram start failed:', e);
    }
  }, []);

  const stop = useCallback(() => {
    socketsRef.current.forEach(ws => { try { ws.close(); } catch {} });
    socketsRef.current = [];
    nodesRef.current.forEach(n => { try { n.disconnect(); } catch {} });
    nodesRef.current = [];
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
    setConnected(false);
  }, []);

  const getLines = useCallback(() => linesRef.current, []);
  const clear = useCallback(() => { linesRef.current = []; setLines([]); }, []);

  useEffect(() => () => stop(), [stop]);

  return { lines, connected, start, stop, getLines, clear };
}