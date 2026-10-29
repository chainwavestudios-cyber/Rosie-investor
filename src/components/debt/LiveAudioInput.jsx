const labelStyle = { display: 'block', color: '#8a9ab8', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 0 };
const inputStyle = { width: '100%', minWidth: 220, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '8px 12px', color: '#e8e0d0', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };
export default function LiveAudioInput({ customer = false, devices, value, onChange, gain, onGainChange, testing, onTest, disabled, onScan }) {
  const color = customer ? '#f59e0b' : '#60a5fa';
  const unavailable = disabled || !value;
  // Voicemeeter Out A1..A5 and CABLE Input are playback buses: they only carry
  // audio routed to that output, so picking one as a microphone meters flat.
  const selectedLabel = devices.find(d => d.deviceId === value)?.label || '';
  const outputBus = /voicemeeter out [ab]\d|cable input|speakers|headphones/i.test(selectedLabel);
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <label style={labelStyle}>{customer ? 'Customer Audio' : 'Agent Mic'}</label>
      {onScan && <button type="button" aria-label={customer ? 'Refresh customer inputs' : 'Refresh agent inputs'} onClick={onScan} disabled={disabled || testing} title="Refresh browser audio devices" style={{ background: 'transparent', border: 'none', color: '#8a9ab8', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 11, padding: 0 }}>🔄</button>}
    </div>
    <select aria-label={customer ? 'Customer audio input' : 'Agent microphone'} value={value} onChange={e => onChange(e.target.value)} disabled={disabled || testing} style={{ ...inputStyle, cursor: 'pointer' }}>
      <option value="">{customer ? '— None (use diarization) —' : '— Select agent microphone —'}</option>
      {devices.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || `Input ${device.deviceId.slice(0, 6)}`}</option>)}
    </select>
    {outputBus && <span style={{ color: '#f59e0b', fontSize: 10, lineHeight: 1.35 }}>That is a playback bus, not a recording device — it stays silent unless audio is routed to it. Pick the actual microphone, or a “Voicemeeter Out B1/B2”.</span>}

    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: '#6b7280', fontSize: 9, whiteSpace: 'nowrap' }}>Gain</span>
      <input aria-label={customer ? 'Customer input gain' : 'Agent input gain'} type="range" min="0" max="3" step="0.1" value={gain} onChange={e => onGainChange(Number(e.target.value))} disabled={unavailable} style={{ flex: 1, cursor: 'pointer', accentColor: color, opacity: unavailable ? 0.4 : 1 }} />
      <span style={{ color, fontSize: 9, fontWeight: 'bold', minWidth: 28 }}>{Math.round(gain * 100)}%</span>
      <button type="button" aria-label={customer ? (testing ? 'Stop customer audio test' : 'Test customer audio') : (testing ? 'Stop agent audio test' : 'Test agent audio')} onClick={onTest} disabled={unavailable} title={customer ? 'Test customer input only' : 'Test agent mic only'} style={{ background: testing ? `${color}18` : 'rgba(255,255,255,0.05)', color: testing ? color : '#8a9ab8', border: `1px solid ${testing ? color + '44' : 'rgba(255,255,255,0.12)'}`, borderRadius: 4, padding: '4px 8px', cursor: unavailable ? 'not-allowed' : 'pointer', fontSize: 9, fontWeight: 'bold', whiteSpace: 'nowrap', opacity: unavailable ? 0.5 : 1 }}>{testing ? '⏹ Stop' : '🔊 Test'}</button>
    </div>
  </div>;
}