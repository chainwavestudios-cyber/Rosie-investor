import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Loader2, Mic, PhoneCall } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AssistantChooser from './AssistantChooser';
import SarahProtofaceStage from './SarahProtofaceStage';
import StephaniAgentStage from './StephaniAgentStage';
import SarahVideoPanel from './SarahVideoPanel';
import SarahChatPanel from './SarahChatPanel';

const TIERS = ['$10k–$20k', '$20k–$40k', '$40k+'];
const YES_RE = /\b(yes|yeah|yep|yup|sure|correct|more|over|above)\b/i;
const NO_RE = /\b(no|nope|not|never|under|less|below|none|don'?t|can'?t)\b/i;

const SPOKEN_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

function tierFromText(text) {
  // "$10k–$20k", "$10k to $20k", "10,000" and "twenty thousand" all normalise to comparable tokens first.
  const value = String(text || '')
    .toLowerCase()
    .replace(/\b([a-z]+)\s+thousand\b/g, (match, word) => (SPOKEN_NUMBERS[word] ? `${SPOKEN_NUMBERS[word]} 000` : match))
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();
  if (/40k ?\+|40 ?000 ?\+|over 40|more than 40/.test(value)) return '40k+';
  if (/20k ?40k|between 20|20 000|20k to 40k/.test(value)) return '20k-40k';
  if (/10k ?20k|between 10|10 000|10k to 20k/.test(value)) return '10k-20k';
  const amount = Number((value.match(/\b(\d{1,3}) 000\b/) || [])[1] || 0) * 1000 || Number((value.match(/\b(\d{4,6})\b/) || [])[1] || 0);
  if (amount >= 40000) return '40k+';
  if (amount >= 20000) return '20k-40k';
  if (amount >= 10000) return '10k-20k';
  return '';
}

function toE164(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return '';
}

function formatFollowUp(iso) {
  try {
    return `${new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))} ET`;
  } catch {
    return '';
  }
}

