import React from 'react';
import SarahQualifier from '@/components/sarah/SarahQualifier';
import SiteHeader from '@/components/home/SiteHeader';
import SiteFooter from '@/components/home/SiteFooter';

export default function SarahQualifyPage() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || params.get('id') || '';

  return (
    <div className="home-theme min-h-screen bg-home-canvas font-home-sans text-home-ink">
      <SiteHeader />

      <main>
        <section id="top" className="relative overflow-hidden bg-home-navy text-home-navy-ink">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-10 md:px-8 lg:grid-cols-12 lg:gap-12 lg:pb-20 lg:pt-14">
            <div className="home-rise flex flex-col items-start gap-5 lg:col-span-5">
              <img
                src="/images/seal.svg"
                alt="Debt Solutions Inc. seal, established 2024"
                className="-my-4 -ml-3 h-32 w-32 drop-shadow-2xl sm:h-40 sm:w-40"
              />
              <h1 className="font-home-display text-4xl leading-[0.95] tracking-tight sm:text-5xl xl:text-6xl">
                You&apos;re one step from <span className="italic text-home-silver">relief.</span>
              </h1>
              <p className="max-w-md text-base leading-relaxed text-home-silver">
                Stephani will confirm a few details and connect you with a specialist on the phone right now.
              </p>
            </div>

            <div className="home-rise lg:col-span-7" style={{ animationDelay: '160ms' }}>
              <SarahQualifier
                token={token}
                source={token ? 'email_link' : 'landing_page'}
                videoOnly
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-10 md:px-8">
          <p className="text-xs text-home-muted-ink">
            Your answers stay with our team only. Debt Solutions · rate drop program eligibility review.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}