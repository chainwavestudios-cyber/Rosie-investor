/**
 * InterviewAssistant.jsx — Floating AI chatbot for the interview page.
 * Listens to the interviewer (via speech-to-text or text input), provides
 * real-time guidance, suggested prompts, and quick reference on company
 * info, pay, and training schedule. Context-aware of the current step.
 */
import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';

const STEP_CONTEXTS = {
  1: 'Collecting the candidate\'s first and last name.',
  2: 'Confirming the candidate\'s Telegram ID and email address.',
  3: 'Reading the company background script — debt settlement, BBB ethics award, connecting consumers with debt solutions.',
  4: 'Asking about phone experience, objection handling, and script reading comfort.',
  5: 'Explaining job details — $300/month base, bonuses, portal, dialer agreement, training schedule.',
  6: 'Setting up fronter credentials — auto-generated username, password, email. Creating the user account.',
  7: 'Interview complete — candidate hired or passed.',
};

const SUGGESTED_PROMPTS = {
  1: ['How do I start the interview?', 'What should I say to introduce myself?'],
  2: ['Why do we need their Telegram ID?', 'What if they don\'t have Telegram?'],
  3: ['What if they ask the company name?', 'How do I explain the BBB award?', 'How do I transition to the transfer?'],
  4: ['What if they have no phone experience?', 'How do I assess if they\'re good?', 'What if they say they can\'t read scripts?'],
  5: ['How do I explain the bonus structure?', 'What if they ask about base pay?', 'What if they can\'t start immediately?'],
  6: ['How is the username generated?', 'What happens after I create the user?', 'What does the email contain?'],
};

function buildSystemPrompt(step, stepLabel, candidateData) {
  return `You are an AI assistant helping an interviewer conduct a phone interview for a debt settlement "fronter" (cold caller) position.

CURRENT STEP: ${stepLabel}
WHAT'S HAPPENING: ${STEP_CONTEXTS[step] || 'Interview in progress'}
CANDIDATE: ${candidateData.firstName || 'Unknown'} ${candidateData.lastName || ''}
${candidateData.telegramId ? `TELEGRAM: ${candidateData.telegramId}` : ''}
${candidateData.email ? `EMAIL: ${candidateData.email}` : ''}

Help the interviewer by answering questions, suggesting what to say or ask next, helping with objections, and providing quick reference. Be concise and direct — the interviewer is on a live call.

KEY REFERENCE INFO:
- Company: Debt settlement company. Came in 2nd place NATIONWIDE for the annual BBB ethics award (all US businesses). Only one company ahead of them.
- Role: Not selling anything. Connecting consumers drowning in debt with a solution — debt free, reduced debt load, increased monthly cash flow within weeks.
- Transfer: Chris Bongiorno, Sr Debt Specialist.
- Pay: $300/month base, paid on the 1st and 15th. Plus daily deal and volume bonuses.
- Portal: First login → fill out form → sign dialer agreement → auto counter-signed → emailed copy or download.
- Training: Tonight 8:30 PM EST (Zoom link emailed). 2nd class tomorrow 12 PM EST.
- Deadline: Must be trained by Oct 11th. Working hours 11 AM - 7:30 PM EST Monday.
- Default password: fronter2026!! (forced change on first login).
- Username format: First name + first initial of last name (e.g. chrisb).`;
}

export default function InterviewAssistant({ step, stepLabel, candidateData }) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const recognitionRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  const send = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || thinking) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setThinking(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `${buildSystemPrompt(step, stepLabel, candidateData)}\n\nInterviewer asks: ${text}`,
      });
      const reply = typeof res === 'string' ? res : (res?.data?.response || res?.data || res?.response || 'Sorry, I could not process that.');
      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I had trouble processing that. Please try again.' }]);
    }
    setThinking(false);
  };

  const toggleListen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition is not supported in this browser. Try Chrome.'); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
      setInput(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} title="AI Interview Assistant"
        style={{ position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', fontSize: '26px',
          cursor: 'pointer', boxShadow: '0 4px 20px rgba(16,185,129,0.4)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🤖</button>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, width: 360, height: 520, background: '#0d1b2a',
      border: `1px solid ${GOLD}44`, borderRadius: '12px', boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
      zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(16,185,129,0.08), transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🤖</span>
          <div>
            <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>AI Assistant</div>
            <div style={{ color: '#6b7280', fontSize: '10px' }}>{stepLabel} · {candidateData.firstName || 'No candidate'}</div>
          </div>
        </div>
        <button onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' }}>×</button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.length === 0 && (
          <div style={{ color: '#8a9ab8', fontSize: '12px', textAlign: 'center', padding: '16px 8px' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🤖</div>
            <div style={{ marginBottom: '6px' }}>I'm listening. Ask me anything — what to say next, how to handle objections, or quick reference on pay and training.</div>
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(SUGGESTED_PROMPTS[step] || ['What should I do next?', 'Help me with this step']).map((prompt, i) => (
                <button key={i} onClick={() => send(prompt)}
                  style={{ background: 'rgba(16,185,129,0.08)', color: GOLD, border: `1px solid ${GOLD}33`,
                    borderRadius: '6px', padding: '7px 10px', cursor: 'pointer', fontSize: '11px', textAlign: 'left',
                    fontFamily: 'Georgia, serif' }}>{prompt}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{ background: msg.role === 'user' ? 'rgba(96,165,250,0.15)' : 'rgba(16,185,129,0.1)',
              color: msg.role === 'user' ? '#60a5fa' : '#e8e0d0',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              padding: '8px 12px', fontSize: '13px', lineHeight: 1.5, fontFamily: 'Georgia, serif',
              whiteSpace: 'pre-wrap' }}>{msg.text}</div>
          </div>
        ))}
        {thinking && <div style={{ color: '#6b7280', fontSize: '12px', alignSelf: 'flex-start', padding: '4px 12px' }}>🤖 thinking…</div>}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
        <button onClick={toggleListen} title={listening ? 'Stop listening' : 'Speak to the assistant'}
          style={{ background: listening ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
            color: listening ? RED : '#8a9ab8',
            border: `1px solid ${listening ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: '6px', padding: '8px 10px', cursor: 'pointer', fontSize: '16px', flexShrink: 0 }}>🎤</button>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1} placeholder="Ask the AI…"
          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '6px', padding: '8px 10px', color: '#e8e0d0', fontSize: '13px', outline: 'none',
            resize: 'none', maxHeight: '80px', fontFamily: 'Georgia, serif' }} />
        <button onClick={() => send()} disabled={!input.trim() || thinking}
          style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none',
            borderRadius: '6px', padding: '8px 14px', cursor: !input.trim() || thinking ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: 'bold', opacity: !input.trim() || thinking ? 0.5 : 1, flexShrink: 0 }}>➤</button>
      </div>
    </div>
  );
}