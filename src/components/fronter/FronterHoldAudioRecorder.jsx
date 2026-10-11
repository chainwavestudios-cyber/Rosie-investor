/**
 * FronterHoldAudioRecorder.jsx — In-browser recording studio for hold audio.
 * Records microphone input with optional background music mixing.
 * Uses Web Audio API to mix mic + music with independent volume control,
 * then captures the combined output via MediaRecorder. Converts the
 * webm recording to WAV before passing it to the parent (Twilio-compatible).
 */
import { useState, useRef, useEffect } from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const PURPLE = '#a78bfa';

// ── WAV encoder (PCM 16-bit) ──────────────────────────────────────────────
// Twilio <Play> only supports WAV and MP3, so we convert the webm recording
// to WAV before uploading.
function audioBufferToWav(buffer) {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const ab = new ArrayBuffer(44 + dataLength);
  const view = new DataView(ab);
  const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLength, true);

  const channels = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

export default function FronterHoldAudioRecorder({ onRecorded }) {
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [micVolume, setMicVolume] = useState(0.8);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [musicFileName, setMusicFileName] = useState('');
  const [musicUrl, setMusicUrl] = useState('');
  const [error, setError] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const [converting, setConverting] = useState(false);
  const [micDevices, setMicDevices] = useState([]);
  const [micDeviceId, setMicDeviceId] = useState('');

  const audioCtxRef = useRef(null);
  const micGainRef = useRef(null);
  const musicGainRef = useRef(null);
  const destinationRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const micStreamRef = useRef(null);
  const musicAudioRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const musicFileRef = useRef(null);
  const recordedBlobRef = useRef(null);

  // Enumerate microphone devices
  useEffect(() => {
    const loadMics = async () => {
      try {
        // Must request permission first to get device labels
        const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
        tmp.getTracks().forEach(t => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(d => d.kind === 'audioinput');
        setMicDevices(mics);
        if (mics.length > 0 && !micDeviceId) setMicDeviceId(mics[0].deviceId);
      } catch {}
    };
    loadMics();
  }, []);

  useEffect(() => {
    return () => {
      stopAll();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      if (musicUrl) URL.revokeObjectURL(musicUrl);
    };
  }, []);

  const handleMusicFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) {
      setError('Music file must be MP3, WAV, M4A, or OGG');
      setTimeout(() => setError(''), 5000);
      return;
    }
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    setMusicUrl(URL.createObjectURL(file));
    setMusicFileName(file.name);
  };

  const startRecording = async () => {
    setError('');
    if (recordedUrl) { URL.revokeObjectURL(recordedUrl); setRecordedUrl(''); }
    recordedBlobRef.current = null;
    chunksRef.current = [];

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          deviceId: micDeviceId ? { exact: micDeviceId } : undefined,
        },
      });
      micStreamRef.current = micStream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const destination = audioCtx.createMediaStreamDestination();
      destinationRef.current = destination;

      // Mic → gain → recording destination (NOT speakers — avoids echo)
      const micSource = audioCtx.createMediaStreamSource(micStream);
      const micGain = audioCtx.createGain();
      micGain.gain.value = micVolume;
      micGainRef.current = micGain;
      micSource.connect(micGain);
      micGain.connect(destination);

      // Mic level meter
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      micGain.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        setMicLevel(sum / data.length / 255);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      // Music → gain → recording destination + speakers (for monitoring)
      if (musicFileName && musicUrl) {
        const musicAudio = new Audio(musicUrl);
        musicAudio.loop = true;
        musicAudioRef.current = musicAudio;
        await musicAudio.play().catch(() => {});
        const musicSource = audioCtx.createMediaElementSource(musicAudio);
        const musicGain = audioCtx.createGain();
        musicGain.gain.value = musicVolume;
        musicGainRef.current = musicGain;
        musicSource.connect(musicGain);
        musicGain.connect(destination);
        musicGain.connect(audioCtx.destination); // monitor
      }

      // Record the combined stream
      const recorder = new MediaRecorder(destination.stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        recordedBlobRef.current = blob;
        setRecordedUrl(URL.createObjectURL(blob));
      };
      recorder.start();

      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (e) {
      setError('Could not access microphone: ' + (e?.message || String(e)));
      setTimeout(() => setError(''), 6000);
      stopAll();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    stopAll();
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setMicLevel(0);
  };

  const stopAll = () => {
    try { micStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    try { musicAudioRef.current?.pause(); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    micStreamRef.current = null;
    musicAudioRef.current = null;
    audioCtxRef.current = null;
    micGainRef.current = null;
    musicGainRef.current = null;
    destinationRef.current = null;
    analyserRef.current = null;
  };

  const adjustMicVolume = (v) => {
    setMicVolume(v);
    if (micGainRef.current && audioCtxRef.current) micGainRef.current.gain.setValueAtTime(v, audioCtxRef.current.currentTime);
  };

  const adjustMusicVolume = (v) => {
    setMusicVolume(v);
    if (musicGainRef.current && audioCtxRef.current) musicGainRef.current.gain.setValueAtTime(v, audioCtxRef.current.currentTime);
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleUseRecording = async () => {
    if (!recordedBlobRef.current) return;
    setConverting(true);
    try {
      const arrayBuffer = await recordedBlobRef.current.arrayBuffer();
      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      audioCtx.close();
      const wavBlob = audioBufferToWav(audioBuffer);
      const file = new File([wavBlob], `hold-audio-${Date.now()}.wav`, { type: 'audio/wav' });
      onRecorded?.(file);
    } catch {
      // Fallback: send webm directly
      const file = new File([recordedBlobRef.current], `hold-audio-${Date.now()}.webm`, { type: 'audio/webm' });
      onRecorded?.(file);
    }
    setConverting(false);
  };

  const clearRecording = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl('');
    recordedBlobRef.current = null;
  };

  const removeMusic = () => {
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    setMusicFileName('');
    setMusicUrl('');
    if (musicFileRef.current) musicFileRef.current.value = '';
  };

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '6px', padding: '16px', marginBottom: '14px' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{ color: PURPLE, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>🎙 Recording Studio</div>
      <div style={{ color: '#4a5568', fontSize: '10px', marginBottom: '14px', lineHeight: 1.4 }}>Record your hold message right here. Add background music and control the mix with the sliders below.</div>

      {error && (
        <div style={{ padding: '8px 12px', marginBottom: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', color: RED, fontSize: '11px' }}>{error}</div>
      )}

      {/* Background music selector */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>🎵 Background Music (Optional)</label>
        <input ref={musicFileRef} type="file" accept=".mp3,.wav,.m4a,.ogg,audio/mpeg,audio/wav" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleMusicFile(f); e.target.value = ''; }} />
        {musicFileName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '8px 10px' }}>
            <span style={{ color: PURPLE, fontSize: '11px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎵 {musicFileName}</span>
            <button onClick={removeMusic} disabled={recording} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: recording ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: recording ? 0.4 : 1 }}>✕</button>
          </div>
        ) : (
          <button onClick={() => musicFileRef.current?.click()} disabled={recording} style={{ background: 'rgba(167,139,250,0.08)', color: PURPLE, border: '1px solid rgba(167,139,250,0.25)', borderRadius: '4px', padding: '8px 14px', cursor: recording ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: recording ? 0.5 : 1 }}>📁 Choose Music File</button>
        )}
      </div>

      {/* Volume controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ color: BLUE, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 'bold' }}>🎙 Mic Volume</label>
            <span style={{ color: BLUE, fontSize: '11px', fontWeight: 'bold' }}>{Math.round(micVolume * 100)}%</span>
          </div>
          <input type="range" min="0" max="1" step="0.05" value={micVolume} onChange={e => adjustMicVolume(parseFloat(e.target.value))} style={{ width: '100%', accentColor: BLUE }} />
          {recording && (
            <div style={{ marginTop: '6px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, micLevel * 200)}%`, background: BLUE, borderRadius: '3px', transition: 'width 0.05s' }} />
            </div>
          )}
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ color: PURPLE, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 'bold' }}>🎵 Music Volume</label>
            <span style={{ color: PURPLE, fontSize: '11px', fontWeight: 'bold' }}>{Math.round(musicVolume * 100)}%</span>
          </div>
          <input type="range" min="0" max="1" step="0.05" value={musicVolume} onChange={e => adjustMusicVolume(parseFloat(e.target.value))} disabled={!musicFileName} style={{ width: '100%', accentColor: PURPLE, opacity: musicFileName ? 1 : 0.4 }} />
          {!musicFileName && <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '4px' }}>Add music to enable</div>}
        </div>
      </div>

      {/* Mic selector */}
      {micDevices.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>🎙 Microphone</label>
          <select value={micDeviceId} onChange={e => setMicDeviceId(e.target.value)} disabled={recording} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', color: '#e8e0d0', fontSize: '11px', outline: 'none', cursor: 'pointer', opacity: recording ? 0.5 : 1 }}>
            {micDevices.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || `Mic ${m.deviceId.slice(0, 6)}`}</option>)}
          </select>
        </div>
      )}

      {/* Record / Stop */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
        {!recording ? (
          <button onClick={startRecording} style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 22px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>🔴 Start Recording</button>
        ) : (
          <>
            <button onClick={stopRecording} style={{ background: 'rgba(239,68,68,0.15)', color: RED, border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', padding: '10px 22px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>⏹ Stop</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: RED, animation: 'pulse 1s infinite' }} />
              <span style={{ color: RED, fontSize: '13px', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatTime(recordingTime)}</span>
            </div>
          </>
        )}
      </div>

      {/* Recorded preview */}
      {recordedUrl && !recording && (
        <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ display: 'block', color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>✓ Recording Preview</label>
            <button onClick={clearRecording} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '11px' }}>Clear</button>
          </div>
          <audio controls src={recordedUrl} style={{ width: '100%', height: '36px', marginBottom: '10px' }} />
          <button onClick={handleUseRecording} disabled={converting} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '9px 22px', cursor: converting ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: converting ? 0.6 : 1 }}>
            {converting ? '⏳ Converting…' : '⬆ Use as Hold Audio'}
          </button>
        </div>
      )}
    </div>
  );
}