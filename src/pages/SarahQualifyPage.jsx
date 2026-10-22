import React from 'react';
import SarahQualifier from '@/components/sarah/SarahQualifier';

export default function SarahQualifyPage() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || params.get('id') || '';

  return (
    <div className="min-h-screen bg-[#0d1117] px-4 py-10 sm:px-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex flex-col items-center text-center">
          <img
            src="https://media.base44.com/images/public/69cd2741578c9b5ce655395b/edc3cdbee_logo.png"
            alt="Debt Solutions"
            className="h-12"
          />
          <h1 className="mt-5 text-2xl text-slate-100 sm:text-3xl" style={{ fontFamily: "'Playfair Display', serif" }}>
            You're one step from relief
          </h1>
          <p className="mt-3 max-w-xl text-sm text-slate-400">
            Sarah will confirm a few details and connect you with a specialist on the phone right now.
          </p>
        </header>

        <SarahQualifier token={token} source={token ? 'email_link' : 'landing_page'} />

        <p className="mt-10 text-center text-xs text-slate-500">
          Your answers stay with our team only. Debt Solutions · rate drop program eligibility review.
        </p>
      </div>
    </div>
  );
}