export default function SarahQualifier({ token = '', source = 'landing_page', videoOnly = false, assistant = '' }) {
  const [config, setConfig] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [messages, setMessages] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [awaitingPhone, setAwaitingPhone] = useState(false);
  const [error, setError] = useState('');
  const [startSignal, setStartSignal] = useState(0);
  const [endSignal, setEndSignal] = useState(0);
  const [outcome, setOutcome] = useState(null);
  const [assistantKey, setAssistantKey] = useState('');
  const [autoStart, setAutoStart] = useState(false);

  const stepRef = useRef('debt');
  const tierRef = useRef('');
  const routedRef = useRef(false);
  const phoneRef = useRef('');
  const transcriptRef = useRef([]);
  const finishedRef = useRef(false);

  // Who they talk with: the assistant they chose, otherwise the config's own name.
  const assistants = Array.isArray(config?.assistants) ? config.assistants : [];
  const chosen = assistants.find((entry) => entry.key === assistantKey) || null;
  const agentName = chosen?.name || config?.agentName || 'Stephani';
  const name = config?.lead?.firstName || 'there';
  const stateName = config?.lead?.state || 'your area';
  const embedId = config?.protofaceEmbedId || '';
  const sessionToken = config?.sessionToken;
  // Agent-driven: our own knowledge base answers and our own voice speaks, the embed is ignored.
  const agentDriven = config?.agentDrivenMode === true;

  useEffect(() => {
    let alive = true;
    base44.functions
      .invoke('vapiQualify', { action: 'client', token, source })
      .then((res) => {
        if (!alive) return;
        setConfig(res.data || {});
        setPhase('ready');
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.response?.data?.error || err?.message || 'We could not open the qualification session.');
        setPhase('unavailable');
      });
    return () => {
      alive = false;
    };
  }, [token, source]);

  const say = useCallback((text) => setMessages((current) => [...current, { role: 'agent', text }]), []);
  const hear = useCallback((text) => setMessages((current) => [...current, { role: 'user', text }]), []);

  const openTextFlow = useCallback(() => {
    setError('');
    stepRef.current = 'debt';
    tierRef.current = '';
    setAwaitingPhone(false);
    setPhase('text');
    setQuickReplies(['Yes, more than $10,000', 'Not right now']);
    say(
      `Hey ${name}! I'm ${agentName}. I was just reviewing your profile inside the system — I noticed you're navigating some tough credit card balances over in ${stateName}, and I wanted to see if we can help you wipe them out. To make sure you qualify, do you currently owe more than $10,000 across your accounts?`,
    );
  }, [agentName, name, say, stateName]);

  const routeToTeam = useCallback(
    async (phone, tier) => {
      setPhase('routing');
      try {
        const res = await base44.functions.invoke('vapiQualify', {
          action: 'routeCall',
          sessionToken,
          phone,
          debtTier: tier || '',
        });
        if (res.data?.ok) {
          say('Awesome, hold on just one second while I patch you straight through to us!');
          setPhase('routed');
        } else {
          setError(res.data?.error || 'We could not start the call.');
          setPhase('text');
        }
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || 'We could not start the call.');
        setPhase('text');
      }
    },
    [say, sessionToken],
  );

  // Sarah's face is the Protoface conversation; her words land in the same transcript log,
  // and a phone number spoken to her is handed straight to the sales-line bridge.
  const handleStageLine = useCallback(
    ({ role, text }) => {
      setMessages((current) => [...current, { role, text }]);
      transcriptRef.current.push({ role, text });
      if (role !== 'user') return;
      const spokenTier = tierFromText(text);
      if (spokenTier) tierRef.current = spokenTier;
      if (routedRef.current) return;
      const phone = toE164(text);
      if (!phone) return;
      phoneRef.current = phone;
      routedRef.current = true;
      setEndSignal((value) => value + 1);
      void routeToTeam(phone, tierRef.current);
    },
    [routeToTeam],
  );

  const handleStageStatus = useCallback((status) => {
    if (status === 'live' || status === 'waiting_for_avatar') setPhase('live');
    else if (status === 'joining' || status === 'requesting_device_access' || status === 'confirming_consent') setPhase('connecting');
    else if (status === 'ended' || status === 'failed') {
      setPhase((current) => (['routing', 'routed', 'saving', 'saved'].includes(current) ? current : 'ready'));
    }
  }, []);

  // When the video call ends, whatever Stephani captured becomes a contact card in the
  // Debt Call Coach, and — unless the prospect was patched through live — a booked call.
  const handleStageEnded = useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (!phoneRef.current && !tierRef.current && transcriptRef.current.length === 0) return;
    setPhase((current) => (['routing', 'routed'].includes(current) ? current : 'saving'));
    try {
      const res = await base44.functions.invoke('vapiQualify', {
        action: 'finishCall',
        sessionToken,
        phone: phoneRef.current,
        debtTier: tierRef.current,
        bridged: routedRef.current,
        transcript: transcriptRef.current,
      });
      const appointment = res.data?.appointment || null;
      setOutcome({
        bridged: routedRef.current,
        appointmentLabel: appointment?.startISO ? formatFollowUp(appointment.startISO) : '',
      });
      setPhase((current) => (['routing', 'routed'].includes(current) ? current : 'saved'));
    } catch (err) {
      setPhase('ready');
      setError(err?.response?.data?.error || err?.message || 'We could not save your details.');
    }
  }, [sessionToken]);

  const answerText = (text) => {
    const value = String(text || '').trim();
    if (!value) return;
    hear(value);
    setQuickReplies([]);

    if (stepRef.current === 'phone') {
      const phone = toE164(value);
      if (!phone) {
        say('That number looks incomplete — can you type the full 10 digits?');
        return;
      }
      setAwaitingPhone(false);
      routeToTeam(phone, tierRef.current);
      return;
    }

    if (stepRef.current === 'tier') {
      const tier = tierFromText(value);
      if (!tier) {
        say('Just so I get this exactly right — is it $10k–$20k, $20k–$40k, or $40k+?');
        setQuickReplies(TIERS);
        return;
      }
      tierRef.current = tier;
      stepRef.current = 'phone';
      setAwaitingPhone(true);
      say('Perfect. Let me verify the best phone number to connect you to our team right now.');
      return;
    }

    if (NO_RE.test(value) && !YES_RE.test(value)) {
      stepRef.current = 'done';
      setPhase('done');
      say("That's completely okay — thank you for your time. If your balances start feeling heavy again, we're right here.");
      return;
    }

    if (YES_RE.test(value) || /\d{4,}/.test(value)) {
      stepRef.current = 'tier';
      setQuickReplies(TIERS);
      say("I know how heavy that can feel, but you're in the right place. Which range fits your total card balance?");
      return;
    }

    setQuickReplies(['Yes, more than $10,000', 'Not right now']);
    say('No problem at all — do you currently owe more than $10,000 across your accounts?');
  };

  if (phase === 'loading') {
    return (
      <div className={`flex w-full items-center justify-center rounded-2xl border border-white/10 bg-[#0b1220] ${videoOnly ? 'aspect-video' : 'min-h-[420px]'}`}>
        <Loader2 className="h-6 w-6 animate-spin text-sky-300" />
      </div>
    );
  }

  const busy = phase === 'connecting' || phase === 'routing';

  return (
    <div className="space-y-4">
      {token && config && !config.matched && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          We couldn't match this link to a profile — {agentName} can still qualify you right here.
        </p>
      )}
      {config && config.enabled === false && (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
          {agentName} is offline right now. Please try again shortly or call us directly.
        </p>
      )}

      <div className={videoOnly ? 'space-y-3' : 'grid gap-5 md:grid-cols-[1.4fr_1fr]'}>
        {assistants.length > 1 && agentDriven && !chosen ? (
          <AssistantChooser
            assistants={assistants}
            invited={assistant}
            onChoose={(key) => {
              setAssistantKey(key);
              setAutoStart(true);
            }}
          />
        ) : agentDriven ? (
          <StephaniAgentStage
            key={assistantKey}
            sessionToken={sessionToken}
            agentName={agentName}
            leadName={config?.lead?.firstName}
            startSignal={startSignal}
            endSignal={endSignal}
            assistant={assistantKey}
            autoStart={autoStart}
            onLine={handleStageLine}
            onStatus={handleStageStatus}
            onEnded={handleStageEnded}
          />
        ) : embedId ? (
          <SarahProtofaceStage
            embedId={embedId}
            agentName={agentName}
            leadName={config?.lead?.firstName}
            startSignal={startSignal}
            endSignal={endSignal}
            onLine={handleStageLine}
            onStatus={handleStageStatus}
            onEnded={handleStageEnded}
          />
        ) : (
          <SarahVideoPanel
            agentName={agentName}
            speaking={false}
            phase={phase}
            embedUrl={config?.protofaceEmbedUrl}
            leadName={config?.lead?.firstName}
          />
        )}

        <div className="flex flex-col gap-3">
          {!videoOnly && (
            <>
              <SarahChatPanel
                agentName={agentName}
                messages={messages}
                quickReplies={quickReplies}
                onReply={answerText}
                onSend={answerText}
                awaitingPhone={awaitingPhone}
                disabled={busy || phase === 'live' || phase === 'unavailable'}
                placeholder={phase === 'live' ? `Talking with ${agentName}…` : undefined}
              />

              {phase === 'ready' && (
                <button
                  type="button"
                  onClick={openTextFlow}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-200 hover:bg-white/5"
                >
                  <Keyboard className="h-4 w-4" />
                  Type instead
                </button>
              )}

              {phase === 'text' && (agentDriven || embedId) && (
                <button
                  type="button"
                  onClick={() => {
                    setPhase('ready');
                    setStartSignal((value) => value + 1);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-200 hover:bg-white/5"
                >
                  <Mic className="h-4 w-4" />
                  Use my voice instead
                </button>
              )}
            </>
          )}

          {assistants.length > 1 && chosen && !busy && ['ready', 'saved', 'done'].includes(phase) && (
            <button
              type="button"
              onClick={() => {
                setAssistantKey('');
                setAutoStart(false);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-200 hover:bg-white/5"
            >
              ↺ Choose a different assistant
            </button>
          )}

          {phase === 'saving' && <p className="text-sm text-slate-300">Saving your details…</p>}

          {outcome && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
              <p>
                {outcome.bridged
                  ? "You're all set — a specialist is picking up your call now."
                  : `Saved — your details are with our team${outcome.appointmentLabel ? `, and your call is booked for ${outcome.appointmentLabel}` : ''}.`}
              </p>
              {!outcome.bridged && phoneRef.current && (
                <button
                  type="button"
                  onClick={() => routeToTeam(phoneRef.current, tierRef.current)}
                  className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-50 hover:bg-emerald-500/25"
                >
                  <PhoneCall className="h-4 w-4" />
                  Talk to a specialist now
                </button>
              )}
            </div>
          )}

          {(phase === 'routing' || phase === 'routed') && (
            <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
              <PhoneCall className="h-4 w-4" />
              {phase === 'routing' ? 'Patching you through…' : 'Pick up your phone — we are connecting you now'}
            </div>
          )}

          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>
      </div>
    </div>
  );
}