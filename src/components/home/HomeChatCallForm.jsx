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
    <form onSubmit={submit} className="border-t border-white/10 bg-[#241b3d]/60 px-4 py-4 backdrop-blur-md">
      <p className="mb-3 text-sm font-semibold text-white">Have a specialist call you now</p>
      <input
        type="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="Your phone number"
        className="mb-3 w-full rounded-full border border-white/15 bg-[#1a1626]/80 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#9d4dff]/60"
      />
      <label className="mb-3 flex items-start gap-2 text-xs text-white/70">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-teal-400"
        />
        <span>
          I agree to be contacted by phone about my debt relief options now. I understand the call may be recorded and that
          I can ask them to stop calling at any time.
        </span>
      </label>
      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#1a0b2e] transition hover:bg-white/85 disabled:opacity-50"
      >
        <PhoneCall className="h-4 w-4" />
        {calling ? 'Placing your call…' : 'Call me now'}
      </button>
      {state?.message && (
        <p className={`mt-3 text-xs ${state.status === 'placed' ? 'text-emerald-200' : 'text-amber-200'}`}>{state.message}</p>
      )}
    </form>
  );
}