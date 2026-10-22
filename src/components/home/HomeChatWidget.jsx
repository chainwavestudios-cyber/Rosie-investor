import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import HomeChatMessages from '@/components/home/HomeChatMessages';
import HomeChatComposer from '@/components/home/HomeChatComposer';
import HomeChatCallForm from '@/components/home/HomeChatCallForm';
import HomeChatDebtSlider from '@/components/home/HomeChatDebtSlider';
import MailerIdSearch from '@/components/home/MailerIdSearch';

const OPENING = "Let's see what you may qualify for. First, what is your first and last name?";
const WIDGET_TITLE = 'State Rate Reduction Qualification';
const WIDGET_STATUS = 'Online · Live';
const TOKEN_KEY = 'home_chat_session_token';
const POLL_MS = 4000;

/** Everything we hold on the visitor's file, ready for the chat card. */
function fileFields(profile) {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  return [
    name && { label: 'Name', value: name },
    profile.address && { label: 'Address', value: profile.address },
    profile.phone && { label: 'Phone', value: profile.phone },
    profile.state && { label: 'State', value: profile.state },
    profile.noticeId && { label: 'Notice ID', value: profile.noticeId },
    profile.leadNumber && { label: 'Lead No.', value: profile.leadNumber },
    typeof profile.homeValue === 'number' && profile.homeValue > 0 && { label: 'Home Value', value: `$${profile.homeValue.toLocaleString()}` },
    typeof profile.linesOfCredit === 'number' && { label: 'Tradelines', value: String(profile.linesOfCredit) },
  ].filter(Boolean);
}

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
  const [messages, setMessages] = useState([]);
  const [stage, setStage] = useState('debt');
  const [opening, setOpening] = useState(OPENING);
  const [widget, setWidget] = useState({ title: WIDGET_TITLE, status: WIDGET_STATUS });
  const [quickReplies, setQuickReplies] = useState([]);
  const [collected, setCollected] = useState({});
  const [readyForCall, setReadyForCall] = useState(false);
  const [sending, setSending] = useState(false);
  const [callState, setCallState] = useState({ status: 'idle', message: '' });
  const [specialistMode, setSpecialistMode] = useState(false);
  const [sessionToken] = useState(visitorToken);
  const [pulled, setPulled] = useState(null);
  const seenSpecialist = useRef(new Set());
  const messagesRef = useRef(messages);
  const pulledRef = useRef('');

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

  // The front-page admin sets the widget's title, status line and opening message.
  useEffect(() => {
    let alive = true;
    base44.functions
      .invoke('homeQualifyChat', { action: 'widget_config' })
      .then((response) => {
        const data = response?.data || {};
        if (!alive || !data.widgetTitle) return;
        setWidget({ title: data.widgetTitle, status: data.widgetStatusText || WIDGET_STATUS });
        if (data.openingMessage) setOpening(data.openingMessage);
      })
      .catch(() => {
        /* keep the built-in wording */
      });
    return () => {
      alive = false;
    };
  }, []);

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

  // Keep the latest messages within reach of the pulled-file flow.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // A file came up in the search — put it in the chat and keep the questions going.
  useEffect(() => {
    if (!pulled?.id || pulledRef.current === pulled.id) return;
    pulledRef.current = pulled.id;
    openPulledFile(pulled);
  }, [pulled]);

  // One turn with the qualification bot — shared by the visitor's messages and the
  // moment their file is pulled up.
  const turn = async (userText, history) => {
    setSending(true);
    try {
      const response = await base44.functions.invoke('homeQualifyChat', {
        action: 'chat',
        message: userText,
        sessionToken,
        pagePath: window.location.pathname,
        history: history.slice(-12).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
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

  /** A successful Mailer ID search opens the visitor's file — show it, then carry on qualifying. */
  const openPulledFile = async (profile) => {
    setStage('chat');
    const fields = fileFields(profile);
    const record = {
      role: 'record',
      text: `The file on record: ${fields.map((field) => `${field.label}: ${field.value}`).join('; ')}.`,
      fields,
    };
    const next = [...messagesRef.current, record];
    setMessages(next);
    setQuickReplies([]);
    await turn('I just searched my Mailer ID and my file came up. Please go ahead with the questions.', next);
  };

  const send = async (text) => {
    const clean = String(text || '').trim();
    if (!clean || sending) return;
    const next = [...messages, { role: 'user', text: clean }];
    setMessages(next);
    setQuickReplies([]);
    await turn(clean, next);
  };

  /** The slider answer lands in the chat, then the bot asks for their name. */
  const startWithDebt = (amount) => {
    const formatted = `$${Number(amount).toLocaleString()}`;
    setStage('chat');
    setMessages([
      { role: 'user', text: `My total debt is about ${formatted}.` },
      { role: 'assistant', text: opening },
    ]);
    setQuickReplies([]);
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
        email: collected.email || '',
        phone: collected.phone || '',
        state: collected.state || '',
        debtTier: collected.debtTier || '',
        monthlyPayment: collected.monthlyPayment || '',
        cardholderStatus: collected.cardholderStatus || '',
        hardship: collected.hardship || '',
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
    pulled?.noticeId && `File: ${pulled.noticeId}`,
    pulled?.phone && `Phone: ${pulled.phone}`,
  ].filter(Boolean);

  return (
    <section id="chat" className="w-full" style={{ scrollMarginTop: '20px' }}>
      <div className="flex flex-col overflow-hidden rounded-3xl bg-home-card text-home-ink shadow-2xl ring-1 ring-home-line">
        <div className="flex flex-1 flex-col">
        <header className="flex flex-col gap-3 border-b border-home-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full bg-home-navy text-home-accent">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-semibold text-home-ink">{widget.title}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-home-muted-ink">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-home-accent opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-home-accent" />
                </span>
                {widget.status}
              </span>
            </span>
          </span>
          <MailerIdSearch
            onFound={(profile) => {
              setPulled(profile);
              onLeadFound?.(profile);
            }}
          />
        </header>

        {facts.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-home-line bg-home-canvas px-4 py-2.5">
            {facts.map((fact) => (
              <span key={fact} className="rounded-full border border-home-line bg-home-card px-3 py-1 text-[11px] text-home-muted-ink">
                {fact}
              </span>
            ))}
          </div>
        )}

        {stage === 'debt' ? (
          <HomeChatDebtSlider onSubmit={startWithDebt} />
        ) : (
          <>
            <HomeChatMessages messages={messages} quickReplies={quickReplies} onReply={send} sending={sending} />

            {readyForCall && callState.status !== 'placed' && (
              <HomeChatCallForm
                onRequestCall={requestCall}
                calling={callState.status === 'calling'}
                state={callState}
                defaultPhone={collected.phone || ''}
              />
            )}

            {!readyForCall && callState.status === 'error' && (
              <p className="border-t border-home-line bg-home-canvas px-4 py-3 text-xs text-amber-700">{callState.message}</p>
            )}

            {specialistMode && (
              <p className="border-t border-home-line bg-home-canvas px-4 py-2.5 text-xs text-home-muted-ink">
                A Debt Solutions specialist has joined the chat.
              </p>
            )}

            <HomeChatComposer
              onSend={send}
              disabled={sending}
              placeholder={specialistMode ? 'Message the specialist' : 'Ask a question or answer here'}
            />
          </>
        )}
        </div>
      </div>
    </section>
  );
}