/**
 * AIScriptProposalPreview.jsx — everything the AI script builder produced,
 * grouped by where it will land, shown before anything is written.
 */
const GOLD = '#10b981';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';

const panel = { background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px', marginBottom: '10px' };
const title = { color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' };
const summary = { color: '#e8e0d0', fontSize: '12px', cursor: 'pointer', padding: '5px 0', fontFamily: 'Georgia, serif' };
const body = { color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif', borderLeft: `2px solid ${PURPLE}44`, padding: '6px 0 8px 10px', marginTop: '4px' };

function Group({ heading, color, count, children }) {
  return (
    <div style={{ ...panel, borderColor: `${color}33` }}>
      <div style={{ ...title, color }}>
        {heading} <span style={{ color: '#8a9ab8' }}>— {count}</span>
      </div>
      {children}
    </div>
  );
}

export default function AIScriptProposalPreview({ proposal }) {
  if (!proposal) return null;
  const cfg = proposal.agentConfig || {};
  const cfgKeys = Object.keys(cfg).filter(k => typeof cfg[k] === 'string' && cfg[k].trim());
  const scripts = proposal.scripts || [];
  const objections = proposal.objections || [];
  const questions = proposal.commonQuestions || [];
  const kb = proposal.kbEntries || [];
  const any = scripts.length + objections.length + questions.length + kb.length + cfgKeys.length;
  if (!any) return null;

  return (
    <div>
      <div style={{ ...title, color: GOLD }}>
        3 · Ready to apply — {scripts.length + objections.length + questions.length + kb.length} entries
        {cfgKeys.length ? ` + ${cfgKeys.length} agent config fields` : ''}
      </div>

      {scripts.length > 0 && (
        <Group heading="Fronter scripts" color={GOLD} count={`${scripts.length}`}>
          {scripts.map((s, i) => (
            <details key={i}>
              <summary style={summary}>{s.name} <span style={{ color: '#6b7280', fontSize: '10px' }}>· {s.scriptType || 'custom'} · {(s.content || '').length.toLocaleString()} chars</span></summary>
              <div style={body}>{s.content}</div>
            </details>
          ))}
        </Group>
      )}

      {cfgKeys.length > 0 && (
        <Group heading="AI agent config — outbound + inbound" color={PURPLE} count={`${cfgKeys.length} fields`}>
          {cfgKeys.map(k => (
            <details key={k}>
              <summary style={summary}>{k} <span style={{ color: '#6b7280', fontSize: '10px' }}>· {String(cfg[k]).length.toLocaleString()} chars</span></summary>
              <div style={body}>{cfg[k]}</div>
            </details>
          ))}
        </Group>
      )}

      {objections.length > 0 && (
        <Group heading="Rebuttals" color={BLUE} count={`${objections.length}`}>
          {objections.map((o, i) => (
            <details key={i}>
              <summary style={summary}>{o.title} <span style={{ color: '#6b7280', fontSize: '10px' }}>· {o.priority || 'medium'}</span></summary>
              <div style={body}>
                <strong>Customer says:</strong> {(o.triggerPhrases || []).join(' / ')}
                {'\n\n'}<strong>Reply:</strong> {o.responseText}
                {o.mindset ? `\n\nMindset: ${o.mindset}` : ''}
                {o.goal ? `\nGoal: ${o.goal}` : ''}
              </div>
            </details>
          ))}
        </Group>
      )}

      {questions.length > 0 && (
        <Group heading="Common questions — fronter Q&A" color={GOLD} count={`${questions.length}`}>
          {questions.map((q, i) => (
            <details key={i}>
              <summary style={summary}>{q.question}</summary>
              <div style={body}>
                {q.answer}
                {(q.alternativeQuestions || []).length ? `\n\nAlso asked as: ${(q.alternativeQuestions || []).join(' / ')}` : ''}
              </div>
            </details>
          ))}
        </Group>
      )}

      {kb.length > 0 && (
        <Group heading="Main knowledge base" color={BLUE} count={`${kb.length}`}>
          {kb.map((e, i) => (
            <details key={i}>
              <summary style={summary}>{e.question}</summary>
              <div style={body}>
                {e.answer}
                {(e.variations || []).length ? `\n\nVariations: ${(e.variations || []).join(' | ')}` : ''}
              </div>
            </details>
          ))}
        </Group>
      )}
    </div>
  );
}