import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Sparkles, Trash2, X } from 'lucide-react';
import useAppAgent from '@/hooks/useAppAgent';
import AgentMessage from './AgentMessage';

// The app-wide AI command console. ⌘A / Ctrl+A opens it on any screen; ask in
// plain English and ACE answers from live data and drives the app for you.
const SUGGESTIONS = [
  'What are my hot leads right now?',
  'How much did AI cost yesterday?',
  'Take me to the Calls tab',
  'Which fronters are on the clock?',
  'Leads I have not called in 3 days?',
  'Send the welcome emails to today’s prospects',
];

// Marketing / visitor pages have no staff session, so the console stays hidden there.
const VISITOR_PATHS = ['/investor-page', '/optin', '/privacy', '/terms', '/request-access', '/aboutdebt', '/reschedule'];

function hasSession() {
  try {
    if (localStorage.getItem('debtCoachSession')) return true;
  } catch { /* ignore */ }
  return !VISITOR_PATHS.some((p) => window.location.pathname === p || window.location.pathname.startsWith(p + '/'));
}

export default function AgentConsole() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, busy, send, reset } = useAppAgent();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const available = useMemo(hasSession, []);

  // ⌘A / Ctrl+A toggles the console anywhere; Escape closes it.
  useEffect(() => {
    if (!available) return;
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && String(event.key || '').toLowerCase() === 'a') {
        if (event.target === inputRef.current) return; // keep select-all inside the composer
        event.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [available]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 60); }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, open]);

  const submit = (value) => {
    const text = String(value ?? input).trim();
    if (!text || busy) return;
    send(text);
    setInput('');
  };

  if (!available) return null;

  return (
    <>
      <style>{`
        .ace-markdown p { margin: 0 0 8px; }
        .ace-markdown p:last-child { margin-bottom: 0; }
        .ace-markdown ul, .ace-markdown ol { margin: 0 0 8px 18px; padding: 0; }
        .ace-markdown li { margin-bottom: 3px; }
        .ace-markdown strong { color: #ffffff; }
        .ace-markdown code { background: #0b111a; border: 1px solid #1f2937; border-radius: 3px; padding: 1px 4px; font-size: 11.5px; }
        .ace-markdown a { color: #10b981; }
        .ace-markdown table { border-collapse: collapse; }
        .ace-markdown th, .ace-markdown td { border: 1px solid #1f2937; padding: 3px 6px; }
      `}</style>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="AI command console (⌘A)"
          style={{
            position: 'fixed', right: '16px', bottom: '16px', zIndex: 14000,
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#111925', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)',
            borderRadius: '999px', padding: '8px 14px', cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}
        >
          <Sparkles size={13} /> ⌘A AI
        </button>
      )}

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 30000, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
          }}
        >
          <div style={{
            width: 'min(780px, 100%)', height: 'min(80vh, 740px)', display: 'flex', flexDirection: 'column',
            background: '#0b111a', border: '1px solid #1f2937', borderRadius: '10px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1f2937' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={16} color="#10b981" />
                <div>
                  <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px' }}>ACE — Command Console</div>
                  <div style={{ color: '#6b7280', fontSize: '10.5px' }}>Knows the whole Debt Call Coach system · answers from live data · jumps you anywhere</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button type="button" onClick={reset} title="New chat" style={iconBtn}>
                  <Trash2 size={14} />
                </button>
                <button type="button" onClick={() => setOpen(false)} title="Close (Esc)" style={iconBtn}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Conversation */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {!messages.length && (
                <div>
                  <div style={{ color: '#e8e0d0', fontSize: '14px', marginBottom: '4px' }}>What do you need?</div>
                  <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '14px' }}>
                    Ask about leads, calls, AI cost, the team — or say where you want to go and I will take you there.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => submit(s)} style={{
                        background: '#111925', color: '#9ca3af', border: '1px solid #1f2937',
                        borderRadius: '999px', padding: '6px 12px', fontSize: '11.5px', cursor: 'pointer',
                      }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message, i) => <AgentMessage key={i} message={message} />)}

              {busy && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '12px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', animation: 'acePulse 1s infinite' }} />
                  ACE is working…
                  <style>{'@keyframes acePulse{0%,100%{opacity:0.3}50%{opacity:1}}'}</style>
                </div>
              )}
            </div>

            {/* Composer */}
            <div style={{ borderTop: '1px solid #1f2937', padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
                }}
                placeholder="Ask anything, or tell me where to go…"
                style={{
                  flex: 1, resize: 'none', background: '#111925', color: '#e8e0d0',
                  border: '1px solid #1f2937', borderRadius: '6px', padding: '9px 11px',
                  fontSize: '13px', fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => submit()}
                disabled={busy || !input.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: busy || !input.trim() ? 'rgba(16,185,129,0.25)' : 'linear-gradient(135deg,#10b981,#22c55e)',
                  color: '#0b111a', border: 'none', borderRadius: '6px', padding: '10px 16px',
                  fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
                  cursor: busy || !input.trim() ? 'default' : 'pointer',
                }}
              >
                <Send size={13} /> Send
              </button>
            </div>
            <div style={{ padding: '0 14px 10px', color: '#4b5563', fontSize: '10.5px' }}>
              Enter to send · Shift+Enter for a new line · Esc to close · ⌘A to reopen
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const iconBtn = {
  background: 'rgba(255,255,255,0.06)',
  color: '#9ca3af',
  border: '1px solid #1f2937',
  borderRadius: '6px',
  padding: '6px 8px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};