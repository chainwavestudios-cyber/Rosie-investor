/**
 * VoiceLoginPanel.jsx — Voice-based login / enrollment for the Debt Coach portal.
 * Shows a random challenge phrase, records the user saying it, and sends the
 * audio to the backend for transcription verification + voice biometric comparison.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '12px 16px', color: '#e8e0d0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const PHRASES = [
  'The quick brown fox jumps over the lazy dog',
  'Settlement IQ helps families get out of debt',
  'Financial freedom starts with a single phone call',
  'The best time to take action is right now',
  'Every journey toward freedom begins today',
  'Working together we can solve any problem',
  'The sun always shines after a heavy rain',
  'I am ready to help people find financial peace',
  'A fresh start is just one decision away',
  'Tomorrow belongs to those who prepare today',
];

function randomPhrase() {
  return PHRASES[Math.floor(Math.random() * PHRASES.length)];
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

export default function VoiceLoginPanel({ mode, onLogin, onEnroll, onClose }) {
  // mode: 'login' | 'enroll'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [recording, setRecording] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioBlobRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    setPhrase(randomPhrase());
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(''); setHasAudio(false); setStatus('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        audioBlobRef.current = new Blob(chunksRef.current, { type: 'audio/webm' });
        setHasAudio(true);
        streamRef.current.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      setError('Microphone access denied. Please allow microphone access and try again.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!username.trim()) { setError('Enter your username first.'); return; }
    if (!audioBlobRef.current) { setError('Record yourself saying the phrase first.'); return; }
    if (mode === 'enroll' && !password) { setError('Enter your password to verify identity.'); return; }
    setProcessing(true); setError(''); setStatus(mode === 'enroll' ? 'Verifying and saving voiceprint…' : 'Analyzing your voice…');
    try {
      const audioBase64 = await blobToBase64(audioBlobRef.current);
      if (mode === 'enroll') {
        await onEnroll(username.trim().toLowerCase(), password, audioBase64, phrase);
        setStatus('✓ Voice enrolled! You can now use voice login.');
        setHasAudio(false); audioBlobRef.current = null;
      } else {
        await onLogin(username.trim().toLowerCase(), audioBase64, phrase);
      }
    } catch (e) {
      setError(e?.message || String(e));
      setStatus('');
    }
    setProcessing(false);
  }, [username, password, phrase, mode, onLogin, onEnroll]);

  const resetPhrase = () => { setPhrase(randomPhrase()); setHasAudio(false); audioBlobRef.current = null; };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold' }}>
        {mode === 'enroll' ? '🎙️ Enroll Your Voice' : '🎙️ Voice Login'}
      </div>
      <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>
        {mode === 'enroll'
          ? 'Verify your identity with your password, then record a voice sample. After this, you can log in just by speaking.'
          : 'Say the phrase below to sign in — no password needed.'}
      </div>

      <div>
        <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Username</label>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" style={inp} autoFocus />
      </div>

      {mode === 'enroll' && (
        <div>
          <label style={{ display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Password (verify identity)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" style={inp} />
        </div>
      )}

      {/* Random challenge phrase */}
      <div style={{ background: 'rgba(16,185,129,0.08)', border: `1px solid ${GOLD}33`, borderRadius: '6px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 'bold' }}>Say this phrase</span>
          <button onClick={resetPhrase} disabled={recording || processing} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8a9ab8', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px', opacity: recording || processing ? 0.4 : 1 }}>↻ New phrase</button>
        </div>
        <div style={{ color: '#e8e0d0', fontSize: '15px', lineHeight: 1.5, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>"{phrase}"</div>
      </div>

      {/* Record button */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        {!recording ? (
          <button onClick={startRecording} disabled={processing} style={{ flex: 1, background: hasAudio ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#ef4444,#dc2626)', color: hasAudio ? '#8a9ab8' : '#fff', border: 'none', borderRadius: '4px', padding: '12px', cursor: processing ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: processing ? 0.5 : 1 }}>
            {hasAudio ? '🎤 Re-record' : '🔴 Record'}
          </button>
        ) : (
          <button onClick={stopRecording} style={{ flex: 1, background: 'rgba(239,68,68,0.2)', color: RED, border: `1px solid ${RED}44`, borderRadius: '4px', padding: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', animation: 'pulse 1s infinite' }}>
            ⏹ Stop Recording
          </button>
        )}
      </div>

      {recording && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: RED, fontSize: '12px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: RED, animation: 'pulse 1s infinite' }} />
          Listening… speak the phrase clearly
        </div>
      )}
      {hasAudio && !recording && (
        <div style={{ color: GOLD, fontSize: '11px' }}>✓ Recorded — click {mode === 'enroll' ? 'Enroll Voice' : 'Sign In'} to continue</div>
      )}

      {error && <div style={{ color: RED, fontSize: '12px' }}>⚠ {error}</div>}
      {status && <div style={{ color: GOLD, fontSize: '12px' }}>{status}</div>}

      <button onClick={handleSubmit} disabled={processing || !hasAudio || !username.trim()} style={{ width: '100%', background: processing ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#10b981,#22c55e)', color: processing ? '#6b7280' : DARK, border: 'none', borderRadius: '4px', padding: '12px', cursor: processing ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: (!hasAudio || !username.trim() || processing) ? 0.5 : 1 }}>
        {processing ? '⏳ Analyzing…' : mode === 'enroll' ? 'Enroll Voice' : 'Sign In with Voice'}
      </button>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}