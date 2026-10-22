import React from 'react';
import { Award, Check, ShieldCheck } from 'lucide-react';

const BENEFITS = [
  "Zero Up front fees, we don't get paid until clients approve settlements, and accounts are paid off",
  'Eliminate all future interest at 0%',
  'All settlement funds in a FDIC insured escrow account only YOU control',
  'No early termination or exit fees',
  'Average enrollment graduates in 12-36 months',
];

const BADGES = [
  { icon: ShieldCheck, title: 'BBB Accredited Business', subtitle: 'A+ Rating' },
  { icon: Award, title: '2025 Torch Ethics Award', subtitle: 'Runner-Up' },
];

export default function HomeTrust() {
  return (
    <section style={{ maxWidth: '520px', margin: 0 }}>
      <h2 style={{ color: '#003366', fontSize: '22px', fontWeight: 700, margin: '0 0 18px', fontFamily: "'DM Sans', sans-serif" }}>
        Why Choose Debt Solutions?
      </h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {BENEFITS.map((benefit) => (
          <li key={benefit} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: '#334155', fontSize: '15px', lineHeight: 1.5 }}>
            <span style={{ flex: '0 0 auto', marginTop: '2px', width: '22px', height: '22px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2d8ebf' }}>
              <Check size={13} color="#ffffff" />
            </span>
            {benefit}
          </li>
        ))}
      </ul>

      <div style={{ marginTop: '26px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {BADGES.map((badge) => {
          const Icon = badge.icon;
          return (
            <div
              key={badge.title}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#ffffff', border: '1px solid #d7e6f5', borderRadius: '12px', padding: '12px 16px', textAlign: 'left' }}
            >
              <Icon size={22} color="#003366" />
              <span>
                <span style={{ display: 'block', color: '#003366', fontSize: '13px', fontWeight: 700 }}>{badge.title}</span>
                <span style={{ display: 'block', color: '#64748b', fontSize: '12px' }}>{badge.subtitle}</span>
              </span>
            </div>
          );
        })}
      </div>

      <p style={{ color: '#7c8798', fontSize: '12px', margin: '18px 0 0' }}>Individual results may vary.</p>
    </section>
  );
}