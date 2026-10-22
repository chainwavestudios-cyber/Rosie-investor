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
    <form onSubmit={submit} className="border-t border-home-line p-3">
      <div className="flex items-center gap-2 rounded-full bg-home-muted py-1.5 pl-4 pr-1.5 focus-within:ring-2 focus-within:ring-home-accent">
        <Sparkles className="h-4 w-4 flex-none text-home-muted-ink" aria-hidden="true" />
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-home-ink outline-none placeholder:text-home-muted-ink"
        />
        <button
          type="submit"
          disabled={disabled}
          aria-label="Send message"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-home-navy text-home-navy-ink transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}