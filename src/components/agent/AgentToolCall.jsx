import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

// One tool call the agent made — collapsed to a single line, expandable to the
// arguments it used. Keeps the console readable while showing its work.
export default function AgentToolCall({ call }) {
  const [open, setOpen] = useState(false);
  const input = call?.input || {};
  const label = call?.name === 'query_entity'
    ? `Read ${input.entity || 'records'}${input.count_only ? ' (count)' : ''}`
    : call?.name === 'update_record'
      ? `Changed ${input.entity || 'record'}`
      : call?.name === 'call_function'
        ? `Ran ${input.function_name || 'function'}`
        : (call?.name || 'Tool');

  return (
    <div style={{ borderTop: '1px solid #1f2937', marginTop: '8px', paddingTop: '6px' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px', background: 'transparent', border: 'none',
          color: '#9ca3af', fontSize: '11px', cursor: 'pointer', padding: 0,
        }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span style={{ color: call?.ok === false ? '#ef4444' : '#10b981' }}>{call?.ok === false ? '✕' : '✓'}</span>
        <span>{label}</span>
      </button>
      {open && (
        <pre style={{
          margin: '6px 0 0', padding: '6px 8px', background: '#0b111a', border: '1px solid #1f2937',
          borderRadius: '4px', color: '#9ca3af', fontSize: '10.5px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {JSON.stringify(input, null, 1)}
        </pre>
      )}
    </div>
  );
}