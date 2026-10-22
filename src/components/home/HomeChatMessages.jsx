import React, { useEffect, useRef } from 'react';
import { Coins, CreditCard, FileText, Landmark } from 'lucide-react';

const TILES = ['from-pink-500 to-pink-600', 'from-violet-500 to-violet-600', 'from-teal-500 to-teal-600'];
const ICONS = [Coins, CreditCard, Landmark];

const TIER_CARDS = {
  'Less than $20,000': { icon: Coins, tile: TILES[0], subtitle: 'Lower balances' },
  '$20,000 - $40,000': { icon: CreditCard, tile: TILES[1], subtitle: 'Mid-range' },
  'More than $40,000': { icon: Landmark, tile: TILES[2], subtitle: 'Higher balances' },
};

export default function HomeChatMessages({ messages = [], quickReplies = [], onReply, sending }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, quickReplies.length, sending]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
      {messages.map((message, index) => {
        const isVisitor = message.role === 'user';
        const isSpecialist = message.role === 'specialist';
        if (message.role === 'record') {
          return (
            <div key={index} className="w-full">
              <div className="rounded-2xl border border-teal-400/30 bg-[#0b1220]/80 p-3 backdrop-blur-md">
                <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-teal-300">
                  <FileText className="h-3 w-3" />
                  File on record
                </p>
                <div className="space-y-1.5">
                  {(message.fields || []).map((field) => (
                    <div key={field.label} className="flex items-baseline justify-between gap-3">
                      <span className="text-[10px] uppercase tracking-[0.1em] text-white/45">{field.label}</span>
                      <span className="text-right text-[12px] font-medium text-white">{field.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }
        return (
          <div key={index} className={isVisitor ? 'flex justify-end' : 'flex justify-start'}>
            <div className="max-w-[88%]">
              {isSpecialist && (
                <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-emerald-300">
                  {message.authorName || 'Debt Solutions specialist'}
                </p>
              )}
              <p
                className={`rounded-2xl border px-4 py-2.5 text-sm leading-relaxed ${
                  isVisitor
                    ? 'border-white/20 bg-white/85 text-[#160b28]'
                    : isSpecialist
                      ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-50 backdrop-blur-md'
                      : 'border-white/15 bg-[#0b1220]/75 text-white/95 backdrop-blur-md'
                }`}
              >
                {message.text}
              </p>
            </div>
          </div>
        );
      })}

      {sending && (
        <p className="w-fit rounded-full border border-white/10 bg-[#0b1220]/80 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md">
          Typing…
        </p>
      )}

      {!sending && quickReplies.length > 0 && (
        <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
          {quickReplies.map((reply, index) => {
            const tier = TIER_CARDS[reply];
            const Icon = tier?.icon || ICONS[index % ICONS.length];
            const tile = tier?.tile || TILES[index % TILES.length];
            return (
              <button
                key={reply}
                type="button"
                onClick={() => onReply?.(reply)}
                className="flex items-start gap-3 rounded-2xl border border-white/15 bg-[#0b1220]/75 p-3 text-left backdrop-blur-md transition hover:border-white/30 hover:bg-[#0b1220]/90"
              >
                <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-gradient-to-br ${tile} text-white`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-white">{reply}</span>
                  {tier?.subtitle && <span className="mt-0.5 block text-[10px] text-white/55">{tier.subtitle}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}