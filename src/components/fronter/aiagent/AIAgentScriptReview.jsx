/**
 * AIAgentScriptReview.jsx — review and edit the mirror script and the agent
 * sections the builder produced, before anything is written to the live config.
 */
const GOLD = '#10b981';
const PURPLE = '#a78bfa';

const inp = { width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '9px 11px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };
const card = { background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '14px', marginBottom: '14px' };
const head = { color: PURPLE, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' };
const label = { display: 'block', color: PURPLE, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };

const FIELDS = {
  incoming: [
    { key: 'inboundOpener', label: '🗣 Opening Line — the first thing the incoming agent says', rows: 4 },
    { key: 'inboundSystemPrompt', label: '🧠 System Prompt — the incoming agent’s instructions', rows: 14 },
    { key: 'scriptFlow', label: '📋 Script Flow — call phases in order', rows: 12 },
    { key: 'dynamicRebuttals', label: '🛡 Rebuttals', rows: 12 },
    { key: 'qaTuning', label: '💬 Q&A Tuning', rows: 8 },
  ],
  outgoing: [
    { key: 'greeting', label: '🗣 Opening Line — the first thing the outgoing agent says', rows: 3 },
    { key: 'systemPrompt', label: '🧠 System Prompt — the outgoing agent’s instructions', rows: 14 },
    { key: 'scriptFlow', label: '📋 Script Flow — call phases in order', rows: 12 },
    { key: 'dynamicRebuttals', label: '🛡 Rebuttals', rows: 12 },
    { key: 'qaTuning', label: '💬 Q&A Tuning', rows: 8 },
  ],
};

export default function AIAgentScriptReview({ proposal, setProposal }) {
  if (!proposal) return null;
  const direction = proposal.direction === 'incoming' ? 'incoming' : 'outgoing';
  const fields = FIELDS[direction];
  const config = proposal.agentConfig || {};
  const setConfigField = (key, value) => setProposal(prev => ({ ...prev, agentConfig: { ...(prev.agentConfig || {}), [key]: value } }));

  return (
    <div style={{ ...card, borderColor: `${GOLD}44` }}>
      <div style={{ ...head, color: GOLD }}>4 · Review — the {direction} script and agent sections</div>

      <div style={{ marginBottom: '12px' }}>
        <label style={label}>Script Name (this is the rename that gets applied)</label>
        <input value={proposal.name || ''} onChange={e => setProposal(prev => ({ ...prev, name: e.target.value }))} style={inp} />
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={label}>The {direction} script ({((proposal.script || '').length).toLocaleString()} characters)</label>
        <textarea value={proposal.script || ''} onChange={e => setProposal(prev => ({ ...prev, script: e.target.value }))} rows={16} style={{ ...inp, lineHeight: 1.6, resize: 'vertical' }} />
      </div>

      {fields.map(f => (
        <div key={f.key} style={{ marginBottom: '12px' }}>
          <label style={label}>{f.label}</label>
          <textarea
            value={config[f.key] || ''}
            onChange={e => setConfigField(f.key, e.target.value)}
            rows={f.rows}
            placeholder="The AI left this empty — type it here or leave it out."
            style={{ ...inp, lineHeight: 1.55, resize: 'vertical' }}
          />
          <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '3px' }}>{(config[f.key] || '').length} characters · empty fields are skipped on apply</div>
        </div>
      ))}
    </div>
  );
}