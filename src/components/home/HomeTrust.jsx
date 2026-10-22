import React from 'react';
import { Check } from 'lucide-react';

const BENEFITS = [
  'Save 40%+ on eligible monthly payments',
  'US-based debt consolidation specialists',
  'Free personalized debt evaluation',
];

export default function HomeTrust() {
  return (
    <section style={{ maxWidth: '620px', margin: '44px auto 0', textAlign: 'center' }}>
      <h2 style={{ color: '#003366', fontSize: '22px', fontWeight: 700, margin: '0 0 18px', fontFamily: "'DM Sans', sans-serif" }}>
        Why Choose Debt Solutions?
      </h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {BENEFITS.map((benefit) => (
          <li key={benefit} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#334155', fontSize: '15px', textAlign: 'left' }}>
            <span style={{ flex: '0 0 auto', width: '22px', height: '22px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2d8ebf' }}>
              <Check size={13} color="#ffffff" />
            </span>
            {benefit}
          </li>
        ))}
      </ul>
      <p style={{ color: '#7c8798', fontSize: '12px', margin: '18px 0 0' }}>Individual results may vary.</p>
    </section>
  );
}