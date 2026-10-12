import React from 'react';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '7px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function AIAgentTelephonySection({ config, update, availableLines }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
      {/* Twilio Line */}
      <div>
        <label style={ls}>Twilio Line (AI Agent answers inbound on this line)</label>
        <select value={config.twilioLineKey || ''} onChange={e => update('twilioLineKey', e.target.value)} style={inp}>
          <option value="">— Select a line —</option>
          {(availableLines || []).map(l => (
            <option key={l.key} value={l.key}>{l.label || l.key} ({l.number})</option>
          ))}
        </select>
      </div>

      {/* Transfer Number */}
      <div>
        <label style={ls}>Transfer Target (Chris Bongiorno)</label>
        <input value={config.transferPhoneNumber || ''} onChange={e => update('transferPhoneNumber', e.target.value)} style={inp} placeholder="6192224232" />
      </div>

      {/* Queue Timeout */}
      <div>
        <label style={ls}>Queue Wait Timeout (seconds)</label>
        <input type="number" value={config.queueTimeoutSeconds ?? 90} onChange={e => update('queueTimeoutSeconds', Number(e.target.value))} style={inp} />
      </div>

      {/* Callback booking */}
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '7px 0' }}>
          <input type="checkbox" checked={config.callbackBookingEnabled !== false} onChange={e => update('callbackBookingEnabled', e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
          <span style={{ color: '#e8e0d0', fontSize: '12px' }}>Auto-book callback in Chris's calendar on transfer failure</span>
        </label>
      </div>

      {/* Pre-transfer email */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" checked={config.preTransferEmailEnabled !== false} onChange={e => update('preTransferEmailEnabled', e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
          <span style={{ color: '#e8e0d0', fontSize: '12px' }}>Send pre-transfer credential email (DAA credentials, BBB, Ethics Award) when email is confirmed</span>
        </label>
      </div>
    </div>
  );
}