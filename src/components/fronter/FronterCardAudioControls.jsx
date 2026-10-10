/**
 * FronterCardAudioControls.jsx — Compact audio controls for the contact card.
 * Mic select, speaker select, volume slider, and test button.
 */
import { useState, useEffect, useRef } from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' };
const sel = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '5px 8px', color: '#e8e0d0', fontSize: '10px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif', cursor: 'pointer' };

export default function FronterCardAudioControls() {
  const [micDevices, setMicDevices] = useState([]);
  const [speakerDevices, setSpeakerDevices] = useState([]);
  const [selectedMic, setSelectedMic] = useState(localStorage.getItem('fronter_mic') || '');
  const [selectedSpeaker, setSelectedSpeaker] = useState(localStorage.getItem('fronter_speaker') || '');
  const [micVol, setMicVol] = useState(100);
  const [vol, setVol] = useState(100);
  const [testing, setTesting] = useState(false);
  const testAudioRef = useRef(null);
  const testStreamRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Request permission first
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        setMicDevices(devices.filter(d => d.kind === 'audioinput'));
        setSpeakerDevices(devices.filter(d => d.kind === 'audiooutput'));
      } catch {}
    };
    load();
  }, []);

  const saveMic = (id) => { setSelectedMic(id); localStorage.setItem('fronter_mic', id); };
  const saveSpeaker = (id) => { setSelectedSpeaker(id); localStorage.setItem('fronter_speaker', id); };

  const testAudio = async () => {
    if (testing) {
      // Stop test
      if (testStreamRef.current) { testStreamRef.current.getTracks().forEach(t => t.stop()); testStreamRef.current = null; }
      if (testAudioRef.current) { testAudioRef.current.pause(); testAudioRef.current = null; }
      setTesting(false);
      return;
    }
    try {
      setTesting(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selectedMic ? { exact: selectedMic } : undefined },
      });
      testStreamRef.current = stream;
      const audio = new Audio();
      audio.srcObject = stream;
      audio.volume = vol / 100;
      if (selectedSpeaker && audio.setSinkId) { try { await audio.setSinkId(selectedSpeaker); } catch {} }
      await audio.play();
      testAudioRef.current = audio;
      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (testStreamRef.current) { testStreamRef.current.getTracks().forEach(t => t.stop()); testStreamRef.current = null; }
        if (testAudioRef.current) { testAudioRef.current.pause(); testAudioRef.current = null; }
        setTesting(false);
      }, 5000);
    } catch (e) { setTesting(false); }
  };

  useEffect(() => {
    return () => {
      if (testStreamRef.current) testStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '10px', marginBottom: '12px' }}>
      <div style={{ color: GOLD, fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>🎙 Audio Controls</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <div>
          <label style={ls}>Microphone</label>
          <select value={selectedMic} onChange={e => saveMic(e.target.value)} style={sel}>
            <option value="">Default</option>
            {micDevices.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || `Mic ${m.deviceId.slice(0, 6)}`}</option>)}
          </select>
        </div>
        <div>
          <label style={ls}>Speaker</label>
          <select value={selectedSpeaker} onChange={e => saveSpeaker(e.target.value)} style={sel}>
            <option value="">Default</option>
            {speakerDevices.map(s => <option key={s.deviceId} value={s.deviceId}>{s.label || `Speaker ${s.deviceId.slice(0, 6)}`}</option>)}
          </select>
        </div>
      </div>
      {/* Volume sliders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <div>
          <label style={ls}>Mic Vol: {micVol}%</label>
          <input type="range" min={0} max={100} value={micVol} onChange={e => setMicVol(Number(e.target.value))} style={{ width: '100%', accentColor: GOLD, cursor: 'pointer' }} />
        </div>
        <div>
          <label style={ls}>Volume: {vol}%</label>
          <input type="range" min={0} max={100} value={vol} onChange={e => setVol(Number(e.target.value))} style={{ width: '100%', accentColor: GOLD, cursor: 'pointer' }} />
        </div>
      </div>
      {/* Test + Save buttons */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={testAudio} style={{ flex: 1, background: testing ? 'rgba(239,68,68,0.15)' : `${GOLD}18`, color: testing ? '#ef4444' : GOLD, border: `1px solid ${testing ? 'rgba(239,68,68,0.3)' : GOLD + '44'}`, borderRadius: '3px', padding: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
          {testing ? '⏹ Stop' : '▶ Test'}
        </button>
        <button onClick={() => { localStorage.setItem('fronter_mic', selectedMic); localStorage.setItem('fronter_speaker', selectedSpeaker); }} style={{ flex: 1, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '3px', padding: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>★ Save Default</button>
      </div>
    </div>
  );
}