import { useState, useEffect, useRef, useCallback } from 'react';

const GOLD = '#b8933a';
const ADMIN_USERS = ['admin', 'steph'];

// ── Storage key per user ─────────────────────────────────────────────────────
const storageKey = (username) => `voicefx_settings_${username}`;

// ── Default FX values ────────────────────────────────────────────────────────
const DEFAULT_FX = {
  pitchSemitones:       0,    // -12 to +12
  formantShift:         0,    // -6 to +6 (simulated via EQ)
  bassBoost:            0,    // 0 to 12 dB
  midBoost:             0,    // -6 to +6 dB
  presenceBoost:        0,    // 0 to 8 dB
  trebleCut:            0,    // 0 to -12 dB (high shelf cut)
  compression:          0,    // 0 to 10 (0=off)
  distortion:           0,    // 0 to 40
  reverb:               0,    // 0 to 1
  warmth:               0,    // 0 to 10 — low-mid body
  airiness:             0,    // 0 to 10 — high presence
};

// ── Presets ──────────────────────────────────────────────────────────────────
const PRESETS = [
  {
    id: 'bypass',
    name: '🎙 Natural (Off)',
    description: 'No processing — clean signal',
    fx: { ...DEFAULT_FX },
  },
  {
    id: 'deeper_authority',
    name: '🎤 Deeper Authority',
    description: 'Slightly lower pitch, more chest — sounds seasoned & confident',
    fx: { pitchSemitones: -2.5, bassBoost: 4, midBoost: 1, presenceBoost: 2, trebleCut: 2, compression: 4, distortion: 0, reverb: 0, warmth: 4, airiness: 1, formantShift: -1 },
  },
  {
    id: 'older_male',
    name: '👴 Older Male (55-65)',
    description: 'Lower pitch, gravelly texture — sounds like a seasoned executive',
    fx: { pitchSemitones: -3, bassBoost: 5, midBoost: 2, presenceBoost: 0, trebleCut: 4, compression: 5, distortion: 12, reverb: 0, warmth: 6, airiness: 0, formantShift: -2 },
  },
  {
    id: 'radio_pro',
    name: '📻 Radio Professional',
    description: 'Broadcast-polished — warm, clear, trustworthy',
    fx: { pitchSemitones: -1, bassBoost: 2, midBoost: -1, presenceBoost: 4, trebleCut: 0, compression: 6, distortion: 0, reverb: 0.05, warmth: 3, airiness: 3, formantShift: 0 },
  },
  {
    id: 'senior_exec',
    name: '💼 Senior Executive',
    description: 'Deep, measured, commanding — boardroom presence',
    fx: { pitchSemitones: -4, bassBoost: 6, midBoost: 2, presenceBoost: 0, trebleCut: 5, compression: 6, distortion: 5, reverb: 0.08, warmth: 7, airiness: 0, formantShift: -2.5 },
  },
  {
    id: 'weathered_veteran',
    name: '🪨 Weathered Veteran',
    description: 'Rough edges, world-weary tone — seen it all',
    fx: { pitchSemitones: -3.5, bassBoost: 5, midBoost: 3, presenceBoost: 0, trebleCut: 6, compression: 5, distortion: 22, reverb: 0, warmth: 5, airiness: 0, formantShift: -2 },
  },
  {
    id: 'calm_mentor',
    name: '🧑‍🏫 Calm Mentor',
    description: 'Warm, slightly lower — trusted advisor in their 50s',
    fx: { pitchSemitones: -1.5, bassBoost: 3, midBoost: 1, presenceBoost: 2, trebleCut: 2, compression: 4, distortion: 0, reverb: 0.06, warmth: 5, airiness: 2, formantShift: -0.5 },
  },
  {
    id: 'phone_exec',
    name: '📞 Phone Executive',
    description: 'Cuts muddiness, adds presence — optimized for phone calls',
    fx: { pitchSemitones: -2, bassBoost: 1, midBoost: 3, presenceBoost: 4, trebleCut: 0, compression: 7, distortion: 0, reverb: 0, warmth: 2, airiness: 4, formantShift: -1 },
  },
  {
    id: 'gravel',
    name: '🔥 Gravel & Grit',
    description: 'Noticeably rough and deep — a distinctive older male character',
    fx: { pitchSemitones: -5, bassBoost: 7, midBoost: 3, presenceBoost: 0, trebleCut: 8, compression: 6, distortion: 30, reverb: 0, warmth: 7, airiness: 0, formantShift: -3 },
  },
  {
    id: 'subtle',
    name: '🌀 Subtle Shift',
    description: 'Just enough to sound slightly different from your natural voice',
    fx: { pitchSemitones: -1, bassBoost: 2, midBoost: 0, presenceBoost: 1, trebleCut: 0, compression: 3, distortion: 0, reverb: 0, warmth: 2, airiness: 1, formantShift: 0 },
  },
  {
    id: 'closer',
    name: '💰 Confident Closer',
    description: 'Punchy, present, persuasive — optimized for sales calls',
    fx: { pitchSemitones: -2, bassBoost: 2, midBoost: 3, presenceBoost: 3, trebleCut: 1, compression: 6, distortion: 0, reverb: 0, warmth: 3, airiness: 3, formantShift: -1 },
  },
];

