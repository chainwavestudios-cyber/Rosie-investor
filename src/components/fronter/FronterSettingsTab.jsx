/**
 * FronterSettingsTab.jsx — Mic and audio output device selection + hardware test.
 * Stores selected device IDs in localStorage for the dialer and Deepgram to use.
 */
import { useState, useEffect, useRef } from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function FronterSettingsTab() {
  const [mics, setMics] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [selectedMic, setSelectedMic] = useState(localStorage.getItem('fronter_mic_device') || '');
  const [selectedSpeaker, setSelectedSpeaker] = useState(localStorage.getItem('fronter_speaker_device') || '');
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState('');
  const [recordingUrl, setRecordingUrl] = useState(null);
  const mediaRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const refreshDevices = async () => {
    try {
      // Trigger permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMics(devices.filter(d => d.kind === 'audioinput'));
      setSpeakers(devices.filter(d => d.kind === 'audiooutput'));
    } catch (e) {
      setTestStatus('⚠ Microphone permission denied. Allow access and try again.');
    }
  };

  useEffect(() => { refreshDevices(); }, []);

  const saveMic = (id) => {
    setSelectedMic(id);
    localStorage.setItem('fronter_mic_device', id);
  };
  const saveSpeaker = (id) => {
    setSelectedSpeaker(id);
    localStorage.setItem('fronter_speaker_device', id);
  };

  const testHardware = async () => {
    setTesting(true);
    setTestStatus('🔴 Recording 5 seconds…');
    setRecordingUrl(null);
    chunksRef.current = [];
    try {
      const constraints = { audio: selectedMic ? { deviceId: { exact: selectedMic } } : true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
        setTestStatus('✅ Recording complete — press play to hear it through your selected speaker');
        stream.getTracks().forEach(t => t.stop());
        setTesting(false);
      };
      recorder.start();
      setTimeout(() => { try { recorder.stop(); } catch {} }, 5000);
    } catch (e) {
      setTestStatus('⚠ Failed to access microphone: ' + (e?.message || String(e)));
      setTesting(false);
    }
  };

  const playTest = () => {
    if (!recordingUrl) return;
    const audio = new Audio(recordingUrl);
    if (selectedSpeaker && audio.setSinkId) {
      audio.setSinkId(selectedSpeaker).catch(() => {});
    }
    audio.play();
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '14px' }}>🔧 Audio Settings</div>

      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '18px', marginBottom: '14px' }}>
        {/* Mic */}
        <div style={{ marginBottom: '16px' }}>
          <label style={ls}>🎤 Microphone (Input)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={selectedMic} onChange={e => saveMic(e.target.value)} style={inp}>
              <option value="">— System Default —</option>
              {mics.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || `Microphone ${m.deviceId.slice(0, 8)}`}</option>)}
            </select>
            <button onClick={refreshDevices} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '0 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>↻ Refresh</button>
          </div>
        </div>

        {/* Speaker */}
        <div style={{ marginBottom: '16px' }}>
          <label style={ls}>🔊 Audio Output (Speaker)</label>
          <select value={selectedSpeaker} onChange={e => saveSpeaker(e.target.value)} style={inp}>
            <option value="">— System Default —</option>
            {speakers.map(s => <option key={s.deviceId} value={s.deviceId}>{s.label || `Speaker ${s.deviceId.slice(0, 8)}`}</option>)}
          </select>
          {!('setSinkId' in HTMLMediaElement.prototype) && (
            <div style={{ color: '#f59e0b', fontSize: '10px', marginTop: '4px' }}>⚠ Your browser does not support speaker selection. The system default will be used.</div>
          )}
        </div>

        {/* Test */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '14px' }}>
          <label style={ls}>Hardware Test</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={testHardware} disabled={testing} style={{ background: testing ? 'rgba(239,68,68,0.15)' : `${GOLD}18`, color: testing ? '#ef4444' : GOLD, border: `1px solid ${testing ? 'rgba(239,68,68,0.3)' : GOLD + '44'}`, borderRadius: '4px', padding: '10px 20px', cursor: testing ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
              {testing ? '🔴 Recording…' : '🎤 Test Mic (5s)'}
            </button>
            {recordingUrl && (
              <button onClick={playTest} style={{ background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '4px', padding: '10px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>▶ Play Back</button>
            )}
          </div>
          {testStatus && <div style={{ color: '#8a9ab8', fontSize: '11px', marginTop: '8px' }}>{testStatus}</div>}
        </div>
      </div>

      <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', color: '#6b7280', fontSize: '11px' }}>
        💡 These settings are used for live call transcription and call audio. The selected mic captures your voice for Deepgram transcription, and the selected speaker is where you'll hear the caller.
      </div>
    </div>
  );
}