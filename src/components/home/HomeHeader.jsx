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
    <header style={{ background: 'linear-gradient(180deg, #061d3f 0%, #04101f 100%)', padding: '18px 20px 22px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span
            style={{
              position: 'relative',
              width: '107px',
              height: '120px',
              overflow: 'hidden',
              flex: '0 0 auto',
            }}
          >
            <img
              src={LOGO_URL}
              alt="Debt Solutions"
              style={{ position: 'absolute', width: '137px', height: '137px', left: '-15px', top: '-9px' }}
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
          <a href={COMPANY.phoneHref} style={{ display: 'block', color: '#9fd8f7', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>
            {COMPANY.phone}
          </a>
        </address>
      </div>
    </header>
  );
}