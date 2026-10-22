import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Loader2, Mic, PhoneCall } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SarahProtofaceStage from './SarahProtofaceStage';
import SarahVideoPanel from './SarahVideoPanel';
import SarahChatPanel from './SarahChatPanel';

const TIERS = ['$5k–$10k', '$10k–$20k', '$20k+'];
const YES_RE = /\b(yes|yeah|yep|yup|sure|correct|more|over|above)\b/i;
const NO_RE = /\b(no|nope|not|never|under|less|below|none|don'?t|can'?t)\b/i;

function tierFromText(text) {
  // "$10k–$20k", "$10k to $20k" and "10,000" all normalise to comparable tokens first.
  const value = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();
  if (/20k ?\+|20 ?000 ?\+|over 20|more than 20/.test(value)) return '20k+';
  if (/10k ?20k|between 10|10 000|10k to 20k/.test(value)) return '10k-20k';
  if (/5k ?10k|between 5|5 000|5k to 10k/.test(value)) return '5k-10k';
  return '';
}

function toE164(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return '';
}

export default function SarahQualifier({ token = '', source = 'landing_page', videoOnly = false }) {
  const [config, setConfig] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [messages, setMessages] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [awaitingPhone, setAwaitingPhone] = useState(false);
  const [error, setError] = useState('');
  const [startSignal, setStartSignal] = useState(0);
  const [endSignal, setEndSignal] = useState(0);

  const stepRef = useRef('debt');
  const tierRef = useRef('');
  const routedRef = useRef(false);

  const agentName = config?.agentName || 'Stephani';
  const name = config?.lead?.firstName || 'there';
  const stateName = config?.lead?.state || 'your area';
  const embedId = config?.protofaceEmbedId || '';
  const sessionToken = config?.sessionToken;

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
    setQuickReplies(['Yes, more than $5,000', 'Not right now']);
    say(
      `Hey ${name}! I'm ${agentName}. I was just reviewing your profile inside the system — I noticed you're navigating some tough credit card balances over in ${stateName}, and I wanted to see if we can help you wipe them out. To make sure you qualify, do you currently owe more than $5,000 across your accounts?`,
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
      if (role !== 'user' || routedRef.current) return;
      const phone = toE164(text);
      if (!phone) return;
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
      setPhase((current) => (current === 'routing' || current === 'routed' ? current : 'ready'));
    }
  }, []);

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
        say('Just so I get this exactly right — is it $5k–$10k, $10k–$20k, or $20k+?');
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

    setQuickReplies(['Yes, more than $5,000', 'Not right now']);
    say('No problem at all — do you currently owe more than $5,000 across your accounts?');
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
        {embedId ? (
          <SarahProtofaceStage
            embedId={embedId}
            agentName={agentName}
            leadName={config?.lead?.firstName}
            startSignal={startSignal}
            endSignal={endSignal}
            onLine={handleStageLine}
            onStatus={handleStageStatus}
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

              {phase === 'text' && embedId && (
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