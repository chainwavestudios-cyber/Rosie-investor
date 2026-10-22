import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ProtofaceAvatar, useProtofaceConversation } from 'protoface-client/react';
import { Loader2, Mic, MicOff, PhoneOff, Video } from 'lucide-react';

const STATUS_LABEL = {
  loading: 'Loading the video room…',
  device_access_required: 'Microphone needed',
  requesting_device_access: 'Waiting for your microphone…',
  consent_required: 'Please accept to continue',
  confirming_consent: 'Saving your choice…',
  ready_to_begin: 'Ready when you are',
  joining: 'Joining the call…',
  waiting_for_avatar: 'Bringing the video on screen…',
  live: 'Live',
  ending: 'Ending the call…',
  ended: 'Call ended',
  failed: 'Connection problem',
};

const STARTABLE = ['device_access_required', 'consent_required', 'ready_to_begin', 'ended', 'failed'];

const PROTOFACE_API_BASE = 'https://api.protoface.com';

// The avatar service hands back some assets as relative paths — they only resolve against its own API.
function resolveAssetUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:')) return value;
  return `${PROTOFACE_API_BASE}/${value.replace(/^\/+/, '')}`;
}

export default function SarahProtofaceStage({
  embedId,
  agentName = 'Sarah',
  leadName,
  startSignal = 0,
  endSignal = 0,
  onLine,
  onStatus,
}) {
  const conversation = useProtofaceConversation({ embedId });
  const [startRequested, setStartRequested] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);

  const advancingRef = useRef(false);
  const seenRef = useRef(new Set());
  const startSignalRef = useRef(startSignal);
  const endSignalRef = useRef(endSignal);

  const { status, config, consent, error } = conversation;
  const onStage = status === 'live' || status === 'waiting_for_avatar';
  const needsConsent = consent?.enabled === true;
  const title = config?.cta_title || `Talk with ${agentName}`;
  const description = config?.cta_description || '';
  const buttonLabel = config?.cta_button_label || `Start video call with ${agentName}`;
  const portraitUrl = resolveAssetUrl(config?.portrait_url);
  const acknowledgement = [
    consent?.text || 'I agree to speak with the assistant.',
    config?.computer_vision_enabled
      ? consent?.computer_vision_text || 'Enable camera access to let the assistant see you.'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const busy = startRequested || ['joining', 'requesting_device_access', 'confirming_consent'].includes(status);
  const canStart = !busy && (!needsConsent || consentChecked) && STARTABLE.includes(status);
  const label = STATUS_LABEL[status] || 'Ready';

  useEffect(() => {
    onStatus?.(status);
  }, [status, onStatus]);

  useEffect(() => {
    const off = conversation.on('transcript', (event) => {
      if (!event || event.final !== true) return;
      const text = String(event.text || event.content || '').trim();
      if (!text) return;
      const key = String(event.id || `${event.role || 'agent'}:${text}`);
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      onLine?.({ role: event.role === 'user' ? 'user' : 'agent', text });
    });
    return () => off?.();
  }, [conversation, onLine]);

  useEffect(() => {
    const off = conversation.on('microphone_changed', (payload) => setMicEnabled(!!payload?.enabled));
    return () => off?.();
  }, [conversation]);

  const begin = useCallback(async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setStartRequested(true);
    try {
      const controller = conversation.conversation;
      if (controller.state.ended || controller.state.failed) await conversation.restart();
      if (controller.state.device_access_required) await conversation.requestPermissions();
      if (controller.state.consent_required) await conversation.acceptConsent();
      if (controller.state.ready_to_begin) await conversation.start();
    } finally {
      advancingRef.current = false;
      setStartRequested(false);
    }
  }, [conversation]);

  useEffect(() => {
    if (startSignal === startSignalRef.current) return;
    startSignalRef.current = startSignal;
    void begin();
  }, [startSignal, begin]);

  useEffect(() => {
    if (endSignal === endSignalRef.current) return;
    endSignalRef.current = endSignal;
    void conversation.end();
  }, [endSignal, conversation]);

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-400/20 bg-[#0b1220] shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
      <div className="relative aspect-video w-full">
        <ProtofaceAvatar
          conversation={conversation.conversation}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {!onStage && (
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(14,165,233,0.28),#0b1220_68%)] px-6 text-center">
            {portraitUrl && (
              <img
                src={portraitUrl}
                alt={agentName}
                className="absolute inset-0 h-full w-full object-cover opacity-30"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div className="relative flex max-w-md flex-col items-center gap-3">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-sky-600 text-2xl font-semibold text-[#0b1220]">
                {agentName.charAt(0)}
              </span>
              <div>
                <p className="text-base font-semibold text-slate-100">{title}</p>
                {description && <p className="mt-1 text-sm text-slate-300">{description}</p>}
              </div>

              {needsConsent && (
                <label className="flex items-start gap-2 text-left text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(event) => setConsentChecked(event.currentTarget.checked)}
                    className="mt-0.5 h-4 w-4 accent-sky-400"
                  />
                  <span>{acknowledgement}</span>
                </label>
              )}

              <button
                type="button"
                onClick={() => void begin()}
                disabled={!canStart}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 px-4 py-3 text-sm font-semibold text-[#0b1220] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                {busy ? 'Starting…' : buttonLabel}
              </button>

              {status === 'failed' && error?.message && <p className="text-xs text-rose-300">{error.message}</p>}
            </div>
          </div>
        )}

        {onStage && (
          <div className="absolute right-3 top-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void conversation.toggleMicrophone()}
              aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#0d1117]/80 text-slate-200 backdrop-blur hover:bg-white/10"
            >
              {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => void conversation.end()}
              aria-label="End call"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-400/30 bg-rose-500/20 text-rose-100 backdrop-blur hover:bg-rose-500/30"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-[#0d1117]/80 px-3 py-1.5 backdrop-blur">
          <span className={`h-2 w-2 rounded-full ${onStage ? 'bg-emerald-400' : 'bg-slate-500'}`} />
          <span className="text-xs font-medium text-slate-200">{agentName}</span>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-[#0b1220] via-[#0b1220]/85 to-transparent px-3 pb-3 pt-8">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
              onStage
                ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'
                : 'border-white/10 bg-white/5 text-slate-300'
            }`}
          >
            {onStage ? <Mic className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5" />}
            {label}
          </span>
          <span className="text-[11px] text-slate-400">
            {leadName ? `Qualifying ${leadName}` : 'Live video qualification'}
          </span>
        </div>
      </div>
    </div>
  );
}