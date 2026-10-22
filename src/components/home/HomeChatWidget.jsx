import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import HomeChatMessages from '@/components/home/HomeChatMessages';
import HomeChatComposer from '@/components/home/HomeChatComposer';
import HomeChatCallForm from '@/components/home/HomeChatCallForm';
import MailerIdSearch from '@/components/home/MailerIdSearch';

const TIERS = ['Less than $20,000', '$20,000 - $40,000', 'More than $40,000'];
const OPENING = 'How much credit card debt are you carrying right now?';
const TOKEN_KEY = 'home_chat_session_token';
const POLL_MS = 4000;

/** One token per browser tab — the command center sees one tab per visitor. */
function visitorToken() {
  let token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `v${Date.now()}${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export default function HomeChatWidget({ leadProfile, onLeadFound }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: OPENING }]);
  const [quickReplies, setQuickReplies] = useState(TIERS);
  const [collected, setCollected] = useState({});
  const [readyForCall, setReadyForCall] = useState(false);
  const [sending, setSending] = useState(false);
  const [callState, setCallState] = useState({ status: 'idle', message: '' });
  const [specialistMode, setSpecialistMode] = useState(false);
  const [sessionToken] = useState(visitorToken);
  const seenSpecialist = useRef(new Set());

  // Watch for a specialist joining the chat from the command center.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const response = await base44.functions.invoke('homeQualifyChat', {
          action: 'poll',
          sessionToken,
        });
        const data = response?.data || {};
        if (!alive) return;
        if (data.status === 'human') setSpecialistMode(true);
        const fresh = (data.messages || []).filter((m) => m?.id && !seenSpecialist.current.has(m.id));
        if (fresh.length === 0) return;
        fresh.forEach((m) => seenSpecialist.current.add(m.id));
        setQuickReplies([]);
        setMessages((prev) => [
          ...prev,
          ...fresh.map((m) => ({ role: 'specialist', text: m.text, authorName: m.authorName || '' })),
        ]);
      } catch {
        /* the browser retries on the next tick */
      }
    };
    tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [sessionToken]);

  // The visitor's contact card tells us who they are before they type anything.
  useEffect(() => {
    if (!leadProfile?.firstName) return;
    setCollected((prev) => ({
      ...prev,
      firstName: prev.firstName || leadProfile.firstName || '',
      lastName: prev.lastName || leadProfile.lastName || '',
      state: prev.state || leadProfile.state || '',
    }));
  }, [leadProfile?.firstName, leadProfile?.lastName, leadProfile?.state]);

  const send = async (text) => {
    const clean = String(text || '').trim();
    if (!clean || sending) return;
    const next = [...messages, { role: 'user', text: clean }];
    setMessages(next);
    setQuickReplies([]);
    setSending(true);
    try {
      const response = await base44.functions.invoke('homeQualifyChat', {
        action: 'chat',
        message: clean,
        sessionToken,
        pagePath: window.location.pathname,
        history: next.slice(-12).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
        collected,
      });
      const data = response?.data || {};
      if (data.error) throw new Error(data.error);
      // A specialist has the chat — their reply arrives on the next poll.
      if (data.humanTakeover) {
        setSpecialistMode(true);
        setSending(false);
        return;
      }
      setMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
      setCollected(data.collected || collected);
      setReadyForCall(!!data.readyForCall);
      setQuickReplies(data.quickReplies || []);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'I lost that connection for a second. Could you send that again?' },
      ]);
    }
    setSending(false);
  };

  const requestCall = async ({ phone, consent }) => {
    setCallState({ status: 'calling', message: '' });
    try {
      const response = await base44.functions.invoke('homeQualifyChat', {
        action: 'request_call',
        phone,
        consent,
        firstName: collected.firstName || '',
        lastName: collected.lastName || '',
        state: collected.state || '',
        debtTier: collected.debtTier || '',
        notes: messages.map((m) => `${m.role === 'user' ? 'Visitor' : 'Assistant'}: ${m.text}`).join('\n'),
      });
      const data = response?.data || {};
      if (data.ok) {
        setCallState({ status: 'placed', message: data.message });
        setReadyForCall(false);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: 'Your call is going out now. Pick up and stay on the line, and I will bring a specialist in with you.' },
        ]);
      } else {
        setCallState({ status: 'error', message: data.message || data.error || 'We could not place the call just now.' });
      }
    } catch (error) {
      const detail = error?.response?.data || {};
      setCallState({
        status: 'error',
        message: detail.message || detail.error || 'We could not place the call just now. Please try again.',
      });
    }
  };

  const facts = [
    collected.firstName && `Name: ${collected.firstName}`,
    collected.state && `State: ${collected.state}`,
    collected.debtTier && `Debt: ${collected.debtTier}`,
  ].filter(Boolean);

  return (
    <section id="chat" className="mx-auto mt-8 w-full max-w-xl" style={{ scrollMarginTop: '20px' }}>
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0b1220] shadow-[0_20px_50px_rgba(11,18,32,0.28)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <span className="inline-flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white text-[#1a0b2e]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold text-white">State Rate Reduction Qualification</span>
              <span className="mt-0.5 block text-[10px] font-medium text-white/55">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-teal-400 align-middle" />
                Online · Live
              </span>
            </span>
          </span>
          <MailerIdSearch onFound={onLeadFound} />
        </header>

        {facts.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-2.5">
            {facts.map((fact) => (
              <span key={fact} className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-[11px] text-white/75">
                {fact}
              </span>
            ))}
          </div>
        )}

        <HomeChatMessages messages={messages} quickReplies={quickReplies} onReply={send} sending={sending} />

        {readyForCall && callState.status !== 'placed' && (
          <HomeChatCallForm onRequestCall={requestCall} calling={callState.status === 'calling'} state={callState} />
        )}

        {!readyForCall && callState.status === 'error' && (
          <p className="border-t border-white/10 px-4 py-3 text-xs text-amber-200">{callState.message}</p>
        )}

        {specialistMode && (
          <p className="border-t border-emerald-400/20 bg-emerald-400/10 px-4 py-2.5 text-xs text-emerald-100">
            A Debt Solutions specialist has joined the chat.
          </p>
        )}

        <HomeChatComposer
          onSend={send}
          disabled={sending}
          placeholder={specialistMode ? 'Message the specialist' : 'Ask a question or answer here'}
        />
      </div>
    </section>
  );
}