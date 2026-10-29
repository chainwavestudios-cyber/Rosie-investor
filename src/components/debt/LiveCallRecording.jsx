export default function LiveCallRecording({ phase, recorder, onRecord }) {
  if (phase !== 'live') return null;
  return <>
    <button onClick={onRecord} title={recorder.isRecording ? 'Stop recording the call audio' : 'Record the call audio (agent + customer)'} style={{ padding: '8px 14px', borderRadius: 4, border: `1px solid ${recorder.isRecording ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.3)'}`, background: recorder.isRecording ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 11, fontWeight: 'bold', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, animation: recorder.isRecording ? 'pulse 1.5s infinite' : 'none' }}>{recorder.isRecording ? '⏹ Stop Recording' : '● Record Call'}</button>
    {recorder.recordingError && <span style={{ color: '#ef4444', fontSize: 10 }}>⚠ {recorder.recordingError}</span>}
  </>;
}