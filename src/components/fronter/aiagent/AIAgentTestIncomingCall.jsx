/**
 * AIAgentTestIncomingCall.jsx — Rings the admin's own phone through the live
 * incoming-call path, so the greeting pipeline and Adam handoff can be heard
 * without needing an outside phone to call the business line.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import callError from '@/components/fronter/callError';

const GOLD = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const GREEN = '#4ade80';

const FIELD = { width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '9px 11px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function AIAgentTestIncomingCall({ config }) {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const ring = async () => {
    if (!phone.trim() || sending) return;
    setSending(true);
    setError('');
    setResult(null);
    try {
      const res = await base44.functions.invoke('testInboundCall', { phone: phone.trim() });
      const data = res?.data || res;
      if (data?.ok) setResult(data);
      else setError(data?.error || 'Test call failed');
    } catch (e) {
      setError(callError(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ background: 'rgba(16,185,129,0.06)', border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '14px', marginBottom: '14px' }}>
      <label style={{ display: 'block', color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>🔊 Test an incoming call</label>
      <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.6, marginBottom: '10px' }}>
        Your phone rings from the agent's own line and the call runs the real incoming path — caller-ID lookup, the intro clips, then Adam taking over. It creates a contact card for the number you enter, exactly like a real caller would.
      </div>

      {!config?.twilioLineKey && (
        <div style={{ color: AMBER, fontSize: '11px', marginBottom: '8px' }}>
          ⚠ No agent line is set yet — choose it under Agent Configuration before testing.
        </div>
      )}
      {config?.twilioLineKey && config?.isActive === false && (
        <div style={{ color: AMBER, fontSize: '11px', marginBottom: '8px' }}>
          ⚠ The AI agent is currently switched off, so a test call will ring a fronter rather than Adam.
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') ring(); }}
          placeholder="Your cell, e.g. (619) 555-0134"
          style={{ ...FIELD, flex: '1 1 220px', minWidth: '180px' }}
        />
        <button
          onClick={ring}
          disabled={sending || !phone.trim()}
          style={{
            background: sending || !phone.trim() ? 'rgba(16,185,129,0.25)' : GOLD,
            color: sending || !phone.trim() ? '#8a9ab8' : '#0a0f1e',
            border: 'none', borderRadius: '4px', padding: '9px 16px',
            cursor: sending || !phone.trim() ? 'not-allowed' : 'pointer',
            fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap',
          }}
        >
          {sending ? '📞 Placing call…' : '📞 Ring my phone'}
        </button>
      </div>

      {result && (
        <div style={{ color: GREEN, fontSize: '11px', marginTop: '10px' }}>
          ✓ {result.message}
        </div>
      )}
      {error && (
        <div style={{ color: RED, fontSize: '11px', marginTop: '10px' }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}