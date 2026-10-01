/**
 * SmartLeadsChat.jsx — AI chatbot interface for the Smart Leads director.
 * Lets the user converse with the AI to refine lead generation settings.
 * The AI can modify keywords, subreddits, distress phrases, and other config.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';

export default function SmartLeadsChat({ coachUser, onConfigUpdated }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm Smart Leads — your AI director for lead generation. I can help you refine the scraper to find better, more relevant leads.\n\nTry asking me to:\n• \"Add r/CreditCardDebt to the subreddits\"\n• \"Remove 'povertyfinance' — too many irrelevant posts\"\n• \"Add a new distress phrase: 'credit cards are suffocating me'\"\n• \"Lower the max debt amount to $150k\"\n• \"What keywords should we add for people behind on payments?\"\n• \"Why are we getting so many irrelevant leads?\"\n\nI'll update the config and explain my reasoning. I also learn from lead rejections automatically." }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [lastChanges, setLastChanges] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async () => {
    if (!input.trim() || sending) return;
    const userMsg = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setSending(true);
    setLastChanges(null);

    try {
      const res = await base44.functions.invoke('smartLeadsChat', {
        action: 'chat',
        messages: newMessages,
        username: coachUser?.username || 'user',
      });
      const data = res?.data || res;
      const aiResponse = data?.response || 'I encountered an issue processing your request.';
      const configChanges = data?.configChanges || [];
      const configUpdated = data?.configUpdated || false;

      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      if (configChanges.length > 0) {
        setLastChanges({ changes: configChanges, updated: configUpdated });
      }
      if (configUpdated) onConfigUpdated?.();
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠ Error: ' + (e?.message || String(e)) }]);
    }
    setSending(false);
  }, [input, sending, messages, coachUser, onConfigUpdated]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `linear-gradient(135deg,${GOLD},#22c55e)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🧠</div>
        <div>
          <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>Smart Leads AI Director</div>
          <div style={{ color: '#6b7280', fontSize: '10px' }}>Learns from your feedback to find better leads</div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0, background: msg.role === 'assistant' ? `linear-gradient(135deg,${GOLD},#22c55e)` : 'rgba(96,165,250,0.2)', color: msg.role === 'assistant' ? DARK : BLUE }}>
              {msg.role === 'assistant' ? '🧠' : '👤'}
            </div>
            <div style={{ flex: 1, background: msg.role === 'assistant' ? 'rgba(16,185,129,0.06)' : 'rgba(96,165,250,0.06)', border: `1px solid ${msg.role === 'assistant' ? 'rgba(16,185,129,0.15)' : 'rgba(96,165,250,0.15)'}`, borderRadius: '6px', padding: '10px 14px' }}>
              <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>{msg.content}</div>
            </div>
          </div>
        ))}

        {/* Config changes indicator */}
        {lastChanges && (
          <div style={{ padding: '10px 14px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', marginLeft: '36px' }}>
            <div style={{ color: PURPLE, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>⚙️ Config Changes Applied</div>
            {lastChanges.changes.map((c, i) => (
              <div key={i} style={{ color: c.applied ? GOLD : '#6b7280', fontSize: '11px', marginBottom: '2px' }}>
                {c.applied ? '✓' : '✗'} <strong>{c.action}</strong> {c.field}: {c.value}
                {c.reason && <span style={{ color: '#6b7280' }}> — {c.reason}</span>}
              </div>
            ))}
          </div>
        )}

        {sending && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#6b7280', fontSize: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: DARK }}>🧠</div>
            <span>Smart Leads is thinking…</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '8px' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Smart Leads to adjust the scraper…"
          rows={2}
          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'Georgia, serif' }}
        />
        <button onClick={send} disabled={sending || !input.trim()} style={{ background: `linear-gradient(135deg,${GOLD},#22c55e)`, color: DARK, border: 'none', borderRadius: '4px', padding: '0 20px', cursor: sending || !input.trim() ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: sending || !input.trim() ? 0.5 : 1 }}>
          {sending ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  );
}