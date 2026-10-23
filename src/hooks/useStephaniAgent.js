/**
 * useStephaniAgent — the live call loop for the agent-driven avatar.
 *
 * The avatar only renders the face. This hook does the rest: the visitor's microphone is
 * transcribed live, every finished sentence goes to our own backend for a reply grounded
 * in the knowledge base, and that reply is spoken by our voice and streamed to the avatar
 * as raw audio. Talking over her stops her mid-sentence (barge-in).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { WebAudioPcmSource } from 'protoface-client';

const SAMPLE_RATE = 16000;
const PCM_CHUNK_BYTES = 3200; // 100 ms of 16 kHz mono audio
const CHUNK_PAUSE_MS = 80;
const TRANSCRIBE_MODEL = 'nova-2';

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function words(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

/**
 * Her own voice reaches the microphone, so a line that mostly repeats what she just said
 * is echo, not the visitor talking over her.
 */
function isEcho(utterance, lastAgentLine) {
  const spoken = words(lastAgentLine);
  if (spoken.length < 3) return false;
  const heard = new Set(words(utterance));
  if (heard.size < 2) return false;
  let hits = 0;
  for (const word of spoken) if (heard.has(word)) hits += 1;
  return hits / spoken.length > 0.6;
}

export default function useStephaniAgent({
  client,
  clientStatus,
  sessionToken,
  room,
  opening,
  enabled = false,
  speakLocally = false,
  onLine,
  onStatus,
  onEnded,
}) {
  const [error, setError] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);

  const callbacksRef = useRef({ onLine, onStatus, onEnded });
  callbacksRef.current = { onLine, onStatus, onEnded };
  const clientRef = useRef(client);
  clientRef.current = client;
  const roomRef = useRef(room);
  roomRef.current = room;

  const startedRef = useRef(false);
  const closingRef = useRef(false);
  const speakTicketRef = useRef(0);
  const speakingRef = useRef(false);
  const mutedRef = useRef(false);
  const historyRef = useRef([]);
  const lastLineRef = useRef('');
  const socketRef = useRef(null);
  const stopMicRef = useRef(null);
  const streamRef = useRef(null);
  const playbackRef = useRef({ ctx: null, node: null });
  const speakLocallyRef = useRef(speakLocally);
  speakLocallyRef.current = speakLocally;

  const stopPlayback = () => {
    try {
      playbackRef.current.node?.stop();
    } catch {
      /* already finished */
    }
    playbackRef.current.node = null;
  };

  /** When the avatar's room does not carry her voice back, play the line we just sent. */
  const playHere = (bytes, sampleRate) => {
    if (!speakLocallyRef.current) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!playbackRef.current.ctx) playbackRef.current.ctx = new Ctx({ sampleRate });
      const ctx = playbackRef.current.ctx;
      const frames = Math.floor(bytes.length / 2);
      if (!frames) return;
      const buffer = ctx.createBuffer(1, frames, sampleRate || SAMPLE_RATE);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < frames; i += 1) {
        const value = (bytes[i * 2 + 1] << 8) | bytes[i * 2];
        channel[i] = (value >= 0x8000 ? value - 0x10000 : value) / 32768;
      }
      stopPlayback();
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(ctx.destination);
      node.start();
      playbackRef.current.node = node;
    } catch {
      /* her voice is still on its way to the avatar */
    }
  };

  const connect = useCallback(async () => {
    const activeClient = clientRef.current;
    if (!roomRef.current || !activeClient) return;

    const speakLine = async (text) => {
      const line = String(text || '').trim();
      if (!line) return;
      const ticket = speakTicketRef.current + 1;
      speakTicketRef.current = ticket;
      lastLineRef.current = line;
      speakingRef.current = true;
      setSpeaking(true);
      try {
        const res = await base44.functions.invoke('stephaniAgent', { action: 'speak', sessionToken, text: line });
        const audio = res?.data?.audio;
        if (!audio || ticket !== speakTicketRef.current) return;
        const bytes = base64ToBytes(audio);
        playHere(bytes, res?.data?.sampleRate || SAMPLE_RATE);
        for (let offset = 0; offset < bytes.length; offset += PCM_CHUNK_BYTES) {
          if (ticket !== speakTicketRef.current) return;
          await clientRef.current.sendAudioData(bytes.subarray(offset, offset + PCM_CHUNK_BYTES));
          await new Promise((resolve) => setTimeout(resolve, CHUNK_PAUSE_MS));
        }
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || 'Her voice dropped out.');
      } finally {
        if (ticket === speakTicketRef.current) {
          speakingRef.current = false;
          setSpeaking(false);
        }
      }
    };

    const interrupt = async () => {
      if (!speakingRef.current) return;
      speakTicketRef.current += 1;
      speakingRef.current = false;
      setSpeaking(false);
      stopPlayback();
      try {
        await clientRef.current.clearBuffer();
      } catch {
        /* nothing was buffered */
      }
    };

    const answer = async (text) => {
      historyRef.current.push({ role: 'user', text });
      callbacksRef.current.onLine?.({ role: 'user', text });
      try {
        const res = await base44.functions.invoke('stephaniAgent', {
          action: 'reply',
          sessionToken,
          text,
          history: historyRef.current.slice(-10),
        });
        const say = String(res?.data?.say || '').trim();
        if (!say) return;
        historyRef.current.push({ role: 'agent', text: say });
        callbacksRef.current.onLine?.({ role: 'agent', text: say });
        await speakLine(say);
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || 'She did not catch that.');
      }
    };

    try {
      callbacksRef.current.onStatus?.('requesting_device_access');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const keyRes = await base44.functions.invoke('deepgramToken', {});
      const key = String(keyRes?.data?.key || '');
      if (!key) throw new Error('Live transcription is unavailable right now.');

      const params = new URLSearchParams({
        model: TRANSCRIBE_MODEL,
        language: 'en-US',
        encoding: 'linear16',
        sample_rate: String(SAMPLE_RATE),
        channels: '1',
        interim_results: 'true',
        endpointing: '500',
        punctuate: 'true',
        smart_format: 'true',
      });
      const socket = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['token', key]);
      socket.binaryType = 'arraybuffer';
      socketRef.current = socket;

      const queue = [];
      socket.onopen = () => {
        while (queue.length) socket.send(queue.shift());
      };
      socket.onmessage = (event) => {
        let message = null;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        const transcript = String(message?.channel?.alternatives?.[0]?.transcript || '').trim();
        if (!transcript) return;
        if (message?.is_final === true) {
          if (closingRef.current || isEcho(transcript, lastLineRef.current)) return;
          void answer(transcript);
        } else if (speakingRef.current) {
          void interrupt();
        }
      };
      socket.onerror = () => setError('Live transcription dropped out.');

      const source = new WebAudioPcmSource({ sampleRate: SAMPLE_RATE, chunkSize: 2048 });
      const micTrack = stream.getAudioTracks()[0];
      if (!micTrack) throw new Error('No microphone was available.');
      stopMicRef.current = await source.listenToMediaStreamTrack(micTrack, (chunk) => {
        if (mutedRef.current) return;
        if (socket.readyState === WebSocket.OPEN) socket.send(chunk);
        else if (socket.readyState === WebSocket.CONNECTING) queue.push(chunk);
      });

      callbacksRef.current.onStatus?.('live');

      const opener = String(opening || '').trim();
      if (opener) {
        historyRef.current.push({ role: 'agent', text: opener });
        callbacksRef.current.onLine?.({ role: 'agent', text: opener });
        await speakLine(opener);
      }
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || 'The call could not open.';
      setError(detail);
      callbacksRef.current.onStatus?.('failed');
    }
  }, [sessionToken, opening]);

  useEffect(() => {
    if (!enabled || !room || clientStatus !== 'started' || startedRef.current) return;
    startedRef.current = true;
    void connect();
  }, [enabled, room, clientStatus, connect]);

  const end = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    speakTicketRef.current += 1;
    speakingRef.current = false;
    setSpeaking(false);
    stopPlayback();
    try {
      socketRef.current?.close();
    } catch {
      /* already closed */
    }
    try {
      stopMicRef.current?.();
    } catch {
      /* already stopped */
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    socketRef.current = null;
    stopMicRef.current = null;
    streamRef.current = null;
    try {
      await clientRef.current.stop();
    } catch {
      /* the room was already leaving */
    }
    callbacksRef.current.onStatus?.('ended');
    callbacksRef.current.onEnded?.();
  }, []);

  useEffect(
    () => () => {
      void end();
    },
    [end],
  );

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  }, []);

  return { error, speaking, muted, toggleMute, end };
}