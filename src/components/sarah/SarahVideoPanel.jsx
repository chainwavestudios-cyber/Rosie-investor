import React from 'react';
import { Loader2, Mic, PhoneCall, Volume2 } from 'lucide-react';

const PHASE_LABEL = {
  ready: 'Ready when you are',
  connecting: 'Connecting to Sarah',
  routing: 'Patching you through',
  routed: 'Connecting your phone call',
  text: 'Typing instead of talking',
  done: 'Session complete',
};

export default function SarahVideoPanel({ agentName = 'Sarah', speaking, phase, embedUrl, leadName, note }) {
  const live = phase === 'live';
  const speakingNow = live && !!speaking;
  const label = live ? (speakingNow ? 'Speaking' : 'Listening') : PHASE_LABEL[phase] || 'Ready';

  const chip = speakingNow
    ? 'border-sky-400/40 bg-sky-500/20 text-sky-100'
    : live
      ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'
      : 'border-white/10 bg-white/5 text-slate-300';

  const StatusIcon = live ? (speakingNow ? Volume2 : Mic) : phase === 'routing' || phase === 'routed' ? PhoneCall : Loader2;

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-400/20 bg-[#0b1220] shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
      <div className="relative aspect-video w-full">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={`${agentName} video avatar`}
            className="absolute inset-0 h-full w-full border-0"
            allow="camera; microphone; autoplay; fullscreen"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(14,165,233,0.28),#0b1220_68%)]">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <span className={`absolute inline-flex h-full w-full rounded-full bg-sky-400/20 ${speakingNow ? 'animate-ping' : ''}`} />
              <span className="absolute inline-flex h-40 w-40 rounded-full border border-sky-400/15" />
              <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-sky-600 text-3xl font-semibold text-[#0b1220]">
                {agentName.charAt(0)}
              </span>
            </div>
          </div>
        )}

        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-[#0d1117]/80 px-3 py-1.5 backdrop-blur">
          <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-slate-500'}`} />
          <span className="text-xs font-medium text-slate-200">{agentName}</span>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-[#0b1220] via-[#0b1220]/85 to-transparent px-3 pb-3 pt-8">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${chip}`}>
            <StatusIcon className={`h-3.5 w-3.5 ${phase === 'connecting' ? 'animate-spin' : ''}`} />
            {label}
          </span>
          <span className="text-[11px] text-slate-400">
            {leadName ? `Qualifying ${leadName}` : 'Live qualification'}
            {note ? ` · ${note}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}