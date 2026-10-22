import React, { useEffect, useRef } from 'react';

export default function HomeChatMessages({ messages = [], quickReplies = [], onReply, sending }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, quickReplies.length, sending]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.map((message, index) => (
        <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
          <p
            className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              message.role === 'user' ? 'bg-sky-500/20 text-sky-50' : 'bg-white/5 text-slate-200'
            }`}
          >
            {message.text}
          </p>
        </div>
      ))}

      {sending && <p className="text-xs text-slate-500">Typing…</p>}

      {!sending && quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => onReply?.(reply)}
              className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-100 transition hover:bg-sky-500/20"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}