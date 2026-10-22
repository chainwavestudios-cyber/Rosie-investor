import React, { useEffect, useRef } from 'react';
import { Coins, CreditCard, FileText, Landmark } from 'lucide-react';

const TILES = ['bg-home-navy text-home-accent', 'bg-home-accent text-home-navy', 'bg-home-silver text-home-navy'];
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
    <div className="flex h-72 flex-col gap-3 overflow-y-auto bg-home-canvas px-4 py-5 sm:px-5" role="log" aria-live="polite">
      {messages.map((message, index) => {
        const isVisitor = message.role === 'user';
        const isSpecialist = message.role === 'specialist';
        if (message.role === 'record') {
          return (
            <div key={index} className="w-full">
              <div className="rounded-2xl border border-home-line bg-home-card p-3">
                <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-home-muted-ink">
                  <FileText className="h-3 w-3" />
                  File on record
                </p>
                <div className="space-y-1.5">
                  {(message.fields || []).map((field) => (
                    <div key={field.label} className="flex items-baseline justify-between gap-3">
                      <span className="text-[10px] uppercase tracking-[0.1em] text-home-muted-ink">{field.label}</span>
                      <span className="text-right text-[12px] font-medium text-home-ink">{field.value}</span>
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
                <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-home-muted-ink">
                  {message.authorName || 'Debt Solutions specialist'}
                </p>
              )}
              <p
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isVisitor
                    ? 'rounded-tr-sm bg-home-accent text-home-navy'
                    : isSpecialist
                      ? 'rounded-tl-sm bg-home-silver text-home-navy'
                      : 'rounded-tl-sm bg-home-navy text-home-navy-ink'
                }`}
              >
                {message.text}
              </p>
            </div>
          </div>
        );
      })}

      {sending && <p className="text-xs text-home-muted-ink">Typing…</p>}

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
                className="flex items-start gap-3 rounded-2xl border border-home-line bg-home-card p-3 text-left transition hover:border-home-accent"
              >
                <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ${tile}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-home-ink">{reply}</span>
                  {tier?.subtitle && <span className="mt-0.5 block text-[10px] text-home-muted-ink">{tier.subtitle}</span>}
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