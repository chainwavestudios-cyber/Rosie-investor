/**
 * BobBrainChat.jsx — Chat directly with BOB about what it knows.
 *  - Ask questions → BOB answers from its KB + transcripts.
 *  - "forget: <query>" → finds matching KB entries, click to delete.
 *  - "remember: <Q> | <A>" → saves a new KB entry to the brain.
 */
import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const PURPLE = '#a78bfa';

export default function BobBrainChat({ kbEntries, transcripts, onKBChanged }) {
  const [messages, setMessages] = useState([{ role: 'bob', text: "Hey, I'm BOB's brain. Ask me what I know about the program, objections, or closing. Or type `forget: <topic>` to make me forget something, or `remember: <question> | <answer>` to teach me something new." }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async () => {
    const msg = (input || '').trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const forgetMatch = msg.match(/^forget\s*:\s*(.+)/i);
      const rememberMatch = msg.match(/^remember\s*:\s*(.+?)\s*\|\s*(.+)$/i);

      if (forgetMatch) {
        const query = forgetMatch[1].trim().toLowerCase();
        const matches = kbEntries.filter(e =>
          (e.question || '').toLowerCase().includes(query) || (e.answer || '').toLowerCase().includes(query)
        ).slice(0, 10);
        if (matches.length === 0) {
          setMessages(prev => [...prev, { role: 'bob', text: `I don't have any entries matching "${forgetMatch[1].trim()}" to forget.` }]);
        } else {
          setMessages(prev => [...prev, { role: 'bob', text: `I found ${matches.length} entries matching "${forgetMatch[1].trim()}". Click 🗑 to make me forget each one:`, deletable: matches }]);
        }
      } else if (rememberMatch) {
        const q = rememberMatch[1].trim();
        const a = rememberMatch[2].trim();
        await base44.entities.KnowledgeBase.create({ question: q, answer: a, category: 'debt_faq', kbName: 'Debt Settlement', source: 'BobBrain Chat', created_date: new Date().toISOString() });
        setMessages(prev => [...prev, { role: 'bob', text: `✓ Got it. I'll remember: "${q}"` }]);
        onKBChanged?.();
      } else {
        const ctx = kbEntries.slice(0, 60).map(e => `Q: ${e.question}\nA: ${(e.answer || '').slice(0, 300)}`).join('\n');
        const transcriptCtx = transcripts.slice(0, 8).map(t => `[${t.sourceName}]: ${(t.transcriptText || '').slice(0, 400)}`).join('\n---\n');
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are BOB, a debt-settlement sales training AI brain. The trainer is chatting with you about what you know. Answer conversationally based ONLY on your knowledge base and transcripts below. Be concise (2-4 sentences). If you don't know, say so and suggest uploading more calls. Do not invent facts not in the knowledge base.

KNOWLEDGE BASE (${kbEntries.length} entries):
${ctx}

RECENT CALL TRANSCRIPTS (${transcripts.length}):
${transcriptCtx || 'None yet'}

TRAINER: ${msg}`,
        });
        const reply = (typeof res === 'string' ? res : (res?.data || res)) || '...';
        setMessages(prev => [...prev, { role: 'bob', text: reply }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'bob', text: '⚠ ' + (e?.message || String(e)) }]);
    }
    setLoading(false);
  };

  const deleteEntry = async (id) => {
    try {
      await base44.entities.KnowledgeBase.delete(id);
      setMessages(prev => prev.map(m => m.deletable ? { ...m, deletable: m.deletable.filter(x => x.id !== id) } : m));
      onKBChanged?.();
    } catch (e) {
      setMessages(prev => [...prev, { role: 'bob', text: '⚠ Could not delete: ' + (e?.message || String(e)) }]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '420px' }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
            <div style={{
              background: m.role === 'user' ? 'rgba(16,185,129,0.12)' : 'rgba(167,139,250,0.08)',
              border: `1px solid ${m.role === 'user' ? 'rgba(16,185,129,0.25)' : 'rgba(167,139,250,0.2)'}`,
              borderRadius: '8px', padding: '10px 14px',
              color: m.role === 'user' ? GOLD : '#c4cdd8', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap',
            }}>
              {m.text}
            </div>
            {m.deletable && m.deletable.length > 0 && (
              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {m.deletable.map(d => (
                  <div key={d.id} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '6px 8px' }}>
                    <button onClick={() => deleteEntry(d.id)} title="Forget this" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px', flexShrink: 0 }}>🗑</button>
                    <div style={{ fontSize: '11px', lineHeight: 1.4 }}>
                      <span style={{ color: '#e8e0d0', fontWeight: 'bold' }}>{d.question}</span>
                      <span style={{ color: '#8a9ab8' }}> — {(d.answer || '').slice(0, 120)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <div style={{ alignSelf: 'flex-start', color: PURPLE, fontSize: '11px', fontStyle: 'italic' }}>BOB is thinking…</div>}
      </div>
      <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask BOB, or: forget: <topic>  /  remember: <Q> | <A>"
          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '9px 12px', color: '#e8e0d0', fontSize: '12px', outline: 'none', fontFamily: 'Georgia, serif' }}
        />
        <button onClick={send} disabled={loading || !input.trim()} style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 18px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: loading || !input.trim() ? 0.5 : 1 }}>Send</button>
      </div>
    </div>
  );
}