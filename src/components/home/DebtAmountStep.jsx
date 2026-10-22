import React, { useState } from 'react';

const OPTIONS = ['Less than $20,000', '$20,000 - $40,000', 'More than $40,000'];

export default function DebtAmountStep() {
  const [selected, setSelected] = useState(null);

  const choose = (option) => {
    setSelected(option);
    document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section id="debt-amount" style={{ maxWidth: '620px', margin: '36px auto 0', scrollMarginTop: '20px', textAlign: 'center' }}>
      <h1 style={{ color: '#003366', fontSize: '32px', lineHeight: 1.2, fontWeight: 700, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
        How much credit card debt do you have?
      </h1>
      <p style={{ color: '#475569', fontSize: '15px', margin: '12px 0 24px' }}>
        Our program is for people who have $10k - $250k of credit card debt.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {OPTIONS.map((option) => {
          const isSelected = selected === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              style={{
                background: isSelected ? '#003366' : '#f4b424',
                color: isSelected ? '#ffffff' : '#002a52',
                border: 'none',
                borderRadius: '10px',
                padding: '18px 20px',
                fontSize: '17px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 0 rgba(0,0,0,0.12)',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </section>
  );
}