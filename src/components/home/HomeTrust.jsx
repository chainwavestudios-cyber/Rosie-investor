import React from 'react';
import { Check } from 'lucide-react';

const BENEFITS = [
  'Zero upfront fees, period',
  'We only get paid after you approve your settlements and your accounts are paid off',
  'Eliminate all future interest at 0%',
  'All settlement funds held in an FDIC-insured escrow account only you control',
  'No early termination or exit fees',
  'The average enrollment graduates in 12–36 months',
];

export default function HomeTrust() {
  return (
    <section aria-labelledby="why-heading" className="mx-auto max-w-7xl px-5 py-20 md:px-8 lg:py-28">
      <div className="grid gap-12 lg:grid-cols-12">
        <h2
          id="why-heading"
          className="font-home-display text-4xl leading-none tracking-tight text-home-ink sm:text-5xl md:text-6xl lg:sticky lg:top-12 lg:col-span-5 lg:self-start"
        >
          Why Choose <span className="italic">Debt Solutions Inc?</span>
        </h2>

        <ul className="flex flex-col lg:col-span-7">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex gap-5 border-t border-home-line py-6 last:border-b">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-home-navy text-home-accent">
                <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
              </span>
              <p className="text-lg font-semibold leading-snug text-home-ink">{benefit}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}