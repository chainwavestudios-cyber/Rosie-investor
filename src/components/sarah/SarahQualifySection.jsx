import React from 'react';
import SarahQualifier from './SarahQualifier';

export default function SarahQualifySection() {
  return (
    <section className="w-full max-w-6xl">
      <div className="mb-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[4px] text-[#0ea5e9]">Debt Solutions</p>
        <h2 className="mt-3 text-2xl text-slate-100 sm:text-3xl" style={{ fontFamily: "'Playfair Display', serif" }}>
          Talk to Stephani and qualify in under a minute
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
          Confirm your balances, pick your range, verify your number — then we connect you to a specialist on the phone right now.
        </p>
      </div>
      <SarahQualifier source="landing_page" />
    </section>
  );
}