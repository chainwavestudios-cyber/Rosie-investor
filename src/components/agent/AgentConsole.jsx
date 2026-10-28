import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Send, Sparkles, Trash2, X } from 'lucide-react';
import useAppAgent from '@/hooks/useAppAgent';
import useVoiceInput from '@/hooks/useVoiceInput';
import { ACE_OPEN_EVENT } from '@/lib/aceConsole';
import AgentMessage from './AgentMessage';
import AceVoiceButton from './AceVoiceButton';

// Admin-only AI command console. ⌘A / Ctrl+A opens it for verified admins; ask in
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
const VISITOR_PATHS = ['/', '/welcome', '/qualify', '/email-optin', '/stories', '/investor-page', '/optin', '/privacy', '/terms', '/request-access', '/aboutdebt', '/reschedule'];
const ADMIN_ROLES = new Set(['admin', 'super_admin']);

function isVisitorPath(path) {
  if (path === '/bob' || path.startsWith('/bob/')) return true;
  return VISITOR_PATHS.some((p) => path === p || (p !== '/' && path.startsWith(p + '/')));
}

export default function AgentConsole() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [focus, setFocus] = useState(null);
  const { messages, busy, send, reset } = useAppAgent(focus);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const submitRef = useRef(null);
  const location = useLocation();
  const [authorized, setAuthorized] = useState(false);
  const available = authorized && !isVisitorPath(location.pathname);

  // Verify roles using a server-validated session, never a stored-role flag.
  // Portal sessions take precedence: an authenticated non-admin cannot fall
  // through to a separate app login to use this admin-only console.
  useEffect(() => {
    let active = true;
    setAuthorized(false);
    setOpen(false);
    if (isVisitorPath(location.pathname)) return () => { active = false; };
    (async () => {
      let permitted = false;
      let portalSessionVerified = false;
      try {
        const session = JSON.parse(localStorage.getItem('debtCoachSession') || 'null');
        if (session?.userId && session?.token) {
          const response = await base44.functions.invoke('debtCoachAuth', {
            action: 'me', sessionUserId: session.userId, sessionToken: session.token,
          });
          const user = response?.data?.user || response?.user;
          if (user) {
            portalSessionVerified = true;
            permitted = ADMIN_ROLES.has(String(user.role || '').toLowerCase());
          }
        }
      } catch { /* A missing or invalid portal session is not permission. */ }
      if (!portalSessionVerified) {
        try {
          const user = await base44.auth.me();
          permitted = ADMIN_ROLES.has(String(user?.role || '').toLowerCase());
        } catch { permitted = false; }
      }
      if (active) setAuthorized(permitted);
    })();
    return () => { active = false; };
  }, [location.pathname]);

  // Contact cards launch the console scoped to the person they are working.
  useEffect(() => {
    const onOpen = (event) => {
      if (!available) return;
      setFocus(event.detail || null);
      setOpen(true);
    };
    window.addEventListener(ACE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ACE_OPEN_EVENT, onOpen);
  }, [available]);

  const voice = useVoiceInput({ onFinal: (text) => submitRef.current?.(text) });

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
    voice.stop();
    send(text);
    setInput('');
  };
  submitRef.current = submit;

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
                  <div style={{ color: focus?.leadName ? '#10b981' : '#6b7280', fontSize: '10.5px' }}>
                    {focus?.leadName
                      ? `Working on ${focus.leadName} — talk or type: "book an appointment Friday at 2pm"`
                      : 'Knows the whole Debt Call Coach system · answers from live data · jumps you anywhere'}
                  </div>
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
            {voice.listening && voice.interim && (
              <div style={{ padding: '6px 16px 0', color: '#10b981', fontSize: '11.5px', fontStyle: 'italic' }}>
                “{voice.interim}”
              </div>
            )}
            <div style={{ borderTop: '1px solid #1f2937', padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
                }}
                placeholder={voice.listening ? 'Listening — say your command…' : 'Ask anything, tell me where to go, or hit the mic…'}
                style={{
                  flex: 1, resize: 'none', background: '#111925', color: '#e8e0d0',
                  border: '1px solid #1f2937', borderRadius: '6px', padding: '9px 11px',
                  fontSize: '13px', fontFamily: 'inherit', outline: 'none',
                }}
              />
              <AceVoiceButton
                listening={voice.listening}
                supported={voice.supported}
                onClick={voice.toggle}
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