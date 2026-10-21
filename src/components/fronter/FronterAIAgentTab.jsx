/**
 * FronterAIAgentTab.jsx — Superadmin-only configuration workbench for the
 * AI Fronting Agent. Controls telephony, voice pipeline, knowledge bases,
 * and the full prompt/script tuning workbench. Configuration is stored as a
 * singleton in the AIAgentConfig entity.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import AIAgentTelephonySection from './aiagent/AIAgentTelephonySection';
import AIAgentVoiceSection from './aiagent/AIAgentVoiceSection';
import AIAgentKnowledgeSection from './aiagent/AIAgentKnowledgeSection';
import AIAgentPromptSection, { DEFAULT_GREETING, DEFAULT_SYSTEM_PROMPT, DEFAULT_SCRIPT_FLOW, DEFAULT_REBUTTALS, DEFAULT_QA_TUNING } from './aiagent/AIAgentPromptSection';
import AIAgentDialer from './AIAgentDialer';
import AIAgentLiveConfig from './aiagent/AIAgentLiveConfig';
import AIAgentIncomingCallsTab from './aiagent/AIAgentIncomingCallsTab';
import AIAgentScriptBuilderSection from './aiagent/AIAgentScriptBuilderSection';
import useAIAgentPipeline from '@/hooks/useAIAgentPipeline';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const BLUE = '#60a5fa';

const SECTIONS = [
  { id: 'config', label: '⚙️ Agent Configuration' },
  { id: 'incoming', label: '📞 Incoming Calls' },
  { id: 'builder', label: '🧠 AI Script Builder' },
];

const SECTION_LABEL = { display: 'block', color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '4px', borderBottom: '1px solid rgba(16,185,129,0.15)' };

function defaultConfig() {
  return {
    configName: 'default',
    isActive: false,
    twilioLineKey: '',
    transferPhoneNumber: '6192224232',
    queueTimeoutSeconds: 90,
    sttEngine: 'deepgram-nova-2',
    ttsEngine: 'deepgram-aura',
    ttsVoiceModel: 'aura-2-thalia-en',
    llmModel: 'automatic',
    ttsSynthesisModel: 'eleven_turbo_v2_5',
    kbPrimary: 'fronter',
    kbSecondary: 'debtcallcoach',
    greeting: DEFAULT_GREETING,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    scriptFlow: DEFAULT_SCRIPT_FLOW,
    dynamicRebuttals: DEFAULT_REBUTTALS,
    qaTuning: DEFAULT_QA_TUNING,
    callbackBookingEnabled: true,
    preTransferEmailEnabled: true,
  };
}

export default function FronterAIAgentTab({ adminUsername }) {
  const { saveConfig } = useAIAgentPipeline();
  const [config, setConfig] = useState(null);
  const [availableLines, setAvailableLines] = useState([]);
  const [fronterKbCount, setFronterKbCount] = useState(0);
  const [debtKbCount, setDebtKbCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState('config');

  const load = useCallback(async () => {
    try {
      const existing = await base44.entities.AIAgentConfig.filter({ configName: 'default' });
      if (existing?.[0]) {
        setConfig({ ...defaultConfig(), ...existing[0] });
      } else {
        setConfig(defaultConfig());
      }
    } catch (e) { setError('Failed to load config: ' + (e?.message || String(e))); }
  }, []);

  const loadLines = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('twilioGetLines', {});
      const lines = res?.data?.lines || res?.lines || [];
      setAvailableLines(lines);
    } catch {}
  }, []);

  const loadKbCounts = useCallback(async () => {
    try {
      const [fCount, dCount] = await Promise.all([
        base44.entities.FronterKnowledgeBase.count({}),
        base44.entities.KnowledgeBase.count({}),
      ]);
      setFronterKbCount(fCount || 0);
      setDebtKbCount(dCount || 0);
    } catch {}
  }, []);

  useEffect(() => { load(); loadLines(); loadKbCounts(); }, [load, loadLines, loadKbCounts]);

  const update = (field, value) => setConfig(prev => ({ ...prev, [field]: value }));

  const save = async () => {
    setSaving(true); setError('');
    try {
      const persisted = await saveConfig(config);
      setConfig({ ...defaultConfig(), ...persisted });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError('Save failed: ' + (e?.response?.data?.error || e?.message || String(e))); }
    setSaving(false);
  };

  const toggleActive = async () => {
    if (!config.twilioLineKey) { alert('Select a Twilio line before activating the agent.'); return; }
    setSaving(true); setError('');
    try {
      const persisted = await saveConfig({ ...config, isActive: !config.isActive });
      setConfig({ ...defaultConfig(), ...persisted });
    } catch (e) { setError('Toggle failed: ' + (e?.response?.data?.error || e?.message || String(e))); }
    setSaving(false);
  };

  if (!config) {
    return <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px', fontSize: '14px' }}>Loading AI Agent configuration…</div>;
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ color: '#e8e0d0', margin: '0 0 4px', fontSize: '22px', fontWeight: 'normal' }}>🤖 AI Fronting Agent</h2>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>Configure the automated voice agent that qualifies debt-relief leads and warm-transfers to Chris Bongiorno.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {saved && <span style={{ color: '#4ade80', fontSize: '12px' }}>✓ Saved</span>}
          <button
            onClick={toggleActive}
            disabled={saving}
            style={{
              background: config.isActive ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
              color: config.isActive ? RED : GOLD,
              border: `1px solid ${config.isActive ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
              borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
            }}
          >
            {config.isActive ? '⏸ Deactivate Agent' : '▶ Activate Agent'}
          </button>
          <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 22px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: saving ? 0.5 : 1 }}>
            {saving ? '⏳ Saving…' : '💾 Save Configuration'}
          </button>
        </div>
      </div>

      {/* Status banner */}
      {config.isActive && (
        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '6px', padding: '10px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: GOLD, animation: 'pulse 1.5s infinite' }} />
          <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold' }}>AGENT LIVE</span>
          <span style={{ color: '#8a9ab8', fontSize: '12px' }}>· Inbound calls on {availableLines.find(l => l.key === config.twilioLineKey)?.number || config.twilioLineKey} will be answered by the AI agent</span>
        </div>
      )}

      {error && <div style={{ color: RED, fontSize: '12px', marginBottom: '12px' }}>⚠ {error}</div>}

      {/* Live Config — shows what's actually being used on calls */}
      <AIAgentLiveConfig config={config} />

      {/* Section tabs */}
      <div role="tablist" aria-label="AI agent sections" style={{ display: 'flex', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '16px' }}>
        {SECTIONS.map(s => (
          <button role="tab" aria-selected={section === s.id} key={s.id} onClick={() => setSection(s.id)} style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${section === s.id ? GOLD : 'transparent'}`, color: section === s.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: section === s.id ? 'bold' : 'normal' }}>{s.label}</button>
        ))}
      </div>

      {section === 'incoming' && <AIAgentIncomingCallsTab config={config} update={update} />}

      {section === 'builder' && <AIAgentScriptBuilderSection />}

      {section === 'config' && (
      <>
      {/* Telephony */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '6px', padding: '18px', marginBottom: '16px' }}>
        <label style={SECTION_LABEL}>📞 Telephony & Transfer Config</label>
        <AIAgentTelephonySection config={config} update={update} availableLines={availableLines} />
      </div>

      {/* Voice Pipeline */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '6px', padding: '18px', marginBottom: '16px' }}>
        <label style={{ ...SECTION_LABEL, color: BLUE, borderBottomColor: 'rgba(96,165,250,0.15)' }}>🎙 Voice & Audio Pipeline</label>
        <AIAgentVoiceSection config={config} update={update} />
      </div>

      {/* Knowledge Bases */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '6px', padding: '18px', marginBottom: '16px' }}>
        <label style={{ ...SECTION_LABEL, color: '#a78bfa', borderBottomColor: 'rgba(167,139,250,0.15)' }}>📚 Knowledge Base Ingestion</label>
        <AIAgentKnowledgeSection config={config} update={update} fronterKbCount={fronterKbCount} debtKbCount={debtKbCount} />
      </div>

      {/* Prompt Workbench */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '6px', padding: '18px', marginBottom: '16px' }}>
        <label style={SECTION_LABEL}>✏️ Prompt & Script Tuning Workbench — Outgoing AI dialer</label>
        <div style={{ color: '#4a5568', fontSize: '10px', marginBottom: '10px' }}>These four sections drive the outgoing AI dials only. Incoming calls use their own prompt and script flow in the 📞 Incoming Calls tab.</div>
        <AIAgentPromptSection config={config} update={update} />
      </div>

      {/* Lead Dialer */}
      <AIAgentDialer adminUsername={adminUsername} />
      </>
      )}
    </div>
  );
}