import React from 'react';

const COMPANY = {
  name: 'Debt Solutions Inc',
  street: '325 North St. Paul Street',
  cityLine: 'Dallas, TX 7501',
  phone: '(866) 290-8994',
  phoneHref: 'tel:+18662908994',
};

const LOGO_URL = 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/8fa3e9a78_Gemini_Generated_Image_rboe84rboe84rboe.jpeg';

export default function HomeHeader() {
  return (
    <header style={{ background: '#003366', padding: '18px 20px 22px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span
            style={{
              position: 'relative',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              overflow: 'hidden',
              background: '#0f1e35',
              flex: '0 0 auto',
            }}
          >
            <img
              src={LOGO_URL}
              alt="Debt Solutions emblem"
              style={{ position: 'absolute', width: '84px', height: '84px', left: '-10px', top: '-5px' }}
            />
          </span>
        </div>

        <address
          className="text-left sm:text-right"
          style={{ fontStyle: 'normal', color: 'rgba(255,255,255,0.85)', fontFamily: "'DM Sans', sans-serif", fontSize: '12.5px', lineHeight: 1.6 }}
        >
          <span style={{ display: 'block', color: '#ffffff', fontWeight: 700, fontSize: '13.5px' }}>{COMPANY.name}</span>
          <span style={{ display: 'block' }}>{COMPANY.street}</span>
          <span style={{ display: 'block' }}>{COMPANY.cityLine}</span>
          <a href={COMPANY.phoneHref} style={{ display: 'block', color: '#7ec8f0', fontWeight: 600, textDecoration: 'none' }}>
            {COMPANY.phone}
          </a>
        </address>
      </div>
    </header>
  );
}