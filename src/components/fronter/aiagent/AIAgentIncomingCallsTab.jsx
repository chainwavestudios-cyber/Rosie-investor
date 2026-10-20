/**
 * AIAgentIncomingCallsTab.jsx — Incoming-call workbench for the AI fronting agent.
 * Owns everything the agent says on an inbound call: persona name, opening line,
 * inbound system prompt, keyword handoff triggers, and the contact-card tags
 * available for personalization after the caller-ID reverse lookup.
 */
import { useState } from 'react';
import { INBOUND_LEAD_TAGS } from './inboundLeadTags';
import { DEFAULT_INBOUND_OPENER, DEFAULT_INBOUND_PROMPT } from './AIAgentPromptSection';

const GOLD = '#10b981';
const PURPLE = '#a78bfa';

const LABEL = { display: 'block', color: PURPLE, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const FIELD = { width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };
const SMALL_BTN = { background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px' };
const CARD = { background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '12px', marginBottom: '14px' };

const FLOW = [
  'Caller-ID reverse lookup matches the caller to their contact card (a new card is created for unknown callers).',
  "Christopher's recorded intro plays, then the caller hears the opening line below.",
  'A keyword trigger — or the end of the intro — hands the caller to the agent.',
  'The agent collects the debt amount and type, reads the program disclosure, then queues the caller for a live transfer.',
];

export default function AIAgentIncomingCallsTab({ config, update }) {
  const [copiedTag, setCopiedTag] = useState('');

  const copyTag = (tag) => {
    const write = navigator.clipboard?.writeText(`{{${tag}}}`);
    if (write?.catch) write.catch(() => {});
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(''), 1500);
  };

  return (
    <div>
      {/* How an incoming call flows */}
      <div style={{ ...CARD, background: 'rgba(96,165,250,0.05)', borderColor: 'rgba(96,165,250,0.2)' }}>
        <label style={{ ...LABEL, color: '#60a5fa' }}>📞 How an incoming call flows</label>
        <ol style={{ margin: 0, paddingLeft: '18px', color: '#8a9ab8', fontSize: '11px', lineHeight: 1.7 }}>
          {FLOW.map(step => <li key={step}>{step}</li>)}
        </ol>
        <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '6px' }}>
          The agent speaks with the voice set in 🎙 Voice & Audio Pipeline{config.elevenLabsVoiceId ? ` — ElevenLabs voice ${config.elevenLabsVoiceId}` : ''}.
        </div>
      </div>

      {/* Persona */}
      <div style={CARD}>
        <label style={LABEL}>🤖 Incoming Agent Name</label>
        <input value={config.inboundAgentName || 'Adam'} onChange={e => update('inboundAgentName', e.target.value)} placeholder="Adam" style={FIELD} />
        <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '3px' }}>Use {'{{agent_name}}'} in the language below to have the agent say its own name.</div>
      </div>

      {/* Opening line */}
      <div style={CARD}>
        <label style={LABEL}>🗣 Opening Line (the first thing the agent says on an incoming call)</label>
        <textarea value={config.inboundOpener || ''} onChange={e => update('inboundOpener', e.target.value)} rows={5} placeholder={DEFAULT_INBOUND_OPENER} style={{ ...FIELD, lineHeight: 1.6, resize: 'vertical' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          <span style={{ color: '#4a5568', fontSize: '10px' }}>Leave empty to use the default. A caller with no name on file hears "Hey there,".</span>
          <button onClick={() => update('inboundOpener', DEFAULT_INBOUND_OPENER)} style={SMALL_BTN}>↺ Default</button>
        </div>
      </div>

      {/* Keyword triggers */}
      <div style={CARD}>
        <label style={LABEL}>🔑 Keyword Triggers (comma-separated phrases that skip straight to the agent)</label>
        <input value={config.inboundKeywordTriggers || ''} onChange={e => update('inboundKeywordTriggers', e.target.value)} placeholder="let's get debt free, get debt free, let's do it" style={FIELD} />
      </div>

      {/* System prompt */}
      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <label style={{ ...LABEL, marginBottom: 0 }}>🧠 Incoming System Prompt (the agent's instructions — never read aloud)</label>
          <button onClick={() => { if (confirm('Reset the incoming system prompt to the default script? Current edits will be lost.')) update('inboundSystemPrompt', DEFAULT_INBOUND_PROMPT); }} style={SMALL_BTN}>↺ Reset to Default</button>
        </div>
        <textarea value={config.inboundSystemPrompt || ''} onChange={e => update('inboundSystemPrompt', e.target.value)} rows={26} placeholder={DEFAULT_INBOUND_PROMPT} style={{ ...FIELD, lineHeight: 1.6, resize: 'vertical' }} />
        <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '4px' }}>{(config.inboundSystemPrompt || '').length} characters · Leave empty to use the default script.</div>
      </div>

      {/* Contact-card tags */}
      <div style={CARD}>
        <label style={LABEL}>🏷 Contact Card Tags (filled from the caller's reverse lookup)</label>
        <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '10px' }}>Click a tag to copy it, then paste it into the opening line or the system prompt. The caller's own card values are dropped in before the agent speaks.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '6px' }}>
          {INBOUND_LEAD_TAGS.map(({ tag, label, example }) => (
            <button key={tag} onClick={() => copyTag(tag)} title={`Copy {{${tag}}}`} style={{ textAlign: 'left', background: 'rgba(0,0,0,0.25)', border: `1px solid ${copiedTag === tag ? GOLD : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', padding: '7px 9px', cursor: 'pointer' }}>
              <div style={{ color: copiedTag === tag ? GOLD : PURPLE, fontFamily: 'monospace', fontSize: '11px' }}>{copiedTag === tag ? '✓ copied' : `{{${tag}}}`}</div>
              <div style={{ color: '#8a9ab8', fontSize: '10px', marginTop: '2px' }}>{label}</div>
              <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '1px' }}>e.g. {example}</div>
            </button>
          ))}
        </div>
        <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '8px' }}>A tag with no value on the card is left blank. Tags the system does not recognize are left exactly as typed, so script markers like {'{{contingency_time}}'} are never stripped.</div>
      </div>
    </div>
  );
}