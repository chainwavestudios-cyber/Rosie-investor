import React from 'react';
import { COMPANY } from '@/components/home/SiteHeader';

export default function SiteFooter() {
  return (
    <footer className="bg-home-navy text-home-navy-ink">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center gap-4">
          <img src="/images/seal.svg" alt="" className="-my-3 h-20 w-20" />
          <span className="font-home-display text-3xl leading-none">{COMPANY.name}</span>
        </div>
        <address className="flex flex-col gap-1 text-sm not-italic leading-relaxed text-home-silver md:text-right">
          <span>{COMPANY.street}</span>
          <span>{COMPANY.cityLine}</span>
          <a href={COMPANY.phoneHref} className="font-semibold text-home-accent no-underline hover:underline">
            {COMPANY.phone}
          </a>
        </address>
      </div>
    </footer>
  );
}