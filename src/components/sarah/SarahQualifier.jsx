import React, { useCallback, useEffect, useRef, useState } from 'react';
import Vapi from '@vapi-ai/web';
import { Keyboard, Loader2, Mic, PhoneCall } from 'lucide-react';
import { base44 } from '@/api/base44Client';
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

export default function SarahQualifier({ token = '', source = 'landing_page' }) {
  const [config, setConfig] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [messages, setMessages] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  const [quickReplies, setQuickReplies] = useState([]);
  const [awaitingPhone, setAwaitingPhone] = useState(false);
  const [error, setError] = useState('');

  const vapiRef = useRef(null);
  const stepRef = useRef('debt');
  const tierRef = useRef('');

  const agentName = config?.agentName || 'Sarah';
  const name = config?.lead?.firstName || 'there';
  const stateName = config?.lead?.state || 'your area';

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

  const stopVoice = useCallback(() => {
    try {
      vapiRef.current?.stop();
    } catch {
      // the call is already closed
    }
    vapiRef.current = null;
  }, []);

  useEffect(() => stopVoice, [stopVoice]);

  const say = (text) => setMessages((current) => [...current, { role: 'agent', text }]);
  const hear = (text) => setMessages((current) => [...current, { role: 'user', text }]);

  const openTextFlow = useCallback(() => {
    stopVoice();
    setSpeaking(false);
    setError('');
    stepRef.current = 'debt';
    tierRef.current = '';
    setAwaitingPhone(false);
    setPhase('text');
    setQuickReplies(['Yes, more than $5,000', 'Not right now']);
    say(
      `Hey ${name}! I'm ${agentName}. I was just reviewing your profile inside the system — I noticed you're navigating some tough credit card balances over in ${stateName}, and I wanted to see if we can help you wipe them out. To make sure you qualify, do you currently owe more than $5,000 across your accounts?`,
    );
  }, [agentName, name, stateName, stopVoice]);

  const routeToTeam = async (phone, tier) => {
    setPhase('routing');
    try {
      const res = await base44.functions.invoke('vapiQualify', {
        action: 'routeCall',
        sessionToken: config?.sessionToken,
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
  };

  const startVoice = async () => {
    if (!config?.assistantId || !config?.publicKey) {
      openTextFlow();
      return;
    }
    setError('');
    setPhase('connecting');

    const vapi = new Vapi(config.publicKey);
    vapiRef.current = vapi;

    vapi.on('call-start', () => setPhase('live'));
    vapi.on('speech-start', () => setSpeaking(true));
    vapi.on('speech-end', () => setSpeaking(false));
    vapi.on('message', (msg) => {
      if (msg?.type !== 'transcript' || msg?.transcriptType !== 'final') return;
      const text = String(msg.transcript || '').trim();
      if (!text) return;
      setMessages((current) => [...current, { role: msg.role === 'user' ? 'user' : 'agent', text }]);
    });
    vapi.on('tool-calls', () => setPhase('routing'));
    vapi.on('call-end', () => {
      setSpeaking(false);
      setPhase((current) => (current === 'routing' || current === 'routed' ? current : 'ready'));
    });
    vapi.on('error', () => {
      setSpeaking(false);
      openTextFlow();
    });

    try {
      const call = await vapi.start(config.assistantId, {
        variableValues: { name, state: stateName },
        metadata: { sessionToken: config?.sessionToken },
      });
      if (call?.id) {
        base44.functions
          .invoke('vapiQualify', { action: 'attachCall', sessionToken: config?.sessionToken, vapiCallId: call.id })
          .catch(() => {});
      }
    } catch {
      openTextFlow();
    }
  };

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

  const sendTyped = (text) => {
    if (phase === 'live' && vapiRef.current?.send) {
      hear(text);
      try {
        vapiRef.current.send({ type: 'add-message', message: { role: 'user', content: text } });
      } catch {
        // Vapi will pick the typed line up on the next turn
      }
      return;
    }
    answerText(text);
  };

  if (phase === 'loading') {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-white/10 bg-[#0b1220]">
        <Loader2 className="h-6 w-6 animate-spin text-sky-300" />
      </div>
    );
  }

  const busy = phase === 'connecting' || phase === 'routing';
  const canTalk = !!config?.assistantId && !!config?.publicKey;

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

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <SarahVideoPanel
          agentName={agentName}
          speaking={speaking}
          phase={phase}
          embedUrl={config?.protofaceEmbedUrl}
          leadName={config?.lead?.firstName}
          note={config?.protofaceEmbedUrl ? '' : 'voice live now'}
        />

        <div className="flex flex-col gap-3">
          <SarahChatPanel
            agentName={agentName}
            messages={messages}
            quickReplies={quickReplies}
            onReply={answerText}
            onSend={sendTyped}
            awaitingPhone={awaitingPhone}
            disabled={busy || phase === 'unavailable'}
          />

          {phase === 'ready' && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={startVoice}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 px-4 py-3 text-sm font-semibold text-[#0b1220]"
              >
                <Mic className="h-4 w-4" />
                Start video call with {agentName}
              </button>
              <button
                type="button"
                onClick={openTextFlow}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-200 hover:bg-white/5"
              >
                <Keyboard className="h-4 w-4" />
                Type instead
              </button>
            </div>
          )}

          {phase === 'connecting' && (
            <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting {agentName}…
            </div>
          )}

          {phase === 'text' && canTalk && (
            <button
              type="button"
              onClick={startVoice}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-200 hover:bg-white/5"
            >
              <Mic className="h-4 w-4" />
              Use my voice instead
            </button>
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