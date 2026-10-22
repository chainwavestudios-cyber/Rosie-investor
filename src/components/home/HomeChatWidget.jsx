import React, { useState } from 'react';
import { MessagesSquare, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import HomeChatMessages from '@/components/home/HomeChatMessages';
import HomeChatComposer from '@/components/home/HomeChatComposer';
import HomeChatCallForm from '@/components/home/HomeChatCallForm';

const TIERS = ['Less than $20,000', '$20,000 - $40,000', 'More than $40,000'];
const GREETING =
  "Hi, I'm the Debt Solutions assistant. I can answer anything about how the program works and get you set up with a free evaluation. How much credit card debt are you carrying right now?";

export default function HomeChatWidget() {
  const [messages, setMessages] = useState([{ role: 'assistant', text: GREETING }]);
  const [quickReplies, setQuickReplies] = useState(TIERS);
  const [collected, setCollected] = useState({});
  const [readyForCall, setReadyForCall] = useState(false);
  const [sending, setSending] = useState(false);
  const [callState, setCallState] = useState({ status: 'idle', message: '' });

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
        history: next.slice(-12).map((m) => ({ role: m.role, content: m.text })),
        collected,
      });
      const data = response?.data || {};
      if (data.error) throw new Error(data.error);
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
    <section id="chat" className="mx-auto mt-10 w-full max-w-3xl" style={{ scrollMarginTop: '20px' }}>
      <div className="overflow-hidden rounded-2xl border border-sky-400/20 bg-[#0b1220] shadow-[0_30px_80px_rgba(0,0,0,0.25)]">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-100">
            <MessagesSquare className="h-4 w-4 text-sky-300" />
            Debt Solutions Assistant
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
            Answers come from our own program knowledge base
          </span>
        </header>

        {facts.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-2.5">
            {facts.map((fact) => (
              <span key={fact} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
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

        <HomeChatComposer onSend={send} disabled={sending} />
      </div>
    </section>
  );
}