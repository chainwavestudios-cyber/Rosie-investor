import React from 'react';
import { Phone } from 'lucide-react';

export const COMPANY = {
  name: 'Debt Solutions Inc',
  street: '325 North St. Paul Street',
  cityLine: 'Dallas, TX 7501',
  phone: '(866) 290-8994',
  phoneHref: 'tel:+18662908994',
};

export default function SiteHeader({ showBrand = true, showAddress = true }) {
  return (
    <header className="bg-home-navy text-home-navy-ink">
      <div className={`mx-auto flex max-w-7xl items-center gap-6 border-b border-white/10 px-5 py-4 md:px-8 ${showBrand ? 'justify-between' : 'justify-end'}`}>
        {showBrand && (
          <a href="#top" className="flex items-center gap-3 no-underline">
            <img
              src="/images/seal.svg"
              alt=""
              className="-my-2 h-14 w-14 shrink-0"
            />
            <span className="font-home-display text-xl leading-none tracking-tight text-home-navy-ink sm:text-2xl">
              {COMPANY.name}
            </span>
          </a>
        )}

        <div className="flex items-center gap-6">
          {showAddress && (
            <address className="hidden text-right text-sm not-italic leading-snug text-home-silver md:block">
              <span className="block">{COMPANY.street}</span>
              <span className="block">{COMPANY.cityLine}</span>
            </address>
          )}
          <a
            href={COMPANY.phoneHref}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-home-accent px-3 py-2 text-xs font-semibold text-home-navy no-underline transition-colors hover:bg-home-navy-ink sm:px-4 sm:text-sm"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            {COMPANY.phone}
          </a>
        </div>
      </div>
    </header>
  );
}