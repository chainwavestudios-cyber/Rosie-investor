import { Fragment, useState } from 'react';
import { Panel, MiniTable, usd, num } from './CostUi';

const GOLD = '#10b981';
const MUTED = '#8a9ab8';

const th = { color: MUTED, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', padding: '8px 16px' };
const td = { color: '#d7dde8', fontSize: '12px', padding: '9px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' };

// Per-call breakdown: one row per call, expandable into the AI features that ran
// on that call with their exact token counts and dollar cost.
export default function CostCallTable({ calls, truncated }) {
  const [openKey, setOpenKey] = useState(null);

  return (
    <Panel title={`Per Call — ${calls.length} call${calls.length === 1 ? '' : 's'} with AI activity`}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Call</th>
              <th style={{ ...th, textAlign: 'left' }}>Agent</th>
              <th style={{ ...th, textAlign: 'right' }}>AI calls</th>
              <th style={{ ...th, textAlign: 'right' }}>Tokens in / out</th>
              <th style={{ ...th, textAlign: 'right' }}>Cached</th>
              <th style={{ ...th, textAlign: 'right' }}>Exact cost</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call, i) => {
              const key = `${call.leadId || call.leadName}-${call.firstAt || i}`;
              const expanded = openKey === key;
              return (
                <Fragment key={key}>
                  <tr onClick={() => setOpenKey(expanded ? null : key)} style={{ cursor: 'pointer', background: expanded ? 'rgba(16,185,129,0.06)' : 'transparent' }}>
                    <td style={{ ...td, color: GOLD }}>
                      {expanded ? '▾' : '▸'}{' '}
                      <span style={{ color: '#e8e0d0', fontWeight: 'bold' }}>{call.leadName || 'Unattributed AI call'}</span>
                      {call.leadNumber && <span style={{ color: MUTED, fontSize: '11px' }}> ({call.leadNumber})</span>}
                    </td>
                    <td style={td}>{call.agent}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{num(call.aiCalls)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{num(call.inputTokens)} / {num(call.outputTokens)}</td>
                    <td style={{ ...td, textAlign: 'right', color: MUTED }}>{num((call.cacheReadTokens || 0) + (call.cacheWriteTokens || 0))}</td>
                    <td style={{ ...td, textAlign: 'right', color: GOLD, fontWeight: 'bold' }}>{usd(call.costUsd)}</td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={6} style={{ ...td, background: 'rgba(0,0,0,0.25)', padding: '4px 16px 14px' }}>
                        <MiniTable
                          headers={['AI feature', 'Calls', 'Model', 'Tokens in / out', 'Cost']}
                          rows={call.items.map((it) => [
                            <span>
                              {it.callType}
                              {it.provider === 'platform' && <span style={{ color: '#eab308', fontSize: '10px' }}> · platform credits</span>}
                            </span>,
                            num(it.calls),
                            it.model || '—',
                            `${num(it.inputTokens)} / ${num(it.outputTokens)}`,
                            usd(it.costUsd),
                          ])}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {calls.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, color: '#4a5568', textAlign: 'center', padding: '30px' }}>No AI activity on this day.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {truncated && (
        <div style={{ color: '#eab308', fontSize: '11px', padding: '10px 16px' }}>
          Only the highest-cost calls are listed — the day's totals above include all of them.
        </div>
      )}
    </Panel>
  );
}