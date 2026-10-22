import React, { useState } from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';

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
    <form onSubmit={submit} className="border-t border-white/10 px-3 py-3 sm:px-4">
      <div className="flex items-center gap-2 rounded-full border border-white/15 bg-[#0b1220]/80 px-3 py-2 backdrop-blur-md focus-within:border-white/30">
        <Sparkles className="h-4 w-4 flex-none text-white/35" />
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
        />
        <button
          type="submit"
          disabled={disabled}
          aria-label="Send message"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white text-[#160b28] transition hover:bg-white/85 disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}