/**
 * FronterBobScenarioBuilder.jsx — AI chatbot that builds custom BOB scenarios.
 * The user describes the kind of customer they want, the AI asks follow-up
 * questions, then generates a tailored scenario JSON that drops into the trainer.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const PURPLE = '#a78bfa';
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function FronterBobScenarioBuilder({ onApply, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [pos, setPos] = useState({ x: 100, y: 80 });
  const [size, setSize] = useState({ w: 420, h: 560 });
  const dragRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    setMessages([{ role: 'ai', text: "Hi! I'm your BOB scenario builder. 🤖\n\nTell me about the kind of customer you want to practice with. For example: 'I want a skeptical customer named Sarah from Texas with $25K in credit card debt who's been burned by scams before.'\n\nI'll ask a few questions and then generate a custom scenario for you." }]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const onDragStart = (e) => {
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    const onMove = (ev) => { if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY }); };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', text: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const conversationText = newMessages.map(m => `${m.role === 'ai' ? 'AI' : 'User'}: ${m.text}`).join('\n');
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a BOB scenario builder assistant for a debt relief cold call training simulator. You help the user create a custom customer persona by asking questions.

Conversation so far:
${conversationText}

Your job:
1. Ask ONE follow-up question at a time to understand the customer persona the user wants.
2. Gather: customer name, address (city/state), total debt amount, creditors, monthly income, months behind, employment status, hardship story, personality type (skeptical/overwhelmed/analytical/etc), and any special objections they should raise.
3. After 2-3 exchanges (or when you have enough info), say: "I have enough details! Click 'Generate Scenario' to create your custom BOB persona."
4. Keep responses concise (1-3 sentences). Be conversational and friendly.

Respond with just your message to the user.`,
      });
      setMessages(prev => [...prev, { role: 'ai', text: res }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I had an issue. Please try again.' }]);
    }
    setLoading(false);
  };

  const generateScenario = async () => {
    setLoading(true);
    try {
      const conversationText = messages.map(m => `${m.role === 'ai' ? 'AI' : 'User'}: ${m.text}`).join('\n');
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Based on this conversation, create a BOB customer scenario for a debt relief cold call training simulator.

Conversation:
${conversationText}

Generate a JSON object with these exact fields:
- customerName: string (first name only)
- customerAddress: string (full address: street, city, state, zip)
- debtAmount: string (total debt in dollars, numbers only, no $ sign)
- creditors: string (comma-separated list of creditor names)
- creditorCount: string (number of accounts)
- monthlyIncome: string (monthly income, numbers only)
- monthsBehind: string (number of months behind)
- hardship: string (1-2 sentence first-person hardship story explaining why they're in debt)
- openingLine: string (what the customer says when they answer the phone, e.g. "Hello?" or "Yeah, who is this?")

Return ONLY the JSON object.`,
        response_json_schema: {
          type: 'object',
          properties: {
            customerName: { type: 'string' },
            customerAddress: { type: 'string' },
            debtAmount: { type: 'string' },
            creditors: { type: 'string' },
            creditorCount: { type: 'string' },
            monthlyIncome: { type: 'string' },
            monthsBehind: { type: 'string' },
            hardship: { type: 'string' },
            openingLine: { type: 'string' },
          },
        },
      });
      setGenerated(res);
    } catch (e) {
      alert('Failed to generate: ' + (e?.message || String(e)));
    }
    setLoading(false);
  };

  const canGenerate = messages.filter(m => m.role === 'user').length >= 2;

  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, background: '#0d1b2a', border: `1px solid ${PURPLE}55`, borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      <div onMouseDown={onDragStart} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0, background: 'linear-gradient(135deg, rgba(167,139,250,0.08), transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🤖</span>
          <div>
            <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>AI Scenario Builder</div>
            <div style={{ color: PURPLE, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>Describe your custom customer</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px' }}>×</button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '10px', justifyContent: m.role === 'ai' ? 'flex-start' : 'flex-end' }}>
            <div style={{ maxWidth: '88%', background: m.role === 'ai' ? 'rgba(167,139,250,0.1)' : 'rgba(96,165,250,0.1)', border: `1px solid ${m.role === 'ai' ? 'rgba(167,139,250,0.2)' : 'rgba(96,165,250,0.2)'}`, borderRadius: m.role === 'ai' ? '12px 12px 12px 2px' : '12px 12px 2px 12px', padding: '8px 12px' }}>
              <div style={{ color: m.role === 'ai' ? PURPLE : '#60a5fa', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '3px' }}>{m.role === 'ai' ? '🤖 AI' : 'You'}</div>
              <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.text}</div>
            </div>
          </div>
        ))}
        {loading && <div style={{ color: PURPLE, fontSize: '11px', textAlign: 'center', padding: '8px' }}>⏳ Thinking…</div>}

        {generated && (
          <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '6px' }}>
            <div style={{ color: GOLD, fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>✓ Generated Scenario</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
              <div><span style={{ color: '#6b7280', fontSize: '10px' }}>Name: </span><span style={{ color: '#e8e0d0', fontSize: '11px' }}>{generated.customerName}</span></div>
              <div><span style={{ color: '#6b7280', fontSize: '10px' }}>Debt: </span><span style={{ color: GOLD, fontSize: '11px' }}>${generated.debtAmount}</span></div>
              <div><span style={{ color: '#6b7280', fontSize: '10px' }}>Income: </span><span style={{ color: '#e8e0d0', fontSize: '11px' }}>${generated.monthlyIncome}</span></div>
              <div><span style={{ color: '#6b7280', fontSize: '10px' }}>Behind: </span><span style={{ color: '#e8e0d0', fontSize: '11px' }}>{generated.monthsBehind} mo</span></div>
            </div>
            {generated.customerAddress && <div style={{ color: '#8a9ab8', fontSize: '10px', marginBottom: '4px' }}>📍 {generated.customerAddress}</div>}
            <div style={{ color: '#8a9ab8', fontSize: '10px', marginBottom: '4px' }}>💳 {generated.creditors}</div>
            <div style={{ color: '#c4cdd8', fontSize: '11px', lineHeight: 1.4, marginBottom: '6px' }}>{generated.hardship}</div>
            {generated.openingLine && <div style={{ color: PURPLE, fontSize: '10px', fontStyle: 'italic' }}>Opening: "{generated.openingLine}"</div>}
            <button onClick={() => onApply(generated)} style={{ marginTop: '8px', width: '100%', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '9px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>✓ Apply This Scenario</button>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        {!generated && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: canGenerate ? '8px' : '0' }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }} placeholder="Describe your customer…" disabled={loading} style={inp} />
            <button onClick={send} disabled={loading || !input.trim()} style={{ background: 'linear-gradient(135deg,#a78bfa,#8b5cf6)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 16px', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: loading || !input.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}>Send</button>
          </div>
        )}
        {!generated && canGenerate && (
          <button onClick={generateScenario} disabled={loading} style={{ width: '100%', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '9px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: loading ? 0.5 : 1 }}>✨ Generate Scenario</button>
        )}
        {generated && (
          <button onClick={() => { setGenerated(null); setMessages([{ role: 'ai', text: "Let's build another one! What kind of customer do you want?" }]); }} style={{ width: '100%', background: 'rgba(167,139,250,0.15)', color: PURPLE, border: '1px solid rgba(167,139,250,0.3)', borderRadius: '4px', padding: '9px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>↻ Build Another</button>
        )}
      </div>

      <div onMouseDown={(e) => { e.stopPropagation(); const sX = e.clientX, sY = e.clientY, sW = size.w, sH = size.h; const onM = (ev) => setSize({ w: Math.max(320, sW + ev.clientX - sX), h: Math.max(350, sH + ev.clientY - sY) }); const onU = () => { document.removeEventListener('mousemove', onM); document.removeEventListener('mouseup', onU); }; document.addEventListener('mousemove', onM); document.addEventListener('mouseup', onU); }} style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', cursor: 'nwse-resize', color: '#4a5568', textAlign: 'right', paddingRight: '2px' }}>⌟</div>
    </div>
  );
}