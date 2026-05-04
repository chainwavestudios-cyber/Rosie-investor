import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

function fmtTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function AudioRecorderManager() {
  const [recordings, setRecordings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('admin_audio_recordings') || '[]'); } catch { return []; }
  });
  const [recording, setRecording] = useState(false);
  const [paused, setPaused]       = useState(false);
  const [elapsed, setElapsed]     = useState(0);
  const [label, setLabel]         = useState('');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg]             = useState('');
  const [playingId, setPlayingId] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const timerRef         = useRef(null);
  const audioRefs        = useRef({});

  const save = (recs) => {
    setRecordings(recs);
    localStorage.setItem('admin_audio_recordings', JSON.stringify(recs));
  };

  useEffect(() => {
    return () => { clearInterval(timerRef.current); };
  }, []);

  const startRecording = async () => {
    setMsg('');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMsg('❌ Microphone access denied.');
      return;
    }

    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      clearInterval(timerRef.current);

      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const localUrl = URL.createObjectURL(blob);

      // Upload to Base44 storage
      setUploading(true);
      let fileUrl = localUrl; // fallback to local blob
      try {
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        const result = await base44.integrations.Core.UploadFile({ file });
        fileUrl = result.file_url;
      } catch (e) {
        setMsg('⚠️ Upload failed — recording saved locally only.');
      }
      setUploading(false);

      const rec = {
        id: Date.now().toString(),
        label: label.trim() || `Recording ${new Date().toLocaleDateString()}`,
        duration: elapsed,
        createdAt: new Date().toISOString(),
        fileUrl,
        isLocal: fileUrl === localUrl,
      };

      save([rec, ...recordings]);
      setElapsed(0);
      setLabel('');
      setRecording(false);
      setPaused(false);
      if (!msg) setMsg('✅ Recording saved.');
      setTimeout(() => setMsg(''), 4000);
    };

    mr.start(500);
    setRecording(true);
    setPaused(false);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const pauseResume = () => {
    if (!mediaRecorderRef.current) return;
    if (paused) {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      setPaused(false);
    } else {
      mediaRecorderRef.current.pause();
      clearInterval(timerRef.current);
      setPaused(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
  };

  const deleteRecording = (id) => {
    save(recordings.filter(r => r.id !== id));
  };

  const handlePlay = (rec) => {
    if (playingId === rec.id) {
      audioRefs.current[rec.id]?.pause();
      setPlayingId(null);
    } else {
      // Pause any currently playing
      Object.values(audioRefs.current).forEach(a => { if (a) a.pause(); });
      audioRefs.current[rec.id]?.play();
      setPlayingId(rec.id);
    }
  };

  const inp = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '4px',
    padding: '9px 14px',
    color: '#e8e0d0',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'Georgia, serif',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ fontFamily: 'Georgia, serif', maxWidth: '720px' }}>
      <h3 style={{ color: '#e8e0d0', margin: '0 0 4px', fontWeight: 'normal', fontSize: '18px' }}>🎙 Audio Recorder</h3>
      <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 24px' }}>
        Record audio memos, pitch practice, or training clips. Recordings are uploaded to secure storage and persist across sessions.
      </p>

      {/* ── RECORD PANEL ── */}
      <div style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${recording ? 'rgba(239,68,68,0.4)' : 'rgba(184,147,58,0.2)'}`, borderRadius: '8px', padding: '20px', marginBottom: '24px', transition: 'border-color 0.3s' }}>
        {/* Label */}
        {!recording && (
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Recording Label (optional)</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Pitch practice, Objection handling…" style={inp} />
          </div>
        )}

        {/* Timer */}
        {recording && (
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: paused ? '#f59e0b' : '#ef4444', boxShadow: paused ? '0 0 8px #f59e0b' : '0 0 8px #ef4444', animation: paused ? 'none' : 'pulse 1s infinite' }} />
              <span style={{ color: paused ? '#f59e0b' : '#ef4444', fontSize: '28px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '2px' }}>{fmtTime(elapsed)}</span>
            </div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>{paused ? '⏸ Paused' : '● Recording…'}</div>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {!recording ? (
            <button
              onClick={startRecording}
              style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', border: 'none', borderRadius: '6px', padding: '12px 28px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ● Start Recording
            </button>
          ) : (
            <>
              <button
                onClick={pauseResume}
                style={{ background: paused ? 'rgba(74,222,128,0.15)' : 'rgba(245,158,11,0.15)', color: paused ? '#4ade80' : '#f59e0b', border: `1px solid ${paused ? 'rgba(74,222,128,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: '6px', padding: '10px 22px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                {paused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button
                onClick={stopRecording}
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '10px 22px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                ⏹ Stop & Save
              </button>
            </>
          )}
        </div>

        {uploading && (
          <div style={{ textAlign: 'center', marginTop: '12px', color: GOLD, fontSize: '12px' }}>⏳ Uploading…</div>
        )}
        {msg && (
          <div style={{ textAlign: 'center', marginTop: '12px', color: msg.startsWith('✅') ? '#4ade80' : '#f59e0b', fontSize: '12px' }}>{msg}</div>
        )}
      </div>

      {/* ── RECORDINGS LIST ── */}
      <div>
        <div style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
          Saved Recordings ({recordings.length})
        </div>

        {recordings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#4a5568', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎙</div>
            <p style={{ margin: 0, fontSize: '13px' }}>No recordings yet. Click "Start Recording" above.</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recordings.map(rec => (
            <div key={rec.id} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${playingId === rec.id ? 'rgba(184,147,58,0.35)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '6px', padding: '14px 16px', display: 'flex', gap: '14px', alignItems: 'center' }}>
              {/* Play/Pause button */}
              <button
                onClick={() => handlePlay(rec)}
                style={{ width: '40px', height: '40px', borderRadius: '50%', background: playingId === rec.id ? GOLD : 'rgba(184,147,58,0.15)', border: `2px solid ${playingId === rec.id ? GOLD : 'rgba(184,147,58,0.35)'}`, color: playingId === rec.id ? DARK : GOLD, cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                {playingId === rec.id ? '⏸' : '▶'}
              </button>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.label}</div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: GOLD, fontSize: '11px', fontFamily: 'monospace' }}>{fmtTime(rec.duration)}</span>
                  <span style={{ color: '#4a5568', fontSize: '11px' }}>{fmtDate(rec.createdAt)}</span>
                  {rec.isLocal && <span style={{ color: '#f59e0b', fontSize: '10px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '1px 7px' }}>local only</span>}
                </div>

                {/* Native audio element (hidden, controlled programmatically) */}
                <audio
                  ref={el => { audioRefs.current[rec.id] = el; }}
                  src={rec.fileUrl}
                  onEnded={() => setPlayingId(null)}
                  style={{ display: 'none' }}
                />

                {/* Visible audio player for scrubbing */}
                <audio
                  src={rec.fileUrl}
                  controls
                  style={{ width: '100%', marginTop: '8px', height: '32px', accentColor: GOLD, filter: 'invert(0)' }}
                  onPlay={() => setPlayingId(rec.id)}
                  onPause={() => { if (playingId === rec.id) setPlayingId(null); }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {!rec.isLocal && (
                  <a href={rec.fileUrl} download={`${rec.label}.webm`}
                    style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '11px', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                    ↓
                  </a>
                )}
                <button
                  onClick={() => { if (window.confirm('Delete this recording?')) deleteRecording(rec.id); }}
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '11px' }}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}