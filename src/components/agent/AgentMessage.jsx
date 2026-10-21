import React from 'react';
import ReactMarkdown from 'react-markdown';
import AgentToolCall from './AgentToolCall';

// One console turn: the user's request, or ACE's answer (markdown), the tools it
// ran, and — when it moved the app — the page it opened.
export default function AgentMessage({ message }) {
  const isUser = message.role === 'user';

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: '14px' }}>
      <div style={{
        maxWidth: '88%',
        background: isUser ? 'rgba(16,185,129,0.12)' : '#111925',
        border: `1px solid ${isUser ? 'rgba(16,185,129,0.35)' : '#1f2937'}`,
        borderRadius: '8px',
        padding: '10px 12px',
        color: '#e8e0d0',
        fontSize: '13px',
        lineHeight: 1.6,
      }}>
        {isUser
          ? <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</p>
          : <div className="ace-markdown"><ReactMarkdown>{message.content || ''}</ReactMarkdown></div>}

        {!!message.toolLog?.length && message.toolLog.map((call, i) => <AgentToolCall key={i} call={call} />)}

        {message.landed && (
          <div style={{ marginTop: '8px', color: '#10b981', fontSize: '11px', letterSpacing: '0.3px' }}>
            → Opened {message.landed}
          </div>
        )}
      </div>
    </div>
  );
}