// ── Build audio processing chain ─────────────────────────────────────────────
function buildProcessingChain(ctx, fx) {
  const nodes = [];

  // 1. High-pass (remove sub-bass rumble)
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 100;
  hp.Q.value = 0.7;
  nodes.push(hp);

  // 2. Bass boost (low shelf)
  const bass = ctx.createBiquadFilter();
  bass.type = 'lowshelf';
  bass.frequency.value = 200;
  bass.gain.value = fx.bassBoost;
  nodes.push(bass);

  // 3. Warmth / body (low-mid peaking)
  const warmth = ctx.createBiquadFilter();
  warmth.type = 'peaking';
  warmth.frequency.value = 350;
  warmth.Q.value = 0.8;
  warmth.gain.value = fx.warmth * 0.8;
  nodes.push(warmth);

  // 4. Formant shift simulation (mid-range notch/boost)
  const formant = ctx.createBiquadFilter();
  formant.type = 'peaking';
  formant.frequency.value = 1200;
  formant.Q.value = 1.5;
  formant.gain.value = fx.formantShift * 2;
  nodes.push(formant);

  // 5. Mid boost/cut
  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 2500;
  mid.Q.value = 1.0;
  mid.gain.value = fx.midBoost;
  nodes.push(mid);

  // 6. Presence boost
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3800;
  presence.Q.value = 1.2;
  presence.gain.value = fx.presenceBoost;
  nodes.push(presence);

  // 7. Airiness (high shelf)
  const air = ctx.createBiquadFilter();
  air.type = 'highshelf';
  air.frequency.value = 8000;
  air.gain.value = fx.airiness * 0.7;
  nodes.push(air);

  // 8. Treble cut (high shelf cut — age effect)
  const treble = ctx.createBiquadFilter();
  treble.type = 'highshelf';
  treble.frequency.value = 5000;
  treble.gain.value = -fx.trebleCut;
  nodes.push(treble);

  // 9. Distortion (waveshaper — adds grit/grain)
  if (fx.distortion > 0) {
    const ws = ctx.createWaveShaper();
    const k = fx.distortion;
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    ws.curve = curve;
    ws.oversample = '4x';
    nodes.push(ws);
  }

  // 10. Compressor
  if (fx.compression > 0) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18 - fx.compression;
    comp.knee.value = 8;
    comp.ratio.value = 2 + fx.compression * 0.5;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    nodes.push(comp);
  }

  // 11. Reverb (convolution)
  let reverbWetGain = null;
  let reverbDryGain = null;
  let reverbMerger = null;
  if (fx.reverb > 0) {
    const convolver = ctx.createConvolver();
    reverbWetGain = ctx.createGain();
    reverbDryGain = ctx.createGain();
    reverbMerger = ctx.createGain();
    reverbWetGain.gain.value = fx.reverb;
    reverbDryGain.gain.value = 1 - fx.reverb;

    const len = ctx.sampleRate * 0.6;
    const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    convolver.buffer = impulse;

    nodes.push({ isReverb: true, convolver, reverbWetGain, reverbDryGain, reverbMerger });
  }

  return nodes;
}

