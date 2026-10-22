import React, { useState } from 'react';
import { PhoneCall } from 'lucide-react';

export default function HomeChatCallForm({ onRequestCall, calling, state }) {
  const [phone, setPhone] = useState('');
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
    <form onSubmit={submit} className="border-t border-white/10 px-4 py-4">
      <p className="mb-3 text-sm font-semibold text-slate-100">Have a specialist call you now</p>
      <input
        type="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="Your phone number"
        className="mb-3 w-full rounded-xl border border-white/10 bg-[#0d1117] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400/40"
      />
      <label className="mb-3 flex items-start gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-sky-400"
        />
        <span>
          I agree to be contacted by phone about my debt relief options now. I understand the call may be recorded and that
          I can ask them to stop calling at any time.
        </span>
      </label>
      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 px-4 py-3 text-sm font-semibold text-[#0b1220] disabled:opacity-50"
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