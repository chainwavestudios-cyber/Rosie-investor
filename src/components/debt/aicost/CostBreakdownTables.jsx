import { Panel, MiniTable, usd, num } from './CostUi';

// Cost rolled up by agent and by AI feature for the day.
export default function CostBreakdownTables({ byAgent, byType }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', alignItems: 'start' }}>
      <Panel title="By Agent">
        <MiniTable
          headers={['Agent', 'AI calls', 'Calls w/ AI', 'Platform credits', 'Cost']}
          rows={byAgent.map((a) => [a.agent, num(a.calls), num(a.callsWithAI), num(a.credits), usd(a.costUsd)])}
        />
      </Panel>
      <Panel title="By AI Feature">
        <MiniTable
          headers={['Feature', 'Calls', 'Tokens in / out', 'Platform credits', 'Cost']}
          rows={byType.map((t) => [t.callType, num(t.calls), `${num(t.inputTokens)} / ${num(t.outputTokens)}`, num(t.credits), usd(t.costUsd)])}
        />
      </Panel>
    </div>
  );
}