function connectChain(source, nodes, destination) {
  let current = source;
  for (const node of nodes) {
    if (node.isReverb) {
      current.connect(node.reverbDryGain);
      current.connect(node.convolver);
      node.convolver.connect(node.reverbWetGain);
      node.reverbDryGain.connect(node.reverbMerger);
      node.reverbWetGain.connect(node.reverbMerger);
      current = node.reverbMerger;
    } else {
      current.connect(node);
      current = node;
    }
  }
  current.connect(destination);
  return current;
}

// ── Pitch shift via script processor (simple) ─────────────────────────────────
// NOTE: For production quality, replace with a phase vocoder library.
// This is a lightweight approximation.
function createPitchNode(ctx, semitones) {
  if (semitones === 0) return null;
  const ratio = Math.pow(2, semitones / 12);
  const bufferSize = 4096;
  const processor = ctx.createScriptProcessor(bufferSize, 1, 1);
  let phase = 0;
  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    const output = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      phase += ratio;
      const idx = Math.floor(phase) % bufferSize;
      output[i] = input[Math.min(idx, input.length - 1)] || 0;
    }
    if (phase > bufferSize * 100) phase = phase % bufferSize;
  };
  return processor;
}

// ── Slider control ────────────────────────────────────────────────────────────
function FXSlider({ label, value, min, max, step = 0.1, unit = '', onChange, color = GOLD, tooltip }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#8a9ab8', fontSize: '10px', letterSpacing: '0.5px' }} title={tooltip}>{label}</span>
        <span style={{ color, fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', minWidth: '40px', textAlign: 'right' }}>
          {value > 0 && max > 0 && min >= 0 ? '+' : ''}{typeof value === 'number' ? value.toFixed(1) : value}{unit}
        </span>
      </div>
      <div style={{ position: 'relative', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: '3px', transition: 'width 0.05s' }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', margin: 0 }}
        />
        <div style={{ position: 'absolute', top: '50%', left: `${pct}%`, transform: 'translate(-50%, -50%)', width: '12px', height: '12px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}88`, pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main VoiceFXPanel
// ══════════════════════════════════════════════════════════════════════════════
export default function VoiceFXPanel({ username, onClose, onFxChange }) {
  const isAdmin = ADMIN_USERS.includes(username);

  const [fx, setFx] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey(username));
      if (saved) return { ...DEFAULT_FX, ...JSON.parse(saved) };
    } catch {}
    return { ...DEFAULT_FX };
  });

  const [activePreset, setActivePreset] = useState('bypass');
  const [micDevices, setMicDevices] = useState([]);
  const [selectedMic, setSelectedMic] = useState('');

  // Test recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [testStatus, setTestStatus] = useState(''); // message

  const audioCtxRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const destNodeRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioPlayRef = useRef(null);
  const pitchNodeRef = useRef(null);

  // Load mic devices
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => navigator.mediaDevices.enumerateDevices())
      .then(devices => {
        const mics = devices.filter(d => d.kind === 'audioinput');
        setMicDevices(mics);
        if (mics.length > 0) setSelectedMic(mics[0].deviceId);
      })
      .catch(() => {});
    return () => stopTest();
  }, []);

  // Save settings on change
  useEffect(() => {
    try { localStorage.setItem(storageKey(username), JSON.stringify(fx)); } catch {}
    onFxChange && onFxChange(fx);
  }, [fx]);

  const updateFx = useCallback((key, value) => {
    setFx(prev => ({ ...prev, [key]: value }));
    setActivePreset('custom');
  }, []);

  const applyPreset = (preset) => {
    setFx({ ...preset.fx });
    setActivePreset(preset.id);
  };

  const resetAll = () => {
    setFx({ ...DEFAULT_FX });
    setActivePreset('bypass');
  };

  // ── Test recording ────────────────────────────────────────────────────────
  const stopTest = () => {
    clearInterval(recordingTimerRef.current);
    try { mediaRecorderRef.current?.stop(); } catch {}
    try { sourceNodeRef.current?.disconnect(); } catch {}
    try { pitchNodeRef.current?.disconnect(); } catch {}
    try { destNodeRef.current?.disconnect(); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    pitchNodeRef.current = null;
    sourceNodeRef.current = null;
    destNodeRef.current = null;
    audioCtxRef.current = null;
    streamRef.current = null;
    setIsRecording(false);
    setRecordingTime(0);
  };

  const startRecording = async () => {
    try {
      setTestStatus('');
      setRecordingBlob(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selectedMic ? { exact: selectedMic } : undefined }
      });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const dest = ctx.createMediaStreamDestination();
      destNodeRef.current = dest;

      // Build chain
      const chainNodes = buildProcessingChain(ctx, fx);

      // Pitch node (before chain)
      let chainStart = source;
      if (fx.pitchSemitones !== 0) {
        const pitchNode = createPitchNode(ctx, fx.pitchSemitones);
        if (pitchNode) {
          source.connect(pitchNode);
          chainStart = pitchNode;
          pitchNodeRef.current = pitchNode;
        }
      }

      connectChain(chainStart, chainNodes, dest);

      // Record from processed output
      const recorder = new MediaRecorder(dest.stream);
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        setRecordingBlob(blob);
        setTestStatus('✓ Recording ready — click Play to hear your processed voice');
        stopTest();
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => {
          if (t >= 29) { stopTest(); return t; }
          return t + 1;
        });
      }, 1000);

    } catch (e) {
      setTestStatus('⚠ Mic error: ' + e.message);
    }
  };

  const playRecording = () => {
    if (!recordingBlob) return;
    if (isPlaying) {
      audioPlayRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    const url = URL.createObjectURL(recordingBlob);
    const audio = new Audio(url);
    audioPlayRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', fontFamily: 'Georgia, serif' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
        <div>Voice FX is available to admin users only.</div>
      </div>
    );
  }

  const sliderStyle = { display: 'flex', flexDirection: 'column', gap: '10px' };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: '16px', fontFamily: 'Georgia, serif',
    }}>
      <div style={{
        background: '#0a0f1e', border: `1px solid ${GOLD}55`,
        borderRadius: '8px', width: '100%', maxWidth: '860px',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: `0 0 60px rgba(184,147,58,0.15)`,
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid rgba(255,255,255,0.07)`, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>🎙 Voice FX Studio</div>
            <div style={{ color: '#4a5568', fontSize: '11px', marginTop: '2px' }}>Admin only · Settings saved per user · {username}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={resetAll} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>
              ↺ Reset All
            </button>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', cursor: 'pointer', fontSize: '18px', width: '32px', height: '32px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── PRESETS ── */}
          <div>
            <div style={{ color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Quick Presets</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
              {PRESETS.map(p => {
                const active = activePreset === p.id;
                return (
                  <button key={p.id} onClick={() => applyPreset(p)}
                    style={{
                      background: active ? `rgba(184,147,58,0.15)` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? GOLD : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '6px', padding: '10px 12px', cursor: 'pointer',
                      textAlign: 'left', transition: 'all 0.15s',
                    }}>
                    <div style={{ color: active ? GOLD : '#c4cdd8', fontSize: '12px', fontWeight: active ? 'bold' : 'normal', marginBottom: '3px' }}>{p.name}</div>
                    <div style={{ color: '#4a5568', fontSize: '10px', lineHeight: 1.4 }}>{p.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── FX SLIDERS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 32px' }}>

            {/* Left column */}
            <div style={sliderStyle}>
              <div style={{ color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '2px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>PITCH & TONE</div>
              <FXSlider
                label="Pitch Shift"
                value={fx.pitchSemitones} min={-10} max={10} step={0.5} unit=" st"
                onChange={v => updateFx('pitchSemitones', v)} color="#60a5fa"
                tooltip="Shifts pitch up or down in semitones. Negative = deeper voice."
              />
              <FXSlider
                label="Formant Shift"
                value={fx.formantShift} min={-6} max={6} step={0.5} unit=" dB"
                onChange={v => updateFx('formantShift', v)} color="#a78bfa"
                tooltip="Shifts resonance character — negative makes voice sound larger/older."
              />

              <div style={{ color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '8px', marginBottom: '2px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>EQ</div>
              <FXSlider
                label="Bass Boost (Low Shelf)"
                value={fx.bassBoost} min={0} max={12} step={0.5} unit=" dB"
                onChange={v => updateFx('bassBoost', v)} color={GOLD}
                tooltip="Boosts low frequencies — adds chest and weight to voice."
              />
              <FXSlider
                label="Warmth / Body"
                value={fx.warmth} min={0} max={10} step={0.5}
                onChange={v => updateFx('warmth', v)} color="#f59e0b"
                tooltip="Boosts low-mid body (350Hz) — makes voice sound fuller and older."
              />
              <FXSlider
                label="Mid Presence (+/-)"
                value={fx.midBoost} min={-6} max={6} step={0.5} unit=" dB"
                onChange={v => updateFx('midBoost', v)} color="#4ade80"
                tooltip="Boosts or cuts 2.5kHz — affects clarity and forwardness."
              />
              <FXSlider
                label="Presence Boost"
                value={fx.presenceBoost} min={0} max={10} step={0.5} unit=" dB"
                onChange={v => updateFx('presenceBoost', v)} color="#22d3ee"
                tooltip="Boosts upper-mid presence (3.8kHz) — adds definition and cut-through."
              />
            </div>

            {/* Right column */}
            <div style={sliderStyle}>
              <div style={{ color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '2px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>EQ (CONT.)</div>
              <FXSlider
                label="Treble Cut (Age Effect)"
                value={fx.trebleCut} min={0} max={12} step={0.5} unit=" dB"
                onChange={v => updateFx('trebleCut', v)} color="#f87171"
                tooltip="Cuts high frequencies (5kHz+) — rolling off highs makes voice sound older."
              />
              <FXSlider
                label="Airiness (High Shelf)"
                value={fx.airiness} min={0} max={10} step={0.5}
                onChange={v => updateFx('airiness', v)} color="#c4b5fd"
                tooltip="Adds sheen and air above 8kHz — brightens voice slightly."
              />

              <div style={{ color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '8px', marginBottom: '2px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>DYNAMICS & FX</div>
              <FXSlider
                label="Compression"
                value={fx.compression} min={0} max={10} step={0.5}
                onChange={v => updateFx('compression', v)} color="#34d399"
                tooltip="Evens out volume levels. Higher = more compressed, radio-like sound."
              />
              <FXSlider
                label="Distortion / Grit"
                value={fx.distortion} min={0} max={40} step={1}
                onChange={v => updateFx('distortion', v)} color="#fb923c"
                tooltip="Adds harmonic grit and texture — makes voice sound rougher and gravel-like."
              />
              <FXSlider
                label="Room Reverb"
                value={fx.reverb} min={0} max={0.5} step={0.01}
                onChange={v => updateFx('reverb', v)} color="#94a3b8"
                tooltip="Adds subtle room ambiance. Keep low (0–0.08) for phone calls."
              />
            </div>
          </div>

          {/* ── TEST RECORDING ── */}
          <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px 18px' }}>
            <div style={{ color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🧪 Test Your Voice</div>

            {/* Mic selector */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
              <label style={{ color: '#4a5568', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>🎙 Microphone</label>
              <select value={selectedMic} onChange={e => setSelectedMic(e.target.value)}
                style={{ flex: 1, minWidth: '200px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#c4cdd8', fontSize: '12px', outline: 'none', cursor: 'pointer' }}>
                {micDevices.length === 0 && <option value="">Default Microphone</option>}
                {micDevices.map(m => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label || `Microphone ${m.deviceId.slice(0, 6)}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Record / Play controls */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={isRecording ? stopTest : startRecording}
                style={{
                  background: isRecording ? 'rgba(239,68,68,0.2)' : 'rgba(74,222,128,0.15)',
                  color: isRecording ? '#ef4444' : '#4ade80',
                  border: `1px solid ${isRecording ? 'rgba(239,68,68,0.5)' : 'rgba(74,222,128,0.4)'}`,
                  borderRadius: '6px', padding: '9px 20px', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 'bold',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                {isRecording ? (
                  <><span style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '2px', display: 'inline-block', animation: 'pulse 1s infinite' }} /> Stop ({30 - recordingTime}s)</>
                ) : (
                  <><span style={{ width: '8px', height: '8px', background: '#4ade80', borderRadius: '50%' }} /> Record (up to 30s)</>
                )}
              </button>

              {recordingBlob && !isRecording && (
                <button onClick={playRecording}
                  style={{ background: isPlaying ? 'rgba(245,158,11,0.15)' : 'rgba(96,165,250,0.15)', color: isPlaying ? '#f59e0b' : '#60a5fa', border: `1px solid ${isPlaying ? 'rgba(245,158,11,0.4)' : 'rgba(96,165,250,0.4)'}`, borderRadius: '6px', padding: '9px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                  {isPlaying ? '⏹ Stop' : '▶ Play Back'}
                </button>
              )}

              {recordingBlob && !isRecording && (
                <a href={URL.createObjectURL(recordingBlob)} download="voice_fx_test.webm"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '9px 16px', cursor: 'pointer', fontSize: '12px', textDecoration: 'none' }}>
                  ⬇ Save
                </a>
              )}

              {isRecording && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[...Array(30)].map((_, i) => (
                    <div key={i} style={{ width: '3px', height: i < recordingTime ? '16px' : '6px', background: i < recordingTime ? '#ef4444' : 'rgba(255,255,255,0.1)', borderRadius: '2px', transition: 'height 0.3s' }} />
                  ))}
                </div>
              )}
            </div>

            {testStatus && (
              <div style={{ marginTop: '10px', color: testStatus.startsWith('⚠') ? '#ef4444' : '#4ade80', fontSize: '12px' }}>
                {testStatus}
              </div>
            )}

            <div style={{ marginTop: '10px', color: '#374151', fontSize: '11px', lineHeight: 1.6 }}>
              💡 Recording captures your processed voice with current FX settings. Use this to test presets and sliders before a real call. Your settings are automatically saved and applied to all dialers.
            </div>
          </div>

          {/* ── Current FX summary ── */}
          <div style={{ background: 'rgba(184,147,58,0.04)', border: '1px solid rgba(184,147,58,0.15)', borderRadius: '6px', padding: '12px 16px' }}>
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Current Profile</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(fx).filter(([, v]) => v !== 0).map(([k, v]) => (
                <span key={k} style={{ background: 'rgba(184,147,58,0.1)', border: '1px solid rgba(184,147,58,0.2)', borderRadius: '20px', padding: '3px 10px', color: GOLD, fontSize: '10px', fontFamily: 'monospace' }}>
                  {k}: {typeof v === 'number' ? (v > 0 && k !== 'distortion' && k !== 'compression' && k !== 'reverb' ? '+' : '') + v.toFixed(1) : v}
                </span>
              ))}
              {Object.values(fx).every(v => v === 0) && <span style={{ color: '#4a5568', fontSize: '11px' }}>All effects off — natural voice</span>}
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ color: '#4a5568', fontSize: '10px' }}>
            Settings auto-saved per user · Active preset: <span style={{ color: GOLD }}>{PRESETS.find(p => p.id === activePreset)?.name || 'Custom'}</span>
          </div>
          <button onClick={onClose}
            style={{ background: `linear-gradient(135deg, ${GOLD}, #d4aa50)`, color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '9px 24px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>
            ✓ Done
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// ── Hook: get processed stream with FX applied ────────────────────────────────
export function useVoiceFX(username) {
  const isAdmin = ADMIN_USERS.includes(username);
  const [fx, setFx] = useState(() => {
    if (!isAdmin) return null;
    try {
      const saved = localStorage.getItem(storageKey(username));
      if (saved) return { ...DEFAULT_FX, ...JSON.parse(saved) };
    } catch {}
    return { ...DEFAULT_FX };
  });

  // Listen for storage changes (panel updates fx, hook picks it up)
  useEffect(() => {
    if (!isAdmin) return;
    const handler = () => {
      try {
        const saved = localStorage.getItem(storageKey(username));
        if (saved) setFx({ ...DEFAULT_FX, ...JSON.parse(saved) });
      } catch {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [username, isAdmin]);

  const isBypass = !fx || Object.values(fx).every(v => v === 0);

  return { fx, isBypass, isAdmin };
}