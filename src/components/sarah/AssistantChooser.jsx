/**
 * AssistantChooser.jsx — the faces a visitor can choose between before the video call.
 * The invitation link marks the assistant they were invited to meet.
 */
import React from 'react';

export default function AssistantChooser({ assistants, invited, onChoose }) {
  return (
    <div className="rounded-2xl border border-sky-400/20 bg-[#0b1220] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
      <p className="text-base font-semibold text-slate-100">Choose who you&apos;d like to talk with</p>
      <p className="mt-1 text-sm text-slate-300">
        Both are AI assistants. Each can explain the process, answer your questions and arrange a call with a specialist.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {assistants.map((assistant) => {
          const highlighted = invited === assistant.key;
          return (
            <div
              key={assistant.key}
              className={`flex flex-col items-center rounded-xl border p-4 text-center ${
                highlighted ? 'border-sky-300/60 bg-sky-500/10' : 'border-white/10 bg-white/5'
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-sky-600 text-lg font-semibold text-[#0b1220]">
                {String(assistant.name || '?').charAt(0)}
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-100">{assistant.name}</p>
              {assistant.blurb && <p className="mt-1 text-xs text-slate-400">{assistant.blurb}</p>}
              {highlighted && <p className="mt-2 text-[11px] font-medium text-sky-200">You were invited to meet {assistant.name}</p>}

              <button
                type="button"
                onClick={() => onChoose(assistant.key)}
                className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 px-3 py-2.5 text-sm font-semibold text-[#0b1220]"
              >
                Talk with {assistant.name}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}