const labelStyle = { display: 'block', color: '#8a9ab8', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 0 };
const inputStyle = { width: '100%', minWidth: 220, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '8px 12px', color: '#e8e0d0', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };
import { CHANNEL_LABELS } from '@/lib/audioChannels';
export default function LiveAudioInput({ customer = false, devices, value, onChange, gain, onGainChange, testing, onTest, disabled, onScan, inputCount, channel = 0, onChannelChange, children }) {
  const color = customer ? '#f59e0b' : '#60a5fa';
  const unavailable = disabled || (customer && !value);
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <label style={labelStyle}>{customer ? '🎧 Customer Audio (Split Input)' : '🎙 Agent Mic'}</label>
      {onScan && <button type="button" onClick={onScan} disabled={disabled || testing} title="Re-scan inputs and request microphone access if needed" style={{ background: 'transparent', border: 'none', color: '#8a9ab8', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 11, padding: 0 }}>🔄</button>}
      {customer && inputCount > 0 && <span style={{ color: '#4a5568', fontSize: 9 }}>{inputCount} input{inputCount === 1 ? '' : 's'}</span>}
    </div>
    <select aria-label={customer ? 'Customer audio input' : 'Agent microphone'} value={value} onChange={e => onChange(e.target.value)} disabled={disabled || testing} style={{ ...inputStyle, cursor: 'pointer' }}>
      <option value="">{customer ? '— None (use diarization) —' : '— Select agent microphone —'}</option>
      {devices.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || `Input ${device.deviceId.slice(0, 6)}`}</option>)}
    </select>
    {onChannelChange && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: '#d4ba83', fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>USB CHANNEL</span>
      <select aria-label={customer ? 'Customer input track' : 'Agent input track'} value={channel} onChange={e => onChannelChange(Number(e.target.value))} disabled={disabled || testing || !value} title="Multichannel inputs (RØDECaster) keep the isolated channels as tracks inside one device" style={{ ...inputStyle, minWidth: 0, flex: 1, padding: '5px 8px', fontSize: 11 }}>
        {CHANNEL_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
      </select>
    </div>}
    {children}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: '#6b7280', fontSize: 9, whiteSpace: 'nowrap' }}>Gain</span>
      <input aria-label={customer ? 'Customer input gain' : 'Agent input gain'} type="range" min="0" max="3" step="0.1" value={gain} onChange={e => onGainChange(Number(e.target.value))} disabled={unavailable} style={{ flex: 1, cursor: 'pointer', accentColor: color, opacity: unavailable ? 0.4 : 1 }} />
      <span style={{ color, fontSize: 9, fontWeight: 'bold', minWidth: 28 }}>{Math.round(gain * 100)}%</span>
      <button onClick={onTest} disabled={unavailable} title={customer ? 'Test customer input only' : 'Test agent mic only'} style={{ background: testing ? `${color}18` : 'rgba(255,255,255,0.05)', color: testing ? color : '#8a9ab8', border: `1px solid ${testing ? color + '44' : 'rgba(255,255,255,0.12)'}`, borderRadius: 4, padding: '4px 8px', cursor: unavailable ? 'not-allowed' : 'pointer', fontSize: 9, fontWeight: 'bold', whiteSpace: 'nowrap', opacity: unavailable ? 0.5 : 1 }}>{testing ? '⏹ Stop' : '🔊 Test'}</button>
    </div>
  </div>;
}