/**
 * FronterMonitorAIAgent.jsx — AI Agent status card for the Fronter Monitor.
 * Shows live status, line, transfer target, pipeline models, KBs, and a quick toggle.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const AMBER = '#f59e0b';

const ls = { display: 'block', color: '#6b7280', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' };
const val = { color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold', fontFamily: 'Georgia, serif' };

export default function FronterMonitorAIAgent({ adminUsername }) {
  const [config, setConfig] = useState(null);
  const [availableLines, setAvailableLines] = useState([]);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [existing, linesRes] = await Promise.all([
        base44.entities.AIAgentConfig.filter({ configName: 'default' }),
        base44.functions.invoke('twilioGetLines', {}),
      ]);
      setConfig(existing?.[0] || null);
      setAvailableLines(linesRes?.data?.lines || linesRes?.lines || []);
    } catch (e) { setError('Failed to load agent config'); }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const toggleActive = async () => {
    if (!config) return;
    if (!config.twilioLineKey) { alert('Select a Twilio line in the AI Agent tab before activating.'); return; }
    setToggling(true); setError('');
    try {
      const next = !config.isActive;
      const payload = { ...config, isActive: next, updatedBy: adminUsername, updated_date: new Date().toISOString() };
      await base44.entities.AIAgentConfig.update(config.id, payload);
      setConfig({ ...config, isActive: next });
    } catch (e) { setError('Toggle failed: ' + (e?.message || String(e))); }
    setToggling(false);
  };

  if (!config) {
    return <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>Loading AI Agent status…</div>;
  }

  const isActive = config.isActive;
  const line = availableLines.find(l => l.key === config.twilioLineKey);
  const lineNumber = line?.number || config.twilioLineKey || '—';

  return (
    <div style={{ padding: '14px', overflowY: 'auto', height: '100%' }}>
      {error && <div style={{ color: RED, fontSize: '11px', marginBottom: '10px' }}>⚠ {error}</div>}

      {/* Status banner */}
      <div style={{ background: isActive ? 'rgba(16,185,129,0.08)' : 'rgba(107,114,128,0.08)', border: `1px solid ${isActive ? 'rgba(16,185,129,0.25)' : 'rgba(107,114,128,0.2)'}`, borderRadius: '6px', padding: '14px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: isActive ? GOLD : '#6b7280', animation: isActive ? 'pulse 1.5s infinite' : 'none', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: isActive ? GOLD : '#8a9ab8', fontSize: '16px', fontWeight: 'bold' }}>{isActive ? '🤖 AGENT LIVE' : '⏸ Agent Inactive'}</div>
          <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
            {isActive ? `Answering inbound calls on ${lineNumber}` : 'Not currently answering calls'}
          </div>
        </div>
        <button
          onClick={toggleActive}
          disabled={toggling}
          style={{
            background: isActive ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
            color: isActive ? RED : GOLD,
            border: `1px solid ${isActive ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
            borderRadius: '4px', padding: '8px 18px', cursor: toggling ? 'not-allowed' : 'pointer',
            fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap',
          }}
        >
          {toggling ? '⏳…' : isActive ? '⏸ Deactivate' : '▶ Activate'}
        </button>
      </div>

      {/* Config grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {/* Telephony */}
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '12px' }}>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid rgba(16,185,129,0.15)', paddingBottom: '4px' }}>📞 Telephony</div>
          <div style={{ marginBottom: '8px' }}><label style={ls}>Twilio Line</label><div style={val}>{lineNumber}</div></div>
          <div style={{ marginBottom: '8px' }}><label style={ls}>Transfer Target</label><div style={val}>{config.transferPhoneNumber || '—'}</div></div>
          <div><label style={ls}>Queue Timeout</label><div style={val}>{config.queueTimeoutSeconds || 90}s</div></div>
        </div>

        {/* Voice Pipeline */}
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '12px' }}>
          <div style={{ color: BLUE, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid rgba(96,165,250,0.15)', paddingBottom: '4px' }}>🎙 Voice Pipeline</div>
          <div style={{ marginBottom: '8px' }}><label style={ls}>STT Engine</label><div style={val}>{config.sttEngine || '—'}</div></div>
          <div style={{ marginBottom: '8px' }}><label style={ls}>TTS Engine</label><div style={val}>{config.ttsEngine || '—'}</div></div>
          <div style={{ marginBottom: '8px' }}><label style={ls}>TTS Voice</label><div style={{ val, fontSize: '11px' }}>{config.ttsVoiceModel || '—'}</div></div>
          <div><label style={ls}>LLM Model</label><div style={val}>{config.llmModel || '—'}</div></div>
        </div>

        {/* Knowledge Bases */}
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '12px' }}>
          <div style={{ color: PURPLE, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid rgba(167,139,250,0.15)', paddingBottom: '4px' }}>📚 Knowledge Bases</div>
          <div style={{ marginBottom: '8px' }}><label style={ls}>Primary KB</label><div style={val}>{config.kbPrimary || '—'}</div></div>
          <div><label style={ls}>Secondary KB</label><div style={val}>{config.kbSecondary || '—'}</div></div>
        </div>

        {/* Automation */}
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '12px' }}>
          <div style={{ color: AMBER, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid rgba(245,158,11,0.15)', paddingBottom: '4px' }}>⚙️ Automation</div>
          <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: config.callbackBookingEnabled ? GOLD : '#4a5568' }} />
            <span style={{ color: config.callbackBookingEnabled ? '#e8e0d0' : '#6b7280', fontSize: '11px' }}>Callback Booking</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: config.preTransferEmailEnabled ? GOLD : '#4a5568' }} />
            <span style={{ color: config.preTransferEmailEnabled ? '#e8e0d0' : '#6b7280', fontSize: '11px' }}>Pre-Transfer Email</span>
          </div>
        </div>
      </div>

      {/* Last updated */}
      {config.updatedBy && (
        <div style={{ color: '#4a5568', fontSize: '10px', textAlign: 'center', marginTop: '12px' }}>
          Last updated by {config.updatedBy}
        </div>
      )}
    </div>
  );
}