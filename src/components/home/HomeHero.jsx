import React from 'react';
import { Phone } from 'lucide-react';
import HomeChatWidget from '@/components/home/HomeChatWidget';
import { COMPANY } from '@/components/home/SiteHeader';

export default function HomeHero({ leadProfile, onLeadFound }) {
  return (
    <section id="top" className="home-premium-hero relative overflow-hidden text-white">
      <a
        href={COMPANY.phoneHref}
        className="absolute right-4 top-2 z-20 flex items-center gap-2 whitespace-nowrap rounded-full border border-home-accent bg-home-navy px-3 py-2 text-xs font-semibold text-home-navy-ink no-underline shadow-lg transition-colors hover:bg-home-accent hover:text-home-navy sm:right-6 sm:top-3 sm:px-4 sm:text-sm"
      >
        <Phone className="h-4 w-4" aria-hidden="true" />
        {COMPANY.phone}
      </a>
      <div className="home-premium-banner-wrap">
        <img src="/images/debt-solutions-premium-banner.png" alt="Debt Solutions Inc. — Stronger Partnerships, Better Solutions. Established 2019." className="home-premium-banner" />
      </div>
      <div className="home-premium-content mx-auto grid max-w-7xl items-center gap-10 px-5 py-12 md:px-8 lg:grid-cols-12 lg:gap-14 lg:py-20">
        <div className="home-rise lg:col-span-6">
          <div className="home-premium-eyebrow">A MORE PERSONAL APPROACH TO DEBT RELIEF</div>
          <h1 className="font-home-display mt-6 text-4xl leading-[1.08] tracking-tight sm:text-5xl xl:text-6xl">Your Next Chapter <span className="home-premium-gold">Starts Here.</span></h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-slate-300 sm:text-lg">Explore personalized options for high-interest credit card debt with a straightforward, confidential qualification experience.</p>
          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-200"><span>✦ Personal guidance</span><span>✦ Confidential review</span><span>✦ Clear next steps</span></div>
        </div>
        <div className="home-rise lg:col-span-6" style={{ animationDelay: '150ms' }}>
          <HomeChatWidget leadProfile={leadProfile} onLeadFound={onLeadFound} />
        </div>
      </div>
    </section>
  );
}