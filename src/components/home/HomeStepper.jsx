import React from 'react';

const STEPS = ['Basic Info', 'Contact Details', 'Verify Identity', 'Your Quote'];

export default function HomeStepper({ activeIndex = 0 }) {
  return (
    <ol style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', listStyle: 'none', margin: '0 auto', padding: 0, maxWidth: '620px' }}>
      {STEPS.map((label, index) => (
        <React.Fragment key={label}>
          {index > 0 && (
            <li
              aria-hidden="true"
              style={{ flex: '1 1 0', height: '2px', marginTop: '15px', background: index <= activeIndex ? '#003366' : '#cbd5e1' }}
            />
          )}
          <li style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '74px' }}>
            <span
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 700,
                background: index === activeIndex ? '#003366' : '#ffffff',
                color: index === activeIndex ? '#ffffff' : '#64748b',
                border: index === activeIndex ? '2px solid #003366' : '2px solid #cbd5e1',
              }}
            >
              {index + 1}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: index === activeIndex ? 700 : 500,
                color: index === activeIndex ? '#003366' : '#64748b',
                lineHeight: 1.2,
                textAlign: 'center',
              }}
            >
              {label}
            </span>
          </li>
        </React.Fragment>
      ))}
    </ol>
  );
}