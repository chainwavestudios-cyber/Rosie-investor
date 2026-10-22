import React, { useEffect, useRef } from 'react';
import { Coins, CreditCard, Landmark } from 'lucide-react';

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
    <div className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3.5">
      {messages.map((message, index) => {
        const isVisitor = message.role === 'user';
        const isSpecialist = message.role === 'specialist';
        return (
          <div key={index} className={isVisitor ? 'flex justify-end' : 'flex justify-start'}>
            <div className="max-w-[88%]">
              {isSpecialist && (
                <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-emerald-300">
                  {message.authorName || 'Debt Solutions specialist'}
                </p>
              )}
              <p
                className={`rounded-2xl border px-3.5 py-2 text-[13px] leading-relaxed ${
                  isVisitor
                    ? 'border-white/20 bg-white/85 text-[#160b28]'
                    : isSpecialist
                      ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-50'
                      : 'border-white/10 bg-white/[0.08] text-white/90'
                }`}
              >
                {message.text}
              </p>
            </div>
          </div>
        );
      })}

      {sending && <p className="text-xs text-white/40">Typing…</p>}

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
                className="flex items-start gap-2.5 rounded-2xl border border-white/15 bg-black/30 p-2.5 text-left transition hover:border-white/30 hover:bg-black/45"
              >
                <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-gradient-to-br ${tile} text-white`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-white">{reply}</span>
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