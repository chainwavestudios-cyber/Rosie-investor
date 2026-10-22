import React from 'react';
import HomeChatWidget from '@/components/home/HomeChatWidget';

export default function HomeHero({ leadProfile, onLeadFound }) {
  return (
    <section id="top" className="relative overflow-hidden bg-home-navy text-home-navy-ink">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-12 md:px-8 lg:grid-cols-12 lg:gap-10 lg:pb-24 lg:pt-16">
        <div className="flex flex-col gap-8 lg:col-span-6">
          <img
            src="/images/seal.svg"
            alt="Debt Solutions Inc. seal, established 2024"
            className="home-rise -my-6 -ml-4 h-40 w-40 drop-shadow-2xl sm:h-48 sm:w-48 md:-ml-6 md:h-64 md:w-64"
          />
          <h1
            className="home-rise font-home-display text-4xl leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl"
            style={{ animationDelay: '120ms' }}
          >
            Conquer Your Debt.{' '}
            <span className="italic text-home-silver">Own Your Tomorrow.</span>
          </h1>
        </div>

        <div className="home-rise lg:col-span-6" style={{ animationDelay: '260ms' }}>
          <HomeChatWidget leadProfile={leadProfile} onLeadFound={onLeadFound} />
        </div>
      </div>
    </section>
  );
}