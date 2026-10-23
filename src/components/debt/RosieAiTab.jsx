/**
 * RosieAiTab.jsx — the AI conversation this contact card collected: the words of the
 * call, and the coach's full read on it.
 */
import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const BLUE = '#60a5fa';

/** The video conversation saved on the card: { at, source: 'video_qualification', lines }. */
function readConversation(lead) {
  let parsed = null;
  try {
    parsed = JSON.parse(lead?.transcriptJson || '');
  } catch {
    return null;
  }
  if (!parsed || parsed.source !== 'video_qualification') return null;
  const text = String(parsed.lines || '').trim();
  if (!text) return null;
  return { at: parsed.at || '', lines: text.split('\n').filter((line) => line.trim()) };
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`, borderRadius: '4px', padding: '10px', textAlign: 'center' }}>
      <div style={{ color, fontSize: '14px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

export default function RosieAiTab({ lead, onAnalyzed }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const conversation = useMemo(() => readConversation(lead), [lead?.transcriptJson]);
  const analysis = useMemo(() => {
    const raw = String(lead?.rosieAiAnalysis || '').trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // an older or hand-edited analysis is still worth showing as it stands
    }
    return { headline: raw };
  }, [lead?.rosieAiAnalysis]);

  const analyze = async () => {
    if (!lead?.id || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await base44.functions.invoke('analyzeRosieSession', { leadId: lead.id });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      onAnalyzed?.(data.analysis, data.analyzedAt);
    } catch (e) {
      setError(e?.message || 'The conversation could not be analyzed.');
    }
    setBusy(false);
  };

  if (!conversation) {
    return (
      <div>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🤖 Rosie AI</div>
        <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '14px', color: '#8a9ab8', fontSize: '12px', lineHeight: 1.7 }}>
          No AI conversation on this card yet. Send one from the 🤖 AI Invitation button — when {lead?.firstName || 'the client'} talks with Rosie or Digital Chris, the transcript of that call lands here with a full analysis of it.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>🤖 Rosie AI</span>
        {lead?.rosieAiAssistant && (
          <span style={{ background: 'rgba(96,165,250,0.12)', color: BLUE, border: '1px solid rgba(96,165,250,0.25)', borderRadius: '3px', padding: '1px 8px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            Met {lead.rosieAiAssistant}
          </span>
        )}
        {conversation.at && (
          <span style={{ color: '#6b7280', fontSize: '10px' }}>
            {new Date(conversation.at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
        <span style={{ color: '#4a5568', fontSize: '10px' }}>{conversation.lines.length} lines</span>
      </div>

      <div style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: BLUE, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>
          📝 Transcript Of Their Conversation
        </div>
        <div style={{ maxHeight: '40vh', overflowY: 'auto', padding: '10px 14px' }}>
          {conversation.lines.map((line, i) => {
            const match = /^(prospect|agent|assistant|you)\s*:\s*/i.exec(line);
            const role = match ? match[1].toLowerCase() : '';
            const text = match ? line.slice(match[0].length) : line;
            const isAgent = role === 'agent' || role === 'assistant';
            return (
              <div key={i} style={{ marginBottom: '6px', display: 'flex', gap: '8px' }}>
                <span style={{ color: isAgent ? BLUE : GOLD, fontSize: '10px', fontWeight: 'bold', flexShrink: 0, minWidth: '62px' }}>
                  {isAgent ? 'Assistant' : role ? 'Prospect' : ''}
                </span>
                <span style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5 }}>{text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {!analysis ? (
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '14px' }}>
          <div style={{ color: '#8a9ab8', fontSize: '12px', lineHeight: 1.7, marginBottom: '12px' }}>
            Analyze their time together: what was said, what they asked, what worried them, how engaged they were and what to do next.
          </div>
          <button
            onClick={analyze}
            disabled={busy}
            style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: busy ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? '⏳ Analyzing…' : '✨ Analyze This Conversation'}
          </button>
          {error && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '10px' }}>{error}</div>}
        </div>
      ) : (
        <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>🔍 Full Analysis Of Their Time Together</div>
            <button
              onClick={analyze}
              disabled={busy}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '4px 10px', color: '#8a9ab8', cursor: busy ? 'not-allowed' : 'pointer', fontSize: '10px', opacity: busy ? 0.6 : 1 }}
            >
              {busy ? '⏳ Re-analyzing…' : '↻ Re-analyze'}
            </button>
          </div>

          {analysis.headline && (
            <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', lineHeight: 1.6, marginBottom: '12px' }}>{analysis.headline}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
            <Stat label="Debt Range" value={analysis.debtRange || '—'} color={GOLD} />
            <Stat label="Phone Given" value={analysis.phoneGiven ? 'Yes' : 'No'} color={analysis.phoneGiven ? GOLD : '#f59e0b'} />
            <Stat label="Engagement" value={String(analysis.engagement || '—').split(/[\s—,-]/)[0] || '—'} color={BLUE} />
          </div>

          {analysis.engagement && (
            <Section title="Engagement">
              <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6 }}>{analysis.engagement}</div>
            </Section>
          )}

          {analysis.summary && (
            <Section title="What Happened">
              <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{analysis.summary}</div>
            </Section>
          )}

          {analysis.situation && (
            <Section title="Their Situation">
              <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{analysis.situation}</div>
            </Section>
          )}

          {Array.isArray(analysis.questions) && analysis.questions.length > 0 && (
            <Section title={`Questions They Asked — ${analysis.questions.length}`}>
              {analysis.questions.map((row, i) => (
                <div key={i} style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '4px', padding: '8px 10px', marginBottom: '6px' }}>
                  <div style={{ color: '#e8e0d0', fontSize: '12px', lineHeight: 1.5 }}>{row?.question}</div>
                  {row?.answer && <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5, marginTop: '4px' }}>💡 {row.answer}</div>}
                </div>
              ))}
            </Section>
          )}

          {Array.isArray(analysis.concerns) && analysis.concerns.length > 0 && (
            <Section title="Worries & Objections">
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {analysis.concerns.map((concern, i) => (
                  <span key={i} style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '3px', padding: '3px 8px', fontSize: '11px' }}>{concern}</span>
                ))}
              </div>
            </Section>
          )}

          {analysis.nextStep && (
            <Section title="Do This Next">
              <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{analysis.nextStep}</div>
            </Section>
          )}

          {analysis.opening && (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '4px', padding: '10px 12px' }}>
              <div style={{ color: GOLD, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>💬 Open The Follow-Up Call With</div>
              <div style={{ color: '#e8e0d0', fontSize: '12px', lineHeight: 1.6, fontStyle: 'italic' }}>“{analysis.opening}”</div>
            </div>
          )}

          {lead?.rosieAiAnalyzedAt && (
            <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '10px' }}>
              Analyzed {new Date(lead.rosieAiAnalyzedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </div>
          )}
          {error && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '10px' }}>{error}</div>}
        </div>
      )}
    </div>
  );
}