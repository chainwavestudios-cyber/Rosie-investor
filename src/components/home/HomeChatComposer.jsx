import React, { useState } from 'react';
import { Send } from 'lucide-react';

export default function HomeChatComposer({ onSend, disabled, placeholder = 'Ask a question or answer here' }) {
  const [draft, setDraft] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || disabled) return;
    setDraft('');
    onSend(text);
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/10 px-3 py-3">
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-xl border border-white/10 bg-[#0d1117] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400/40"
      />
      <button
        type="submit"
        disabled={disabled}
        aria-label="Send message"
        className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-[#0b1220] disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  );
}