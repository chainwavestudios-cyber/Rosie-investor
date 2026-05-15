/**
 * VoiceFXPanel — Admin-only real-time voice processing
 *
 * What was wrong before and what's fixed:
 *  ❌ createScriptProcessor (deprecated, main JS thread → choppy)
 *  ✅ AudioWorklet (dedicated audio thread, smooth, low latency)
 *
 *  ❌ Broken pitch: read from same buffer, phase reset glitches
 *  ✅ Dual read-head overlap-add with sine crossfade — no artifacts
 *
 *  ❌ Reverb on presets → mic picks it up → echo feedback loop
 *  ✅ Reverb removed entirely from all live presets
 *
 *  ❌ EQ levels too aggressive, 7+ filters stacking = phase smear
 *  ✅ Broadcast-standard levels, minimal well-chosen filters
 *
 *  ❌ Hard distortion waveshaper → aliasing at high amounts
 *  ✅ Soft tanh-like saturation curve, max +20 = gentle grit
 *
 *  ❌ High-pass at 100Hz cut male chest resonance
 *  ✅ High-pass at 80Hz, keeps full male vocal range
 *
 *  ❌ Compression 6:1 ratio → crushed, unnatural
 *  ✅ 2:1–3:1 max, broadcast-standard 10ms attack / 80ms release
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePortalAuth } from '@/lib/PortalAuthContext';

const GOLD = '#b8933a';
const ADMIN_USERS = ['admin', 'steph'];

// ── AudioWorklet code — inlined as Blob, no separate file needed ─────────────
// Dual read-head pitch shifter with sine-window crossfade.
// Runs on audio rendering thread. Zero main-thread blocking.
const PITCH_WORKLET_CODE = `
class PitchShifterProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.pitchRatio = options.processorOptions?.pitchRatio ?? 1.0;
    this.BUF = 4096;
    this.buf = new Float32Array(this.BUF);
    this.writePos = 0;
    this.r1 = 0;
    this.r2 = this.BUF >> 1;
    this.cf = 0;
    this.port.onmessage = (e) => {
      if (e.data.type === 'setPitch') this.pitchRatio = e.data.ratio;
    };
  }
  process(inputs, outputs) {
    const inp = inputs[0]?.[0];
    const out = outputs[0]?.[0];
    if (!inp || !out) return true;
    const B = this.BUF, H = B >> 1;
    for (let i = 0; i < inp.length; i++) {
      this.buf[this.writePos & (B - 1)] = inp[i];
      this.writePos++;
      const f1 = this.r1 - Math.floor(this.r1);
      const i1a = Math.floor(this.r1) & (B-1), i1b = (i1a+1) & (B-1);
      const s1 = this.buf[i1a] * (1-f1) + this.buf[i1b] * f1;
      const f2 = this.r2 - Math.floor(this.r2);
      const i2a = Math.floor(this.r2) & (B-1), i2b = (i2a+1) & (B-1);
      const s2 = this.buf[i2a] * (1-f2) + this.buf[i2b] * f2;
      const t = this.cf / H;
      out[i] = s1 * Math.cos(t * Math.PI * 0.5) + s2 * Math.sin(t * Math.PI * 0.5);
      this.r1 += this.pitchRatio;
      this.r2 += this.pitchRatio;
      if (++this.cf >= H) {
        this.cf = 0;
        this.r1 = this.r2;
        this.r2 = this.r1 + H;
      }
      if (this.r1 >= B) this.r1 -= B;
      if (this.r2 >= B) this.r2 -= B;
    }
    return true;
  }
}
registerProcessor('pitch-shifter', PitchShifterProcessor);
`;

const storageKey = (u) => `voicefx_v2_${u}`;

export const DEFAULT_FX = {
  pitchSemitones: 0,    // 0 to -8 (keep pitch going down only for realism)
  bassBoost:      0,    // 0–8 dB low shelf @150Hz
  warmth:         0,    // 0–6 dB peaking @350Hz
  mudCut:         0,    // 0–4 dB cut @500Hz
  presence:       0,    // 0–5 dB peaking @3kHz
  trebleCut:      0,    // 0–10 dB high shelf cut @6kHz
  saturation:     0,    // 0–20 (soft harmonic saturation)
  compression:    0,    // 0–10
};

export const PRESETS = [
  {
    id: 'bypass',
    name: '🎙 Natural — Off',
    description: 'No processing. Clean signal.',
    fx: { ...DEFAULT_FX },
  },
  {
    id: 'subtle',
    name: '🌀 Subtle Shift',
    description: 'Barely noticeable — just slightly different',
    fx: { pitchSemitones: -1, bassBoost: 2, warmth: 1, mudCut: 1, presence: 1, trebleCut: 0, saturation: 0, compression: 2 },
  },
  {
    id: 'deeper',
    name: '🎤 Deeper Authority',
    description: 'Slightly lower, more chest — seasoned and confident',
    fx: { pitchSemitones: -2, bassBoost: 4, warmth: 3, mudCut: 2, presence: 2, trebleCut: 2, saturation: 2, compression: 4 },
  },
  {
    id: 'calm_mentor',
    name: '🧑‍🏫 Calm Mentor',
    description: 'Warm and measured — trusted advisor in their 50s',
    fx: { pitchSemitones: -1.5, bassBoost: 3, warmth: 4, mudCut: 2, presence: 2, trebleCut: 3, saturation: 1, compression: 3 },
  },
  {
    id: 'radio',
    name: '📻 Radio Professional',
    description: 'Broadcast-polished — warm, clear, trustworthy',
    fx: { pitchSemitones: -1, bassBoost: 2, warmth: 2, mudCut: 3, presence: 3, trebleCut: 1, saturation: 0, compression: 6 },
  },
  {
    id: 'older_male',
    name: '👴 Older Male (55–65)',
    description: 'Lower pitch, rolled-off highs — seasoned executive',
    fx: { pitchSemitones: -3, bassBoost: 5, warmth: 4, mudCut: 2, presence: 1, trebleCut: 7, saturation: 3, compression: 4 },
  },
  {
    id: 'phone_exec',
    name: '📞 Phone Executive',
    description: 'Cuts muddiness, adds presence — optimized for calls',
    fx: { pitchSemitones: -2, bassBoost: 1, warmth: 2, mudCut: 3, presence: 4, trebleCut: 0, saturation: 0, compression: 6 },
  },
  {
    id: 'senior_exec',
    name: '💼 Senior Executive',
    description: 'Deep, commanding — boardroom presence',
    fx: { pitchSemitones: -4, bassBoost: 6, warmth: 4, mudCut: 2, presence: 1, trebleCut: 6, saturation: 4, compression: 5 },
  },
  {
    id: 'veteran',
    name: '🪨 Weathered Veteran',
    description: 'Rough, world-weary — someone who has seen it all',
    fx: { pitchSemitones: -3.5, bassBoost: 5, warmth: 4, mudCut: 1, presence: 0, trebleCut: 8, saturation: 12, compression: 4 },
  },
  {
    id: 'closer',
    name: '💰 Confident Closer',
    description: 'Punchy, present, persuasive — optimized for sales',
    fx: { pitchSemitones: -1.5, bassBoost: 2, warmth: 2, mudCut: 3, presence: 4, trebleCut: 1, saturation: 0, compression: 6 },
  },
  {
    id: 'gravel',
    name: '🔥 Gravel & Grit',
    description: 'Deep and rough — distinctive older male character',
    fx: { pitchSemitones: -5, bassBoost: 7, warmth: 4, mudCut: 1, presence: 0, trebleCut: 9, saturation: 18, compression: 5 },
  },
];

// ── Build native Web Audio processing chain ───────────────────────────────────
function buildEQChain(ctx, fx) {
  const nodes = [];

  // 1. High-pass @ 80Hz — removes rumble, keeps full male chest resonance
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 80;
  hp.Q.value = 0.5;
  nodes.push(hp);

  // 2. Bass low shelf @ 150Hz (broadcast standard, max +8dB)
  const bass = ctx.createBiquadFilter();
  bass.type = 'lowshelf';
  bass.frequency.value = 150;
  bass.gain.value = Math.min(fx.bassBoost, 8);
  nodes.push(bass);

  // 3. Warmth peak @ 350Hz — body and fullness
  if (fx.warmth > 0) {
    const warmth = ctx.createBiquadFilter();
    warmth.type = 'peaking';
    warmth.frequency.value = 350;
    warmth.Q.value = 0.9;
    warmth.gain.value = Math.min(fx.warmth, 6);
    nodes.push(warmth);
  }

  // 4. Mud cut @ 500Hz — removes boxiness (always cut, never boost)
  if (fx.mudCut > 0) {
    const mud = ctx.createBiquadFilter();
    mud.type = 'peaking';
    mud.frequency.value = 500;
    mud.Q.value = 1.2;
    mud.gain.value = -Math.min(fx.mudCut, 4);
    nodes.push(mud);
  }

  // 5. Presence peak @ 3kHz — intelligibility on calls
  if (fx.presence > 0) {
    const pres = ctx.createBiquadFilter();
    pres.type = 'peaking';
    pres.frequency.value = 3000;
    pres.Q.value = 1.0;
    pres.gain.value = Math.min(fx.presence, 5);
    nodes.push(pres);
  }

  // 6. Treble high shelf cut @ 6kHz — age/warmth effect
  if (fx.trebleCut > 0) {
    const treble = ctx.createBiquadFilter();
    treble.type = 'highshelf';
    treble.frequency.value = 6000;
    treble.gain.value = -Math.min(fx.trebleCut, 10);
    nodes.push(treble);
  }

  // 7. Soft saturation (tanh-like) — harmonic grit, no aliasing
  if (fx.saturation > 0) {
    const ws = ctx.createWaveShaper();
    const k = Math.min(fx.saturation, 20) / 20;
    const N = 512;
    const curve = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = (i * 2) / N - 1;
      // tanh soft-clip: x / (1 + k*|x|) — preserves dynamics, adds harmonics
      curve[i] = x / (1 + k * 2 * Math.abs(x));
    }
    ws.curve = curve;
    ws.oversample = '2x'; // halves aliasing
    nodes.push(ws);
  }

  // 8. Compressor — voice-grade settings (never crushing)
  if (fx.compression > 0) {
    const comp = ctx.createDynamicsCompressor();
    const a = fx.compression / 10;
    comp.threshold.value = -18;
    comp.knee.value = 6;
    comp.ratio.value = 1.5 + a * 1.5; // 1.5:1 to 3:1
    comp.attack.value = 0.010;         // 10ms
    comp.release.value = 0.080;        // 80ms
    nodes.push(comp);
  }

  // Connect chain
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return { firstNode: nodes[0], lastNode: nodes[nodes.length - 1] };
}

let workletLoadedFor = null;
async function ensureWorklet(ctx) {
  if (workletLoadedFor === ctx) return;
  const blob = new Blob([PITCH_WORKLET_CODE], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    await ctx.audioWorklet.addModule(url);
    workletLoadedFor = ctx;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ── Slider ────────────────────────────────────────────────────────────────────
function FXSlider({ label, value, min, max, step = 0.5, unit = '', onChange, color = GOLD, tooltip, reversed = false }) {
  const pct = reversed
    ? (1 - (value - min) / (max - min)) * 100
    : ((value - min) / (max - min)) * 100;
  const off = value === 0;
  const display = (value > 0 && !reversed ? '+' : '') + (typeof value === 'number' ? value.toFixed(1) : value) + unit;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ color: '#8a9ab8', fontSize: '11px' }} title={tooltip}>{label}</span>
        <span style={{ color: off ? '#374151' : color, fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', minWidth: '44px', textAlign: 'right' }}>{display}</span>
      </div>
      <div style={{ position: 'relative', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: off ? 'rgba(255,255,255,0.08)' : `linear-gradient(90deg,${color}55,${color})`, borderRadius: '3px', pointerEvents: 'none' }} />
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', margin: 0, padding: 0 }} />
        <div style={{ position: 'absolute', top: '50%', left: `${pct}%`, transform: 'translate(-50%,-50%)', width: '13px', height: '13px', borderRadius: '50%', background: off ? '#1a2035' : color, border: `2px solid ${off ? '#2d3748' : color}`, boxShadow: off ? 'none' : `0 0 6px ${color}99`, pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function VoiceFXPanel({ onClose }) {
  const { portalUser } = usePortalAuth();
  const username = portalUser?.username || 'admin';
  const isAdmin = ADMIN_USERS.includes(username);

  const [fx, setFx] = useState(() => {
    try { const s = localStorage.getItem(storageKey(username)); if (s) return { ...DEFAULT_FX, ...JSON.parse(s) }; } catch {}
    return { ...DEFAULT_FX };
  });

  const [activePreset, setActivePreset]     = useState('bypass');
  const [micDevices, setMicDevices]         = useState([]);
  const [selectedMic, setSelectedMic]       = useState('');
  const [isRecording, setIsRecording]       = useState(false);
  const [recTime, setRecTime]               = useState(0);
  const [recBlob, setRecBlob]               = useState(null);
  const [isPlaying, setIsPlaying]           = useState(false);
  const [status, setStatus]                 = useState('');
  const [workletOk, setWorkletOk]           = useState(true);

  const audioCtxRef  = useRef(null);
  const streamRef    = useRef(null);
  const recorderRef  = useRef(null);
  const chunksRef    = useRef([]);
  const timerRef     = useRef(null);
  const audioElRef   = useRef(null);

  useEffect(() => {
    setWorkletOk(typeof AudioWorklet !== 'undefined');
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => navigator.mediaDevices.enumerateDevices())
      .then(devs => {
        const mics = devs.filter(d => d.kind === 'audioinput');
        setMicDevices(mics);
        if (mics.length) setSelectedMic(mics[0].deviceId);
      }).catch(() => {});
    return () => cleanup();
  }, []);

  useEffect(() => {
    try { localStorage.setItem(storageKey(username), JSON.stringify(fx)); } catch {}
  }, [fx]);

  const updateFx = useCallback((key, val) => {
    setFx(prev => ({ ...prev, [key]: val }));
    setActivePreset('custom');
  }, []);

  const applyPreset = (p) => { setFx({ ...p.fx }); setActivePreset(p.id); };
  const resetAll    = () => { setFx({ ...DEFAULT_FX }); setActivePreset('bypass'); };

  const cleanup = () => {
    clearInterval(timerRef.current);
    try { recorderRef.current?.state === 'recording' && recorderRef.current.stop(); } catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
    streamRef.current = null;
    setIsRecording(false);
    setRecTime(0);
  };

  const startRecording = async () => {
    setStatus('');
    setRecBlob(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedMic ? { exact: selectedMic } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 44100,
        }
      });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 44100, latencyHint: 'interactive' });
      audioCtxRef.current = ctx;
      await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const dest   = ctx.createMediaStreamDestination();
      const { firstNode, lastNode } = buildEQChain(ctx, fx);

      let chainStart = source;

      if (fx.pitchSemitones !== 0 && workletOk) {
        try {
          await ensureWorklet(ctx);
          const ratio = Math.pow(2, fx.pitchSemitones / 12);
          const pitchNode = new AudioWorkletNode(ctx, 'pitch-shifter', {
            processorOptions: { pitchRatio: ratio }
          });
          source.connect(pitchNode);
          pitchNode.connect(firstNode);
          chainStart = null; // already connected
        } catch (e) {
          console.warn('Worklet failed, skipping pitch:', e.message);
          source.connect(firstNode);
        }
      } else {
        source.connect(firstNode);
      }

      lastNode.connect(dest);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(dest.stream, { mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecBlob(blob);
        setStatus('✓ Done — press Play to hear your processed voice');
      };
      recorder.start(50);
      setIsRecording(true);
      setRecTime(0);
      timerRef.current = setInterval(() => {
        setRecTime(t => { if (t >= 29) { cleanup(); return t; } return t + 1; });
      }, 1000);
    } catch (e) {
      setStatus('⚠ Mic error: ' + e.message);
    }
  };

  const playBack = () => {
    if (!recBlob) return;
    if (isPlaying) { audioElRef.current?.pause(); setIsPlaying(false); return; }
    const audio = new Audio(URL.createObjectURL(recBlob));
    audioElRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
  };

  if (!isAdmin) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, fontFamily: 'Georgia,serif' }}>
      <div style={{ background: '#0a0f1e', border: `1px solid ${GOLD}44`, borderRadius: '8px', padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
        <div style={{ color: '#6b7280' }}>Voice FX is admin-only.</div>
        <button onClick={onClose} style={{ marginTop: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280', borderRadius: '4px', padding: '8px 20px', cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  );

  const isBypass = Object.values(fx).every(v => v === 0);
  const activeCount = Object.values(fx).filter(v => v !== 0).length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '16px', fontFamily: 'Georgia,serif' }}>
      <div style={{ background: '#0a0f1e', border: `1px solid ${GOLD}55`, borderRadius: '10px', width: '100%', maxWidth: '820px', maxHeight: '94vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 80px rgba(184,147,58,0.1), 0 40px 100px rgba(0,0,0,0.9)' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.3)', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>🎙 Voice FX Studio</span>
              {!isBypass && <span style={{ background: 'rgba(184,147,58,0.12)', border: `1px solid ${GOLD}44`, borderRadius: '20px', padding: '2px 10px', color: GOLD, fontSize: '10px' }}>{activeCount} active</span>}
            </div>
            <div style={{ color: '#374151', fontSize: '10px', marginTop: '2px' }}>
              Admin only · {username} · Settings auto-saved per user
              {!workletOk && <span style={{ color: '#f59e0b', marginLeft: '8px' }}>⚠ Use Chrome/Edge for pitch shift (AudioWorklet required)</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={resetAll} style={{ background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>↺ Reset</button>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', cursor: 'pointer', fontSize: '18px', width: '32px', height: '32px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Presets */}
          <div>
            <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Quick Presets</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: '6px' }}>
              {PRESETS.map(p => {
                const active = activePreset === p.id;
                return (
                  <button key={p.id} onClick={() => applyPreset(p)} style={{ background: active ? 'rgba(184,147,58,0.1)' : 'rgba(255,255,255,0.02)', border: `1px solid ${active ? GOLD + '77' : 'rgba(255,255,255,0.06)'}`, borderRadius: '6px', padding: '9px 11px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
                    <div style={{ color: active ? GOLD : '#c4cdd8', fontSize: '11px', fontWeight: active ? 'bold' : 'normal', marginBottom: '2px' }}>{p.name}</div>
                    <div style={{ color: '#374151', fontSize: '9px', lineHeight: 1.4 }}>{p.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders — 2 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 36px' }}>

            {/* Left */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Pitch */}
              <div>
                <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '5px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  PITCH SHIFT {!workletOk && <span style={{ color: '#f59e0b', fontSize: '8px' }}>— Chrome/Edge only</span>}
                </div>
                <FXSlider
                  label="Pitch Shift (semitones)"
                  value={fx.pitchSemitones} min={-8} max={0} step={0.5} unit=" st"
                  onChange={v => updateFx('pitchSemitones', v)} color="#60a5fa" reversed
                  tooltip="-1 to -2 = subtle deeper. -3 to -4 = noticeably older. -5 to -6 = very different. Keep above -6 for natural results."
                />
                <div style={{ color: '#2d3748', fontSize: '9px', marginTop: '5px', lineHeight: 1.5 }}>
                  AudioWorklet dual read-head algorithm — runs on audio thread. No choppiness.
                </div>
              </div>

              {/* Low EQ */}
              <div>
                <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '5px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>EQ — LOW END</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <FXSlider label="Bass Boost (150Hz shelf)" value={fx.bassBoost} min={0} max={8} step={0.5} unit=" dB"
                    onChange={v => updateFx('bassBoost', v)} color={GOLD}
                    tooltip="Low shelf at 150Hz. Adds chest and weight. +4 = noticeable, +8 = max safe. Beyond that sounds boomy." />
                  <FXSlider label="Warmth / Body (350Hz)" value={fx.warmth} min={0} max={6} step={0.5} unit=" dB"
                    onChange={v => updateFx('warmth', v)} color="#f59e0b"
                    tooltip="Peaking at 350Hz. Adds body and age. Keep under +5dB — combine with mud cut to avoid boxiness." />
                  <FXSlider label="Mud Cut (500Hz)" value={fx.mudCut} min={0} max={4} step={0.5} unit=" dB"
                    onChange={v => updateFx('mudCut', v)} color="#4ade80"
                    tooltip="Cuts 500Hz boxiness. Use with bass boost to keep warmth without muddiness. +2 is usually enough." />
                </div>
              </div>
            </div>

            {/* Right */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* High EQ */}
              <div>
                <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '5px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>EQ — HIGH END</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <FXSlider label="Presence (3kHz)" value={fx.presence} min={0} max={5} step={0.5} unit=" dB"
                    onChange={v => updateFx('presence', v)} color="#22d3ee"
                    tooltip="Peaking at 3kHz — adds intelligibility and cut-through on phone calls. +2 to +3 is broadcast standard." />
                  <FXSlider label="Treble Rolloff (6kHz+)" value={fx.trebleCut} min={0} max={10} step={0.5} unit=" dB"
                    onChange={v => updateFx('trebleCut', v)} color="#f87171" reversed
                    tooltip="High shelf cut above 6kHz. Rolling off highs makes voice sound older and warmer. +4 subtle, +8 noticeably aged." />
                </div>
              </div>

              {/* Dynamics */}
              <div>
                <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '5px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>DYNAMICS & TEXTURE</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <FXSlider label="Saturation / Grit" value={fx.saturation} min={0} max={20} step={1}
                    onChange={v => updateFx('saturation', v)} color="#fb923c"
                    tooltip="Soft tanh saturation — adds harmonic texture without aliasing. 5=subtle grit, 10=gravelly, 18=rough. Not distortion." />
                  <FXSlider label="Compression" value={fx.compression} min={0} max={10} step={0.5}
                    onChange={v => updateFx('compression', v)} color="#34d399"
                    tooltip="2:1 to 3:1 ratio, -18dB threshold, 10ms attack, 80ms release. Broadcast-standard. 4=polished, 8=very compressed." />
                </div>
                <div style={{ marginTop: '10px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#6b7280', fontSize: '9px', lineHeight: 1.6 }}>
                  ⚠ <strong style={{ color: '#ef4444' }}>No reverb on live calls.</strong> Any reverb processed through your mic creates an echo feedback loop through the phone line. Reverb has been removed from all presets.
                </div>
              </div>
            </div>
          </div>

          {/* Test Recording */}
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px 16px' }}>
            <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🧪 Test Your Voice</div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ color: '#4a5568', fontSize: '10px', flexShrink: 0 }}>🎙 Mic:</span>
              <select value={selectedMic} onChange={e => setSelectedMic(e.target.value)}
                style={{ flex: 1, minWidth: '160px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '4px', padding: '6px 9px', color: '#c4cdd8', fontSize: '11px', outline: 'none', cursor: 'pointer' }}>
                {micDevices.length === 0 && <option>Default Microphone</option>}
                {micDevices.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || `Mic ${m.deviceId.slice(0, 8)}`}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={isRecording ? cleanup : startRecording}
                style={{ background: isRecording ? 'rgba(239,68,68,0.12)' : 'rgba(74,222,128,0.1)', color: isRecording ? '#ef4444' : '#4ade80', border: `1px solid ${isRecording ? 'rgba(239,68,68,0.35)' : 'rgba(74,222,128,0.3)'}`, borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '7px' }}>
                {isRecording
                  ? <><span style={{ width: '7px', height: '7px', background: '#ef4444', borderRadius: '1px', animation: 'vfxPulse 0.8s infinite' }} /> Stop ({30 - recTime}s)</>
                  : <><span style={{ width: '7px', height: '7px', background: '#4ade80', borderRadius: '50%' }} /> Record (max 30s)</>}
              </button>
              {recBlob && !isRecording && <>
                <button onClick={playBack} style={{ background: isPlaying ? 'rgba(245,158,11,0.1)' : 'rgba(96,165,250,0.1)', color: isPlaying ? '#f59e0b' : '#60a5fa', border: `1px solid ${isPlaying ? 'rgba(245,158,11,0.3)' : 'rgba(96,165,250,0.3)'}`, borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                  {isPlaying ? '⏹ Stop' : '▶ Play Back'}
                </button>
                <a href={URL.createObjectURL(recBlob)} download="voice_fx_test.webm" style={{ background: 'rgba(255,255,255,0.04)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px 14px', fontSize: '11px', textDecoration: 'none' }}>⬇ Save</a>
              </>}
              {isRecording && (
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div key={i} style={{ width: '3px', borderRadius: '2px', transition: 'height 0.3s', background: i < recTime ? '#ef4444' : 'rgba(255,255,255,0.07)', height: i < recTime ? `${6 + Math.sin(i * 0.9) * 8}px` : '3px' }} />
                  ))}
                </div>
              )}
            </div>
            {status && <div style={{ marginTop: '8px', color: status.startsWith('⚠') ? '#ef4444' : '#4ade80', fontSize: '11px' }}>{status}</div>}
          </div>

          {/* Active effects summary */}
          {!isBypass && (
            <div style={{ background: 'rgba(184,147,58,0.03)', border: '1px solid rgba(184,147,58,0.1)', borderRadius: '6px', padding: '10px 14px' }}>
              <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '7px' }}>Active Effects</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {Object.entries(fx).filter(([, v]) => v !== 0).map(([k, v]) => (
                  <span key={k} style={{ background: 'rgba(184,147,58,0.07)', border: '1px solid rgba(184,147,58,0.15)', borderRadius: '20px', padding: '2px 9px', color: GOLD, fontSize: '10px', fontFamily: 'monospace' }}>
                    {k}: {v > 0 ? '+' : ''}{typeof v === 'number' ? v.toFixed(1) : v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)', borderRadius: '0 0 10px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ color: '#2d3748', fontSize: '10px' }}>
            Preset: <span style={{ color: GOLD }}>{PRESETS.find(p => p.id === activePreset)?.name || 'Custom'}</span>
          </div>
          <button onClick={onClose} style={{ background: `linear-gradient(135deg,${GOLD},#d4aa50)`, color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 22px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>✓ Done</button>
        </div>
      </div>
      <style>{`@keyframes vfxPulse{0%,100%{opacity:1}50%{opacity:0.25}}`}</style>
    </div>
  );
}