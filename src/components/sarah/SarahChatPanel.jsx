import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';

export default function SarahChatPanel({
  agentName = 'Stephani',
  messages = [],
  quickReplies = [],
  onReply,
  onSend,
  awaitingPhone,
  disabled,
  placeholder,
}) {
  const [draft, setDraft] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, quickReplies.length]);

  const submit = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || disabled) return;
    setDraft('');
    onSend(text);
  };

  return (
    <div className="flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]">
      <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <MessageSquare className="h-4 w-4 text-sky-300" />
        <p className="text-sm font-medium text-slate-200">Conversation with {agentName}</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">
            Your back-and-forth with {agentName} appears here as you talk or type.
          </p>
        )}
        {messages.map((message, index) => (
          <div key={`${index}-${message.text.slice(0, 12)}`} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                message.role === 'user' ? 'bg-sky-500/20 text-sky-50' : 'bg-white/5 text-slate-200'
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => !disabled && onReply(reply)}
              className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-100 transition hover:bg-sky-500/20"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/10 px-3 py-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={disabled}
          inputMode={awaitingPhone ? 'tel' : 'text'}
          placeholder={placeholder || (disabled ? 'Connecting…' : awaitingPhone ? 'Type your best phone number' : 'Type your answer')}
          className="flex-1 rounded-lg border border-white/10 bg-[#0d1117] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400/40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled}
          aria-label="Send"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 text-[#0b1220] disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}