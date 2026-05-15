/**
 * VoiceFXPanel — Admin-only real-time voice processing
 * v3 — Major overhaul:
 *
 *  ✅ Natural-sounding presets (no tunnel/robot effect)
 *  ✅ Timbre controls: formant shift, breath texture, air, clarity
 *  ✅ Custom preset creation & saving (named, persistent per user)
 *  ✅ Preset editing & deletion
 *  ✅ 12 factory presets + unlimited custom
 *  ✅ Noise gate to kill background hum between words
 *  ✅ Air / breathiness control (high-shelf presence lift)
 *  ✅ Formant approximation via mid-band resonance shaping
 *  ✅ Mid scoop for natural "smile" EQ curve
 *  ✅ No reverb, echo, or heavy compression ever
 *  ✅ All sliders have natural range limits to prevent robotics
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePortalAuth } from '@/lib/PortalAuthContext';

const GOLD = '#b8933a';
const ADMIN_USERS = ['admin', 'steph'];

// ── AudioWorklet: Pitch Shifter ────────────────────────────────────────────────
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
      if (++this.cf >= H) { this.cf = 0; this.r1 = this.r2; this.r2 = this.r1 + H; }
      if (this.r1 >= B) this.r1 -= B;
      if (this.r2 >= B) this.r2 -= B;
    }
    return true;
  }
}
registerProcessor('pitch-shifter', PitchShifterProcessor);
`;

const storageKey      = (u) => `voicefx_v3_${u}`;
const customPresetsKey = (u) => `voicefx_v3_custom_${u}`;

// ── Default FX — all controls ──────────────────────────────────────────────────
// NEW controls vs v2:
//   noiseGate    — kills hum/breath between words
//   airShelf     — 10kHz air lift (brightness without harshness)
//   midScoop     — 800Hz cut (most natural "smile" EQ)
//   formantShift — 0–6: mild resonance reshape via 1kHz Q filter
//   clarity      — 2.5kHz lift for consonant definition
export const DEFAULT_FX = {
  pitchSemitones: 0,    // 0 to -6 (never below -6 — sounds robotic)
  bassBoost:      0,    // 0–6 dB low shelf @120Hz (was 150 — sounds less boomy)
  warmth:         0,    // 0–5 dB peaking @280Hz (was 350 — avoids nasal box)
  mudCut:         0,    // 0–5 dB cut @500Hz
  midScoop:       0,    // 0–4 dB cut @800Hz (natural "smile" curve)
  clarity:        0,    // 0–4 dB peaking @2.5kHz (consonants, intelligibility)
  presence:       0,    // 0–4 dB peaking @3.5kHz
  airShelf:       0,    // 0–5 dB high shelf @10kHz (openness/air)
  trebleCut:      0,    // 0–8 dB high shelf cut @7kHz (age/warmth effect)
  formantShift:   0,    // 0–6 resonance character (1kHz Q shape)
  saturation:     0,    // 0–12 soft harmonic grit (max lowered — less robot)
  compression:    0,    // 0–8 gentle broadcast compression
  noiseGate:      0,    // 0–8 gate strength (kills hum between words)
};

// ── Factory presets — carefully tuned for naturalness ─────────────────────────
export const FACTORY_PRESETS = [
  {
    id: 'bypass',
    name: '🎙 Natural — Off',
    description: 'No processing. Clean unmodified signal.',
    fx: { ...DEFAULT_FX },
  },
  {
    id: 'broadcast',
    name: '📻 Broadcast Polish',
    description: 'Clean, warm, present — like NPR talent. No gimmicks.',
    fx: { pitchSemitones: 0, bassBoost: 1, warmth: 2, mudCut: 2, midScoop: 2, clarity: 2, presence: 2, airShelf: 1, trebleCut: 0, formantShift: 0, saturation: 0, compression: 4, noiseGate: 2 },
  },
  {
    id: 'subtle_deeper',
    name: '🌀 Subtle Depth',
    description: 'Barely noticeable — adds just a touch of weight and warmth.',
    fx: { pitchSemitones: -1, bassBoost: 2, warmth: 2, mudCut: 1, midScoop: 1, clarity: 1, presence: 1, airShelf: 0, trebleCut: 1, formantShift: 1, saturation: 0, compression: 2, noiseGate: 1 },
  },
  {
    id: 'calm_authority',
    name: '🧑‍💼 Calm Authority',
    description: 'Warm, measured, trustworthy — CFO energy. Not deep, just grounded.',
    fx: { pitchSemitones: -1.5, bassBoost: 3, warmth: 3, mudCut: 2, midScoop: 2, clarity: 2, presence: 1, airShelf: 1, trebleCut: 2, formantShift: 2, saturation: 1, compression: 3, noiseGate: 2 },
  },
  {
    id: 'phone_optimized',
    name: '📞 Phone Optimized',
    description: 'Cuts mud, boosts mids and clarity — cuts through call compression.',
    fx: { pitchSemitones: -1, bassBoost: 0, warmth: 1, mudCut: 3, midScoop: 2, clarity: 3, presence: 3, airShelf: 0, trebleCut: 0, formantShift: 1, saturation: 0, compression: 5, noiseGate: 3 },
  },
  {
    id: 'seasoned_exec',
    name: '💼 Seasoned Executive',
    description: 'Lower, chest-forward, measured — man who has run companies.',
    fx: { pitchSemitones: -2.5, bassBoost: 4, warmth: 3, mudCut: 2, midScoop: 2, clarity: 2, presence: 1, airShelf: 0, trebleCut: 4, formantShift: 3, saturation: 2, compression: 4, noiseGate: 2 },
  },
  {
    id: 'mentor',
    name: '🎓 Trusted Mentor',
    description: 'Soft warmth, clear mids — professor, coach, advisor in their 50s.',
    fx: { pitchSemitones: -1, bassBoost: 2, warmth: 4, mudCut: 2, midScoop: 1, clarity: 1, presence: 1, airShelf: 1, trebleCut: 3, formantShift: 2, saturation: 1, compression: 3, noiseGate: 2 },
  },
  {
    id: 'confident_closer',
    name: '💰 Confident Closer',
    description: 'Punchy, present, forward — conviction in every word.',
    fx: { pitchSemitones: -1, bassBoost: 2, warmth: 2, mudCut: 3, midScoop: 2, clarity: 3, presence: 3, airShelf: 1, trebleCut: 0, formantShift: 1, saturation: 0, compression: 5, noiseGate: 3 },
  },
  {
    id: 'older_male',
    name: '👴 Older Male (60+)',
    description: 'Lower fundamental, rolled-off highs — weathered life experience.',
    fx: { pitchSemitones: -3, bassBoost: 4, warmth: 3, mudCut: 1, midScoop: 2, clarity: 1, presence: 0, airShelf: 0, trebleCut: 6, formantShift: 4, saturation: 3, compression: 3, noiseGate: 2 },
  },
  {
    id: 'gravelly',
    name: '🪨 Gravelly Character',
    description: 'Textured, rough — distinctive voice that people remember.',
    fx: { pitchSemitones: -2.5, bassBoost: 3, warmth: 3, mudCut: 1, midScoop: 1, clarity: 1, presence: 0, airShelf: 0, trebleCut: 6, formantShift: 3, saturation: 8, compression: 3, noiseGate: 2 },
  },
  {
    id: 'airy_natural',
    name: '🌬 Airy & Natural',
    description: 'Open, breathy, present — sounds like a great podcaster.',
    fx: { pitchSemitones: 0, bassBoost: 1, warmth: 1, mudCut: 2, midScoop: 1, clarity: 2, presence: 2, airShelf: 4, trebleCut: 0, formantShift: 0, saturation: 0, compression: 3, noiseGate: 2 },
  },
  {
    id: 'clean_gate',
    name: '🔇 Clean + Gated',
    description: 'No color change — just kills background noise and hum between words.',
    fx: { pitchSemitones: 0, bassBoost: 0, warmth: 0, mudCut: 1, midScoop: 0, clarity: 1, presence: 0, airShelf: 0, trebleCut: 0, formantShift: 0, saturation: 0, compression: 2, noiseGate: 6 },
  },
];

// ── Audio chain builder ────────────────────────────────────────────────────────
function buildEQChain(ctx, fx) {
  const nodes = [];

  // 1. Noise gate — soft downward expander before any EQ
  if (fx.noiseGate > 0) {
    // Emulated via aggressive compression at low levels
    const gate = ctx.createDynamicsCompressor();
    const g = fx.noiseGate / 8;
    gate.threshold.value = -60 + g * 20;  // -60 to -40 dB
    gate.knee.value = 3;
    gate.ratio.value = 4 + g * 8;          // 4:1 to 12:1 (downward expand)
    gate.attack.value = 0.001;
    gate.release.value = 0.100 + g * 0.2;
    nodes.push(gate);
  }

  // 2. High-pass @ 80Hz — keeps male chest, kills rumble
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 80;
  hp.Q.value = 0.5;
  nodes.push(hp);

  // 3. Bass low shelf @ 120Hz (lower freq = tighter, less boomy than 150Hz)
  if (fx.bassBoost > 0) {
    const bass = ctx.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = 120;
    bass.gain.value = Math.min(fx.bassBoost, 6);
    nodes.push(bass);
  }

  // 4. Warmth peak @ 280Hz (lower than v2's 350 — more chest, less nasal box)
  if (fx.warmth > 0) {
    const warmth = ctx.createBiquadFilter();
    warmth.type = 'peaking';
    warmth.frequency.value = 280;
    warmth.Q.value = 0.8;
    warmth.gain.value = Math.min(fx.warmth, 5);
    nodes.push(warmth);
  }

  // 5. Mud cut @ 500Hz
  if (fx.mudCut > 0) {
    const mud = ctx.createBiquadFilter();
    mud.type = 'peaking';
    mud.frequency.value = 500;
    mud.Q.value = 1.0;
    mud.gain.value = -Math.min(fx.mudCut, 5);
    nodes.push(mud);
  }

  // 6. Mid scoop @ 800Hz — natural "smile" EQ, avoids honky/nasal tone
  if (fx.midScoop > 0) {
    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 800;
    mid.Q.value = 1.2;
    mid.gain.value = -Math.min(fx.midScoop, 4);
    nodes.push(mid);
  }

  // 7. Formant character @ 1kHz — resonance shaping
  if (fx.formantShift > 0) {
    const form = ctx.createBiquadFilter();
    form.type = 'peaking';
    form.frequency.value = 1000;
    form.Q.value = 1.5 + (fx.formantShift / 6) * 1.5; // Higher Q = more resonant
    form.gain.value = Math.min(fx.formantShift * 0.6, 3.5);
    nodes.push(form);
  }

  // 8. Clarity @ 2.5kHz — consonant definition, intelligibility
  if (fx.clarity > 0) {
    const clar = ctx.createBiquadFilter();
    clar.type = 'peaking';
    clar.frequency.value = 2500;
    clar.Q.value = 1.0;
    clar.gain.value = Math.min(fx.clarity, 4);
    nodes.push(clar);
  }

  // 9. Presence @ 3.5kHz (slightly higher than v2 — more articulation, less "phone")
  if (fx.presence > 0) {
    const pres = ctx.createBiquadFilter();
    pres.type = 'peaking';
    pres.frequency.value = 3500;
    pres.Q.value = 1.0;
    pres.gain.value = Math.min(fx.presence, 4);
    nodes.push(pres);
  }

  // 10. Air high shelf @ 10kHz (openness / presence lift)
  if (fx.airShelf > 0) {
    const air = ctx.createBiquadFilter();
    air.type = 'highshelf';
    air.frequency.value = 10000;
    air.gain.value = Math.min(fx.airShelf, 5);
    nodes.push(air);
  }

  // 11. Treble rolloff @ 7kHz (age/warmth effect)
  if (fx.trebleCut > 0) {
    const treble = ctx.createBiquadFilter();
    treble.type = 'highshelf';
    treble.frequency.value = 7000;
    treble.gain.value = -Math.min(fx.trebleCut, 8);
    nodes.push(treble);
  }

  // 12. Soft saturation — max reduced to 12 to prevent robotic tone
  if (fx.saturation > 0) {
    const ws = ctx.createWaveShaper();
    const k = Math.min(fx.saturation, 12) / 12;
    const N = 512;
    const curve = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = (i * 2) / N - 1;
      curve[i] = x / (1 + k * 2.5 * Math.abs(x));
    }
    ws.curve = curve;
    ws.oversample = '4x'; // Better alias reduction
    nodes.push(ws);
  }

  // 13. Gentle broadcast compressor
  if (fx.compression > 0) {
    const comp = ctx.createDynamicsCompressor();
    const a = fx.compression / 8;
    comp.threshold.value = -18;
    comp.knee.value = 8;            // Wider knee = softer, more natural
    comp.ratio.value = 1.3 + a * 1.5; // 1.3:1 to 2.8:1 max
    comp.attack.value = 0.015;      // 15ms — avoids pumping
    comp.release.value = 0.100;     // 100ms
    nodes.push(comp);
  }

  // Connect the chain
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

// ── Slider component ───────────────────────────────────────────────────────────
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

// ── Main component ─────────────────────────────────────────────────────────────
export default function VoiceFXPanel({ onClose }) {
  const { portalUser } = usePortalAuth();
  const username = portalUser?.username || 'admin';
  const isAdmin = ADMIN_USERS.includes(username);

  // FX state
  const [fx, setFx] = useState(() => {
    try { const s = localStorage.getItem(storageKey(username)); if (s) return { ...DEFAULT_FX, ...JSON.parse(s) }; } catch {}
    return { ...DEFAULT_FX };
  });

  // Custom presets stored per user
  const [customPresets, setCustomPresets] = useState(() => {
    try { const s = localStorage.getItem(customPresetsKey(username)); if (s) return JSON.parse(s); } catch {}
    return [];
  });

  const [activePreset, setActivePreset]       = useState('bypass');
  const [micDevices, setMicDevices]           = useState([]);
  const [selectedMic, setSelectedMic]         = useState('');
  const [isRecording, setIsRecording]         = useState(false);
  const [recTime, setRecTime]                 = useState(0);
  const [recBlob, setRecBlob]                 = useState(null);
  const [isPlaying, setIsPlaying]             = useState(false);
  const [status, setStatus]                   = useState('');
  const [workletOk, setWorkletOk]             = useState(true);
  const [activeTab, setActiveTab]             = useState('presets'); // 'presets' | 'sliders' | 'custom'

  // Custom preset save dialog
  const [saveDialogOpen, setSaveDialogOpen]   = useState(false);
  const [saveName, setSaveName]               = useState('');
  const [editingCustomId, setEditingCustomId] = useState(null); // null = new, else id to overwrite

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

  // Auto-save fx settings
  useEffect(() => {
    try { localStorage.setItem(storageKey(username), JSON.stringify(fx)); } catch {}
  }, [fx, username]);

  // Auto-save custom presets
  useEffect(() => {
    try { localStorage.setItem(customPresetsKey(username), JSON.stringify(customPresets)); } catch {}
  }, [customPresets, username]);

  const updateFx = useCallback((key, val) => {
    setFx(prev => ({ ...prev, [key]: val }));
    setActivePreset('custom');
  }, []);

  const applyPreset = (p) => {
    setFx({ ...DEFAULT_FX, ...p.fx });
    setActivePreset(p.id);
  };

  const resetAll = () => {
    setFx({ ...DEFAULT_FX });
    setActivePreset('bypass');
  };

  // Save current settings as a custom preset
  const saveCustomPreset = () => {
    if (!saveName.trim()) return;
    const id = editingCustomId || `custom_${Date.now()}`;
    const newPreset = {
      id,
      name: saveName.trim(),
      description: 'Custom preset',
      fx: { ...fx },
      createdAt: new Date().toISOString(),
    };
    setCustomPresets(prev => {
      const filtered = prev.filter(p => p.id !== id);
      return [...filtered, newPreset];
    });
    setActivePreset(id);
    setSaveDialogOpen(false);
    setSaveName('');
    setEditingCustomId(null);
  };

  const updateCustomPreset = (id) => {
    setCustomPresets(prev => prev.map(p => p.id === id ? { ...p, fx: { ...fx } } : p));
    setStatus('✓ Preset updated');
    setTimeout(() => setStatus(''), 2000);
  };

  const deleteCustomPreset = (id) => {
    setCustomPresets(prev => prev.filter(p => p.id !== id));
    if (activePreset === id) { setActivePreset('bypass'); setFx({ ...DEFAULT_FX }); }
  };

  const openSaveDialogForNew = () => {
    setEditingCustomId(null);
    setSaveName('My Preset');
    setSaveDialogOpen(true);
  };

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
          sampleRate: 48000,
        }
      });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
      audioCtxRef.current = ctx;
      await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const dest   = ctx.createMediaStreamDestination();

      const allNodes = buildEQChain(ctx, fx);
      let { firstNode, lastNode } = allNodes;

      if (fx.pitchSemitones !== 0 && workletOk) {
        try {
          await ensureWorklet(ctx);
          const ratio = Math.pow(2, fx.pitchSemitones / 12);
          const pitchNode = new AudioWorkletNode(ctx, 'pitch-shifter', {
            processorOptions: { pitchRatio: ratio }
          });
          source.connect(pitchNode);
          pitchNode.connect(firstNode);
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
  const allPresets = [...FACTORY_PRESETS, ...customPresets];
  const activePresetObj = allPresets.find(p => p.id === activePreset);

  const tabStyle = (tab) => ({
    padding: '6px 14px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: activeTab === tab ? 'bold' : 'normal',
    background: activeTab === tab ? `rgba(184,147,58,0.15)` : 'transparent',
    color: activeTab === tab ? GOLD : '#6b7280',
    letterSpacing: activeTab === tab ? '0.5px' : 'normal',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.90)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '16px', fontFamily: 'Georgia,serif' }}>
      <div style={{ background: '#090d1c', border: `1px solid ${GOLD}44`, borderRadius: '12px', width: '100%', maxWidth: '900px', maxHeight: '96vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 100px rgba(184,147,58,0.08), 0 40px 100px rgba(0,0,0,0.95)' }}>

        {/* ── Header ── */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>🎙 Voice FX Studio</span>
              {!isBypass && <span style={{ background: 'rgba(184,147,58,0.12)', border: `1px solid ${GOLD}44`, borderRadius: '20px', padding: '2px 10px', color: GOLD, fontSize: '10px' }}>{activeCount} active</span>}
            </div>
            <div style={{ color: '#374151', fontSize: '10px', marginTop: '2px' }}>
              Admin only · {username} · Settings auto-saved per user
              {!workletOk && <span style={{ color: '#f59e0b', marginLeft: '8px' }}>⚠ Use Chrome/Edge for pitch shift</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={resetAll} style={{ background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>↺ Reset</button>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', cursor: 'pointer', fontSize: '18px', width: '32px', height: '32px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div style={{ display: 'flex', gap: '4px', padding: '10px 20px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <button style={tabStyle('presets')} onClick={() => setActiveTab('presets')}>Factory Presets</button>
          <button style={tabStyle('sliders')} onClick={() => setActiveTab('sliders')}>FX Controls</button>
          <button style={tabStyle('custom')} onClick={() => setActiveTab('custom')}>
            Custom Presets {customPresets.length > 0 && <span style={{ background: `${GOLD}33`, borderRadius: '10px', padding: '1px 6px', marginLeft: '4px', fontSize: '9px' }}>{customPresets.length}</span>}
          </button>
          <button style={tabStyle('test')} onClick={() => setActiveTab('test')}>Test Voice</button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ═══ TAB: Factory Presets ═══ */}
          {activeTab === 'presets' && (
            <div>
              <div style={{ color: '#374151', fontSize: '10px', marginBottom: '12px', lineHeight: 1.6 }}>
                These presets are carefully tuned to avoid tunnel echo and robotics. Each targets a specific persona — start here, then fine-tune in FX Controls.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {FACTORY_PRESETS.map(p => {
                  const active = activePreset === p.id;
                  return (
                    <button key={p.id} onClick={() => applyPreset(p)} style={{ background: active ? 'rgba(184,147,58,0.1)' : 'rgba(255,255,255,0.02)', border: `1px solid ${active ? GOLD + '77' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', padding: '11px 13px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
                      <div style={{ color: active ? GOLD : '#c4cdd8', fontSize: '12px', fontWeight: active ? 'bold' : 'normal', marginBottom: '4px' }}>{p.name}</div>
                      <div style={{ color: '#4a5568', fontSize: '10px', lineHeight: 1.4 }}>{p.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ TAB: FX Controls ═══ */}
          {activeTab === 'sliders' && (
            <div>
              {/* Current preset indicator */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '8px 12px' }}>
                <span style={{ color: '#6b7280', fontSize: '11px' }}>
                  Based on: <span style={{ color: GOLD }}>{activePresetObj?.name || 'Custom'}</span>
                </span>
                <button onClick={openSaveDialogForNew} style={{ background: `rgba(184,147,58,0.1)`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '10px' }}>
                  + Save as Custom Preset
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 40px' }}>

                {/* Left column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                  <Section label={`PITCH SHIFT ${!workletOk ? '— Chrome/Edge only' : ''}`}>
                    <FXSlider label="Pitch Shift (semitones)" value={fx.pitchSemitones} min={-6} max={0} step={0.5} unit=" st"
                      onChange={v => updateFx('pitchSemitones', v)} color="#60a5fa" reversed
                      tooltip="-1 to -2 = subtle. -3 = noticeably deeper. Beyond -4 starts sounding robotic. Keep above -6." />
                    <Note>Max -6 st enforced — below that creates unnatural artifacts</Note>
                  </Section>

                  <Section label="EQ — LOW END">
                    <FXSlider label="Bass (120Hz shelf)" value={fx.bassBoost} min={0} max={6} step={0.5} unit=" dB"
                      onChange={v => updateFx('bassBoost', v)} color={GOLD}
                      tooltip="Low shelf at 120Hz. Adds chest weight. +3 = warm, +6 = max safe. Tighter than 150Hz — less boominess." />
                    <FXSlider label="Warmth / Body (280Hz)" value={fx.warmth} min={0} max={5} step={0.5} unit=" dB"
                      onChange={v => updateFx('warmth', v)} color="#f59e0b"
                      tooltip="Peaking at 280Hz. Chest resonance and fullness. Combine with mud cut to avoid boxiness." />
                    <FXSlider label="Mud Cut (500Hz)" value={fx.mudCut} min={0} max={5} step={0.5} unit=" dB"
                      onChange={v => updateFx('mudCut', v)} color="#4ade80"
                      tooltip="Cuts 500Hz boxiness/mud. Always safe to add — cleans up boomy mics. +2–3 is usually enough." />
                    <FXSlider label="Mid Scoop (800Hz)" value={fx.midScoop} min={0} max={4} step={0.5} unit=" dB"
                      onChange={v => updateFx('midScoop', v)} color="#86efac"
                      tooltip="Natural 'smile' EQ — cuts the honky nasal 800Hz region. Prevents tunnel/phone-box sound." />
                  </Section>
                </div>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                  <Section label="TIMBRE & RESONANCE">
                    <FXSlider label="Formant Character (1kHz)" value={fx.formantShift} min={0} max={6} step={0.5}
                      onChange={v => updateFx('formantShift', v)} color="#a78bfa"
                      tooltip="Shapes vocal resonance at 1kHz — changes the 'color' of the voice. Like changing the shape of your mouth cavity. 2–3 = subtle character shift." />
                    <FXSlider label="Clarity (2.5kHz)" value={fx.clarity} min={0} max={4} step={0.5} unit=" dB"
                      onChange={v => updateFx('clarity', v)} color="#38bdf8"
                      tooltip="Consonant definition. Makes 's', 't', 'k' sounds crisper. Key for intelligibility on calls." />
                    <FXSlider label="Presence (3.5kHz)" value={fx.presence} min={0} max={4} step={0.5} unit=" dB"
                      onChange={v => updateFx('presence', v)} color="#22d3ee"
                      tooltip="Forward presence — cuts through on phone calls. Combine with clarity for maximum intelligibility." />
                    <FXSlider label="Air / Openness (10kHz+)" value={fx.airShelf} min={0} max={5} step={0.5} unit=" dB"
                      onChange={v => updateFx('airShelf', v)} color="#e0f2fe"
                      tooltip="High shelf lift above 10kHz. Adds breathiness and openness — sounds like a great microphone." />
                    <FXSlider label="Treble Rolloff (7kHz+)" value={fx.trebleCut} min={0} max={8} step={0.5} unit=" dB"
                      onChange={v => updateFx('trebleCut', v)} color="#f87171" reversed
                      tooltip="Cuts harshness above 7kHz. Makes voice sound older/warmer. Can combine with Air for 'dark but open' tone." />
                  </Section>

                  <Section label="DYNAMICS & TEXTURE">
                    <FXSlider label="Saturation / Grit" value={fx.saturation} min={0} max={12} step={1}
                      onChange={v => updateFx('saturation', v)} color="#fb923c"
                      tooltip="Soft harmonic texture. 3 = subtle character, 7 = gravelly, 12 = rough. Max capped at 12 to prevent robotic tone." />
                    <FXSlider label="Compression" value={fx.compression} min={0} max={8} step={0.5}
                      onChange={v => updateFx('compression', v)} color="#34d399"
                      tooltip="Broadcast-grade gentle compression. 1.3:1 to 2.8:1 max ratio. 3 = polished, 6 = very even. Never crushing." />
                    <FXSlider label="Noise Gate" value={fx.noiseGate} min={0} max={8} step={0.5}
                      onChange={v => updateFx('noiseGate', v)} color="#94a3b8"
                      tooltip="Kills background hum/breath between words. 2 = light cleanup, 5 = aggressive gating. Use with noisy environments." />
                  </Section>
                </div>
              </div>

              {/* Warning box */}
              <div style={{ marginTop: '4px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: '6px', padding: '8px 12px', color: '#6b7280', fontSize: '9px', lineHeight: 1.6 }}>
                ⚠ <strong style={{ color: '#ef4444' }}>No reverb on live calls.</strong> Reverb creates echo feedback through the phone line. All presets are reverb-free.
                {' '}Pitch shift below -4 and saturation above 12 start sounding robotic — limits enforced above.
              </div>
            </div>
          )}

          {/* ═══ TAB: Custom Presets ═══ */}
          {activeTab === 'custom' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ color: '#374151', fontSize: '10px' }}>
                  Save your current FX settings as named presets. Changes save automatically.
                </div>
                <button onClick={openSaveDialogForNew} style={{ background: `rgba(184,147,58,0.1)`, border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: '6px', padding: '7px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                  + Save Current as Preset
                </button>
              </div>

              {customPresets.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#374151', fontSize: '13px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎛</div>
                  <div>No custom presets yet.</div>
                  <div style={{ fontSize: '11px', marginTop: '6px', color: '#2d3748' }}>
                    Dial in your sound in FX Controls, then save it here.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {customPresets.map(p => {
                  const active = activePreset === p.id;
                  return (
                    <div key={p.id} style={{ background: active ? 'rgba(184,147,58,0.07)' : 'rgba(255,255,255,0.02)', border: `1px solid ${active ? GOLD + '55' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => applyPreset(p)}>
                        <div style={{ color: active ? GOLD : '#c4cdd8', fontSize: '13px', fontWeight: active ? 'bold' : 'normal' }}>
                          🎛 {p.name}
                        </div>
                        <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '3px' }}>
                          {Object.entries(p.fx).filter(([,v]) => v !== 0).map(([k,v]) => `${k}: ${v > 0 ? '+' : ''}${typeof v === 'number' ? v.toFixed(1) : v}`).join(' · ') || 'All bypassed'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        {active && (
                          <button onClick={() => updateCustomPreset(p.id)} style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>
                            ↑ Update
                          </button>
                        )}
                        <button onClick={() => applyPreset(p)} style={{ background: active ? `rgba(184,147,58,0.15)` : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? GOLD + '44' : 'rgba(255,255,255,0.08)'}`, color: active ? GOLD : '#8a9ab8', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>
                          {active ? '✓ Active' : '▶ Load'}
                        </button>
                        <button onClick={() => deleteCustomPreset(p.id)} style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px' }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ TAB: Test Voice ═══ */}
          {activeTab === 'test' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Active effects summary */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Currently Active</div>
                <div style={{ color: GOLD, fontSize: '12px', marginBottom: '6px' }}>{activePresetObj?.name || 'Custom'}</div>
                {isBypass ? (
                  <div style={{ color: '#374151', fontSize: '11px' }}>All effects bypassed — clean signal</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {Object.entries(fx).filter(([,v]) => v !== 0).map(([k,v]) => (
                      <span key={k} style={{ background: 'rgba(184,147,58,0.07)', border: '1px solid rgba(184,147,58,0.15)', borderRadius: '20px', padding: '2px 9px', color: GOLD, fontSize: '10px', fontFamily: 'monospace' }}>
                        {k}: {v > 0 ? '+' : ''}{typeof v === 'number' ? v.toFixed(1) : v}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Mic select */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#4a5568', fontSize: '11px', flexShrink: 0 }}>🎙 Mic:</span>
                <select value={selectedMic} onChange={e => setSelectedMic(e.target.value)}
                  style={{ flex: 1, minWidth: '160px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '6px', padding: '7px 10px', color: '#c4cdd8', fontSize: '11px', outline: 'none', cursor: 'pointer' }}>
                  {micDevices.length === 0 && <option>Default Microphone</option>}
                  {micDevices.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || `Mic ${m.deviceId.slice(0, 8)}`}</option>)}
                </select>
              </div>

              {/* Record / playback */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={isRecording ? cleanup : startRecording}
                  style={{ background: isRecording ? 'rgba(239,68,68,0.12)' : 'rgba(74,222,128,0.1)', color: isRecording ? '#ef4444' : '#4ade80', border: `1px solid ${isRecording ? 'rgba(239,68,68,0.35)' : 'rgba(74,222,128,0.3)'}`, borderRadius: '6px', padding: '9px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {isRecording
                    ? <><span style={{ width: '7px', height: '7px', background: '#ef4444', borderRadius: '1px', animation: 'vfxPulse 0.8s infinite' }} /> Stop ({30 - recTime}s)</>
                    : <><span style={{ width: '7px', height: '7px', background: '#4ade80', borderRadius: '50%' }} /> Record (max 30s)</>}
                </button>
                {recBlob && !isRecording && <>
                  <button onClick={playBack} style={{ background: isPlaying ? 'rgba(245,158,11,0.1)' : 'rgba(96,165,250,0.1)', color: isPlaying ? '#f59e0b' : '#60a5fa', border: `1px solid ${isPlaying ? 'rgba(245,158,11,0.3)' : 'rgba(96,165,250,0.3)'}`, borderRadius: '6px', padding: '9px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                    {isPlaying ? '⏹ Stop' : '▶ Play Back'}
                  </button>
                  <a href={URL.createObjectURL(recBlob)} download="voice_fx_test.webm" style={{ background: 'rgba(255,255,255,0.04)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '9px 14px', fontSize: '11px', textDecoration: 'none' }}>⬇ Save</a>
                </>}
                {isRecording && (
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                    {Array.from({ length: 30 }).map((_, i) => (
                      <div key={i} style={{ width: '3px', borderRadius: '2px', transition: 'height 0.3s', background: i < recTime ? '#ef4444' : 'rgba(255,255,255,0.07)', height: i < recTime ? `${6 + Math.sin(i * 0.9) * 8}px` : '3px' }} />
                    ))}
                  </div>
                )}
              </div>
              {status && <div style={{ color: status.startsWith('⚠') ? '#ef4444' : '#4ade80', fontSize: '12px' }}>{status}</div>}

              {/* Tips */}
              <div style={{ background: 'rgba(184,147,58,0.03)', border: '1px solid rgba(184,147,58,0.08)', borderRadius: '8px', padding: '14px 16px' }}>
                <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Tips for Natural Sound</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    ['Pitch shift', 'Keep above -3 st for natural sound. -1 to -2 is the sweet spot.'],
                    ['Avoid "robot"', 'High saturation + heavy pitch shift = robotic. Use one at a time.'],
                    ['Avoid "tunnel"', 'Mid Scoop (800Hz cut) and Mud Cut are your best friends here.'],
                    ['Timbre change', 'Use Formant Character (1kHz) + Warmth together for real tonal shift.'],
                    ['Phone calls', 'Phone Optimized preset kills mud and boosts mids for carrier compression.'],
                    ['Naturalness', 'Low compression ratio (under 3:1) keeps dynamics. Heavy = flat/fake.'],
                  ].map(([title, desc]) => (
                    <div key={title} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px', padding: '8px 10px' }}>
                      <div style={{ color: '#c4cdd8', fontSize: '10px', fontWeight: 'bold', marginBottom: '3px' }}>{title}</div>
                      <div style={{ color: '#4a5568', fontSize: '10px', lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)', borderRadius: '0 0 12px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ color: '#2d3748', fontSize: '10px' }}>
            Preset: <span style={{ color: GOLD }}>{activePresetObj?.name || 'Custom'}</span>
            {customPresets.length > 0 && <span style={{ marginLeft: '10px', color: '#374151' }}>{customPresets.length} custom saved</span>}
          </div>
          <button onClick={onClose} style={{ background: `linear-gradient(135deg,${GOLD},#d4aa50)`, color: '#0a0f1e', border: 'none', borderRadius: '6px', padding: '8px 24px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>✓ Done</button>
        </div>
      </div>

      {/* ── Save Preset Dialog ── */}
      {saveDialogOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999 }}>
          <div style={{ background: '#0d1226', border: `1px solid ${GOLD}66`, borderRadius: '10px', padding: '28px 28px 24px', width: '360px', fontFamily: 'Georgia,serif' }}>
            <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold', marginBottom: '16px' }}>💾 Save as Custom Preset</div>
            <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '8px' }}>Preset Name</div>
            <input
              autoFocus
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveCustomPreset(); if (e.key === 'Escape') setSaveDialogOpen(false); }}
              placeholder="e.g. My Deep Voice"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${GOLD}44`, borderRadius: '6px', padding: '9px 12px', color: '#e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }}
            />
            <div style={{ color: '#374151', fontSize: '10px', marginBottom: '18px' }}>
              {Object.entries(fx).filter(([,v]) => v !== 0).length} effects active will be saved.
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setSaveDialogOpen(false); setSaveName(''); }} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
              <button onClick={saveCustomPreset} disabled={!saveName.trim()} style={{ background: saveName.trim() ? `linear-gradient(135deg,${GOLD},#d4aa50)` : 'rgba(255,255,255,0.05)', color: saveName.trim() ? '#0a0f1e' : '#374151', border: 'none', borderRadius: '6px', padding: '8px 20px', cursor: saveName.trim() ? 'pointer' : 'default', fontSize: '12px', fontWeight: 'bold' }}>Save Preset</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes vfxPulse{0%,100%{opacity:1}50%{opacity:0.25}}`}</style>
    </div>
  );
}

// ── Helper sub-components ──────────────────────────────────────────────────────
function Section({ label, children }) {
  return (
    <div>
      <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '5px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{children}</div>
    </div>
  );
}

function Note({ children }) {
  return <div style={{ color: '#2d3748', fontSize: '9px', marginTop: '2px', lineHeight: 1.5 }}>{children}</div>;
}