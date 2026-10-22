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
    <section className="w-full">
      <h2 style={{ color: '#003366', fontSize: '23px', fontWeight: 800, margin: '0 0 16px', fontFamily: "'DM Sans', sans-serif" }}>
        Why Choose Debt Solutions Inc?
      </h2>
      <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {BENEFITS.map((benefit) => (
          <li key={benefit} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', color: '#334155', fontSize: '15px', fontWeight: 700, lineHeight: 1.5 }}>
            <span style={{ flex: '0 0 auto', marginTop: '2px', width: '20px', height: '20px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2d8ebf' }}>
              <Check size={12} color="#ffffff" />
            </span>
            {benefit}
          </li>
        ))}
      </ul>
    </section>
  );
}