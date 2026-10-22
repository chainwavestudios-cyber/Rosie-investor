import React, { useState } from 'react';
import { PhoneCall } from 'lucide-react';

export default function HomeChatCallForm({ onRequestCall, calling, state, defaultPhone = '' }) {
  const [phone, setPhone] = useState(defaultPhone);
  const [consent, setConsent] = useState(false);

  const digits = phone.replace(/\D/g, '');
  const phoneOk = digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
  const canSubmit = phoneOk && consent && !calling;

  const submit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    onRequestCall({ phone, consent });
  };

  return (
    <form onSubmit={submit} className="border-t border-home-line bg-home-canvas px-4 py-4">
      <p className="mb-3 text-sm font-semibold text-home-ink">Have a specialist call you now</p>
      <input
        type="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="Your phone number"
        className="mb-3 w-full rounded-full border border-home-line bg-home-card px-4 py-2.5 text-sm text-home-ink outline-none placeholder:text-home-muted-ink focus:border-home-accent"
      />
      <label className="mb-3 flex items-start gap-2 text-xs text-home-muted-ink">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#5bb6ec]"
        />
        <span>
          I agree to be contacted by phone about my debt relief options now. I understand the call may be recorded and that
          I can ask them to stop calling at any time.
        </span>
      </label>
      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-home-navy px-4 py-3 text-sm font-semibold text-home-navy-ink transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <PhoneCall className="h-4 w-4" />
        {calling ? 'Placing your call…' : 'Call me now'}
      </button>
      {state?.message && (
        <p className={`mt-3 text-xs ${state.status === 'placed' ? 'text-emerald-700' : 'text-amber-700'}`}>{state.message}</p>
      )}
    </form>
  );
}