import React from 'react';
import { Check } from 'lucide-react';

const BENEFITS = [
  "Zero Up front fees, we don't get paid until clients approve settlements, and accounts are paid off",
  'Eliminate all future interest at 0%',
  'All settlement funds in a FDIC insured escrow account only YOU control',
  'No early termination or exit fees',
  'Average enrollment graduates in 12-36 months',
];

export default function HomeTrust() {
  return (
    <section className="w-full md:w-[297px] md:flex-none">
      <h2 style={{ color: '#003366', fontSize: '20px', fontWeight: 700, margin: '0 0 16px', fontFamily: "'DM Sans', sans-serif" }}>
        Why Choose Debt Solutions?
      </h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '11px' }}>
        {BENEFITS.map((benefit) => (
          <li key={benefit} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', color: '#334155', fontSize: '13.5px', lineHeight: 1.5 }}>
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