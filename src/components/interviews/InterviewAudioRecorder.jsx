/**
 * InterviewAudioRecorder.jsx — Audio recording for interviews.
 * Two modes:
 * 1. Live recording via microphone (getUserMedia + MediaRecorder)
 * 2. File upload (for iOS screen-recorded Telegram calls)
 * The recording is uploaded to private storage and the file URI is passed
 * back to the parent via onAudioReady.
 */
import { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const BLUE = '#60a5fa';

function getSupportedMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const type of types) {
    try { if (MediaRecorder.isTypeSupported(type)) return type; } catch {}
  }
  return '';
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function InterviewAudioRecorder({ onAudioReady, candidateName }) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [audioUri, setAudioUri] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = getSupportedMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = handleStop;
      mr.start(1000); // collect data every second
      mediaRecorderRef.current = mr;
      setRecording(true);
      setPaused(false);
      setSeconds(0);
      setAudioUri('');
      setAudioUrl('');
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (e) {
      setError('Microphone access failed: ' + (e?.message || String(e)) + '. On iPhone, if Telegram is using the mic, use iOS screen recording and upload the file instead.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setPaused(false);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    setPaused(false);
  };

  const handleStop = useCallback(async () => {
    setUploading(true);
    try {
      const mime = mediaRecorderRef.current?.mimeType || 'audio/webm';
      const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm';
      const blob = new Blob(chunksRef.current, { type: mime });
      const safeName = (candidateName || 'candidate').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `interview_${safeName}_${Date.now()}.${ext}`;
      const file = new File([blob], fileName, { type: mime });
      const result = await base44.integrations.Core.UploadPrivateFile({ file });
      const uri = result.file_uri || result.file_url;
      setAudioUri(uri);
      onAudioReady?.(uri);
      // Get a signed URL for playback
      try {
        const signed = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri });
        setAudioUrl(signed.signed_url || signed.url || '');
      } catch {}
    } catch (e) {
      setError('Upload failed: ' + (e?.message || String(e)));
    }
    setUploading(false);
  }, [candidateName, onAudioReady]);

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const result = await base44.integrations.Core.UploadPrivateFile({ file });
      const uri = result.file_uri || result.file_url;
      setAudioUri(uri);
      onAudioReady?.(uri);
      try {
        const signed = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri });
        setAudioUrl(signed.signed_url || signed.url || '');
      } catch {}
    } catch (e) {
      setError('Upload failed: ' + (e?.message || String(e)));
    }
    setUploading(false);
  };

  const removeAudio = () => {
    setAudioUri('');
    setAudioUrl('');
    onAudioReady?.('');
  };

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9000, background: 'rgba(10,15,30,0.97)', borderTop: '1px solid rgba(16,185,129,0.2)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontFamily: 'Georgia, serif', backdropFilter: 'blur(8px)' }}>
      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <span style={{ fontSize: '16px' }}>🎙️</span>
        <span style={{ color: GOLD, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Interview Audio</span>
      </div>

      {/* Recording timer / status */}
      {recording && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#001a0a', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '4px 12px' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: RED, animation: 'pulse 1s infinite' }} />
          <span style={{ color: RED, fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>{fmtTime(seconds)}</span>
          <span style={{ color: '#6b7280', fontSize: '9px' }}>{paused ? '⏸ PAUSED' : '● REC'}</span>
        </div>
      )}

      {/* Recording controls */}
      {!recording && !audioUri && !uploading && (
        <>
          <button onClick={startRecording} style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>● Start Recording</button>
          <button onClick={() => fileInputRef.current?.click()} style={{ background: 'rgba(96,165,250,0.15)', color: BLUE, border: '1px solid rgba(96,165,250,0.3)', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>📁 Upload File</button>
          <input ref={fileInputRef} type="file" accept="audio/*,video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }} />
        </>
      )}

      {/* Pause/Resume/Stop controls */}
      {recording && (
        <>
          {paused ? (
            <button onClick={resumeRecording} style={{ background: 'rgba(16,185,129,0.15)', color: GOLD, border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>▶ Resume</button>
          ) : (
            <button onClick={pauseRecording} style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>⏸ Pause</button>
          )}
          <button onClick={stopRecording} style={{ background: 'rgba(239,68,68,0.15)', color: RED, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>⏹ Stop & Save</button>
        </>
      )}

      {/* Uploading */}
      {uploading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: GOLD, fontSize: '12px' }}>
          <div style={{ width: 14, height: 14, border: '2px solid rgba(16,185,129,0.3)', borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Uploading…
        </div>
      )}

      {/* Audio saved */}
      {audioUri && !uploading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold' }}>✓ Audio Saved</span>
          {audioUrl && <audio controls src={audioUrl} style={{ height: '28px', maxWidth: '250px' }} />}
          <button onClick={removeAudio} style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: '14px' }}>✕ Remove</button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ color: RED, fontSize: '11px', flex: '1 1 100%', marginTop: '4px' }}>{error}</div>
      )}

      {/* Tip */}
      {!recording && !audioUri && !uploading && (
        <div style={{ color: '#6b7280', fontSize: '10px', marginLeft: 'auto', textAlign: 'right', maxWidth: '300px' }}>
          💡 iPhone tip: Use iOS screen recording to capture the Telegram call, then upload the file here.
        </div>
      )}
    </div>
  );
}