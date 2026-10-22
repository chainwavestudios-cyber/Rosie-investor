import React, { useState } from 'react';
import { BadgeCheck, CheckCircle2, CreditCard, Home, MapPin, Phone } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const formatPhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return raw || '—';
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const formatMoney = (value) => (typeof value === 'number' ? `$${value.toLocaleString('en-US')}` : '—');

/**
 * HomeLeadConfirm — shown only when the visitor arrived from an email link that
 * carried their contact card, so they can confirm what we already have on file.
 */
export default function HomeLeadConfirm({ profile }) {
  const [state, setState] = useState({ status: 'asking', message: '' });

  const confirm = async () => {
    setState({ status: 'saving', message: '' });
    try {
      const response = await base44.functions.invoke('homeQualifyChat', {
        action: 'confirm_profile',
        leadId: profile.id,
        source: profile.source,
        name: `${profile.firstName} ${profile.lastName}`.trim(),
      });
      if (response?.data?.error) {
        setState({ status: 'error', message: response.data.error });
        return;
      }
      setState({ status: 'confirmed', message: '' });
    } catch {
      setState({ status: 'error', message: 'We could not save that just now — your advisor can confirm it on your call.' });
    }
  };

  const rows = [
    { icon: BadgeCheck, label: 'First name', value: profile.firstName || '—' },
    { icon: BadgeCheck, label: 'Last name', value: profile.lastName || '—' },
    { icon: Phone, label: 'Phone', value: formatPhone(profile.phone) },
    { icon: MapPin, label: 'Address', value: profile.address || '—' },
    { icon: Home, label: 'Home value', value: formatMoney(profile.homeValue) },
    { icon: CreditCard, label: 'Lines of credit', value: typeof profile.linesOfCredit === 'number' ? `${profile.linesOfCredit}` : '—' },
  ];

  return (
    <section
      id="lead-confirm"
      className="mx-auto w-full max-w-3xl rounded-3xl border border-home-line bg-home-card p-6 text-left"
      style={{ scrollMarginTop: '20px' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[4px] text-home-navy">Your file</p>
      <h2 className="mt-2 font-home-display text-2xl leading-tight text-home-navy">
        Welcome back{profile.firstName ? `, ${profile.firstName}` : ''} — is this still correct?
      </h2>
      <p className="mt-1 text-sm text-home-muted-ink">
        This is what we have on file for you{profile.noticeId ? ` (file ${profile.noticeId})` : ''}. Please confirm it, or tell us what changed.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3 rounded-xl border border-home-line bg-home-canvas px-4 py-3">
            <row.icon className="mt-0.5 h-4 w-4 shrink-0 text-home-navy" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-home-muted-ink">{row.label}</p>
              <p className="text-sm font-medium text-home-ink">{row.value}</p>
            </div>
          </div>
        ))}
      </div>

      {state.status === 'confirmed' ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Details confirmed — your advisor already has them.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={confirm}
              disabled={state.status === 'saving'}
              className="inline-flex items-center gap-2 rounded-full bg-home-navy px-5 py-3 text-sm font-semibold text-home-navy-ink transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {state.status === 'saving' ? 'Saving…' : 'Yes, this is me'}
            </button>
            <button
              type="button"
              onClick={() => {
                setState({ status: 'changed', message: '' });
                document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="inline-flex items-center gap-2 rounded-full border border-home-navy px-5 py-3 text-sm font-semibold text-home-navy"
            >
              Something has changed
            </button>
          </div>
          {state.status === 'changed' && (
            <p className="mt-3 text-sm text-home-muted-ink">
              No problem — type the correct details in the chat below and your advisor will update your file before your call.
            </p>
          )}
          {state.status === 'error' && <p className="mt-3 text-sm text-amber-700">{state.message}</p>}
        </>
      )}
    </section>
  );
}