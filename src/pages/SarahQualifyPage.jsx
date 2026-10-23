import React from 'react';
import SarahQualifier from '@/components/sarah/SarahQualifier';

export default function SarahQualifyPage() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || params.get('id') || '';
  // The invitation link carries which assistant they were invited to meet.
  const assistant = params.get('assistant') || '';

  return (
    <div className="home-theme min-h-screen bg-home-canvas font-home-sans text-home-ink">
      <main>
        <section id="top" className="relative overflow-hidden bg-home-navy text-home-navy-ink">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-10 md:px-8 lg:grid-cols-12 lg:gap-12 lg:pb-20 lg:pt-14">
            <div className="home-rise flex flex-col items-start gap-5 lg:col-span-5">
              <h1 className="font-home-display text-4xl leading-[0.95] tracking-tight sm:text-5xl xl:text-6xl">
                You&apos;re one step from <span className="italic text-home-silver">relief.</span>
              </h1>
              <p className="max-w-md text-base leading-relaxed text-home-silver">
                Choose your AI assistant, and they will confirm a few details before connecting you with a specialist on the phone.
              </p>
              <img
                src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/1ca18c6fc_Screenshot2026-10-23at22713PM.png"
                alt="Chris Bongiorno, Senior Certified Debt Specialist"
                className="w-full max-w-md rounded-2xl shadow-2xl"
              />
            </div>

            <div className="home-rise lg:col-span-7" style={{ animationDelay: '160ms' }}>
              <SarahQualifier
                token={token}
                source={token ? 'email_link' : 'landing_page'}
                assistant={assistant}
                videoOnly
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}