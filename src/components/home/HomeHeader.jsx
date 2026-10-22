import React from 'react';

const COMPANY = {
  name: 'Debt Solutions Inc',
  street: '325 North St. Paul Street',
  cityLine: 'Dallas, TX 7501',
  phone: '(866) 290-8994',
  phoneHref: 'tel:+18662908994',
};

const LOGO_URL = 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/5483f2dfa_Yourparagraphtext.svg';

export default function HomeHeader() {
  return (
    <header className="px-5 py-6 sm:pl-0 md:py-0" style={{ background: 'linear-gradient(180deg, #061d3f 0%, #04101f 100%)' }}>
      <div className="flex w-full flex-col gap-5 sm:flex-row sm:items-center sm:justify-between md:min-h-[208px]">
        <svg
          viewBox="448.5 329.5 542.5 169"
          className="block h-auto w-full shrink-0 overflow-hidden sm:w-[56vw] sm:max-w-[740px]"
          role="img"
          aria-label="Debt Solutions"
        >
          <image href={LOGO_URL} x="0" y="0" width="1440" height="810" />
        </svg>

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