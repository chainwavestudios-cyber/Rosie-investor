import React from 'react';
import { Check } from 'lucide-react';

const BENEFITS = [
  { title: 'Zero upfront fees, period', detail: 'We only get paid after you approve your settlements and your accounts are paid off' },
  { title: 'Eliminate all future interest at 0%' },
  { title: 'All settlement funds held in an FDIC-insured escrow account only you control' },
  { title: 'No early termination or exit fees' },
  { title: 'The average enrollment graduates in 12–36 months' },
];

export default function HomeTrust() {
  return (
    <section className="w-full md:w-[297px] md:flex-none">
      <h2 style={{ color: '#003366', fontSize: '23px', fontWeight: 800, margin: '0 0 16px', fontFamily: "'DM Sans', sans-serif" }}>
        Why Choose Debt Solutions?
      </h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '11px' }}>
        {BENEFITS.map((benefit) => (
          <li key={benefit.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
            <span style={{ flex: '0 0 auto', marginTop: '2px', width: '20px', height: '20px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2d8ebf' }}>
              <Check size={12} color="#ffffff" />
            </span>
            <span style={{ color: '#334155', fontSize: '15px', fontWeight: 700, lineHeight: 1.5 }}>
              {benefit.title}
              {benefit.detail && (
                <span style={{ display: 'block', color: '#5b6b7f', fontSize: '13.5px', fontWeight: 600, lineHeight: 1.5, marginTop: '2px' }}>
                  {benefit.detail}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}