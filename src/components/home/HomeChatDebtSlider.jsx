import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

const MIN = 10000;
const MAX = 250000;
const STEP = 5000;
const START = 25000;

/** The visitor's first step: pick how much debt they are carrying, then the bot takes over. */
export default function HomeChatDebtSlider({ onSubmit }) {
  const [amount, setAmount] = useState(START);

  return (
    <div className="flex h-72 flex-col justify-center gap-6 bg-home-canvas px-5 py-6">
      <p className="text-center font-home-display text-[26px] leading-tight text-home-ink sm:text-[30px]">
        Welcome, I&apos;m Simon! Let&apos;s get you Debt Free!
      </p>

      <div className="rounded-2xl border border-home-line bg-home-card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-home-muted-ink">How much debt?</span>
          <span className="text-xl font-semibold text-home-ink">${amount.toLocaleString()}</span>
        </div>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
          aria-label="How much credit card debt are you carrying"
          className="mt-4 w-full cursor-pointer accent-home-accent"
        />
        <div className="mt-1 flex justify-between text-[10px] text-home-muted-ink">
          <span>$10k</span>
          <span>$250k</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSubmit?.(amount)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-home-navy px-5 py-3 text-sm font-semibold text-home-navy-ink transition-opacity hover:opacity-90"
      >
        Get Started
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}