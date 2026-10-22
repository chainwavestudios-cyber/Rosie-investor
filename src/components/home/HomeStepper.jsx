import React from 'react';

const STEPS = ['Basic Info', 'Contact Details', 'Verify Identity', 'Your Quote'];

export default function HomeStepper({ activeIndex = 0 }) {
  return (
    <ol style={{ display: 'flex', alignItems: 'flex-start', listStyle: 'none', margin: '0 auto', padding: 0, maxWidth: '620px' }}>
      {STEPS.map((label, index) => {
        const isActive = index === activeIndex;
        return (
          <li
            key={label}
            style={{ position: 'relative', flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
          >
            {index > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '15px',
                  right: '50%',
                  width: '100%',
                  height: '2px',
                  background: index <= activeIndex ? '#003366' : '#cbd5e1',
                }}
              />
            )}
            <span
              style={{
                position: 'relative',
                width: '30px',
                height: '30px',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 700,
                background: isActive ? '#003366' : '#ffffff',
                color: isActive ? '#ffffff' : '#64748b',
                border: isActive ? '2px solid #003366' : '2px solid #cbd5e1',
              }}
            >
              {index + 1}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#003366' : '#64748b',
                lineHeight: 1.2,
                textAlign: 'center',
              }}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}