/**
 * AICreditsTab.jsx — Super-admin only. Tracks AI / integration credit usage
 * broken down by agent/employee and by client/lead, plus by call type.
 *
 * NOTE: The platform does not expose exact per-call credit costs for InvokeLLM,
 * so "est. credits" are rough proxies (see CREDIT_ESTIMATES in aiCreditLog.js).
 * Counts are exact. Tracking begins from the moment instrumentation was added —
 * historical usage before that is not captured.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };

const RANGES = [
  { id: '24h', label: 'Last 24h' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'all', label: 'All time' },
];

function aggregate(rows, keyFn) {
  const map = {};
  for (const r of rows) {
    const k = keyFn(r);
    if (!map[k]) map[k] = { key: k, calls: 0, credits: 0, rows: [] };
    map[k].calls += 1;
    map[k].credits += r.estimatedCredits || 0;
    map[k].rows.push(r);
  }
  return Object.values(map).sort((a, b) => b.credits - a.credits);
}

export default function AICreditsTab() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.AICreditUsage.list('-calledAt', 2000);
      setRecords(all || []);
    } catch { setRecords([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (range === 'all') return records;
    const now = Date.now();
    const ms = range === '24h' ? 86400000 : range === '7d' ? 7 * 86400000 : 30 * 86400000;
    const cutoff = now - ms;
    return records.filter(r => r.calledAt && new Date(r.calledAt).getTime() >= cutoff);
  }, [records, range]);

  const totals = useMemo(() => ({
    calls: filtered.length,
    credits: filtered.reduce((s, r) => s + (r.estimatedCredits || 0), 0),
    agents: new Set(filtered.map(r => r.agentUsername).filter(Boolean)).size,
    clients: new Set(filtered.map(r => r.leadId).filter(Boolean)).size,
  }), [filtered]);

  const byAgent = useMemo(() => aggregate(filtered, r => r.agentUsername || '— unknown —'), [filtered]);
  const byClient = useMemo(() => aggregate(filtered, r => {
    const name = r.leadName || 'Unknown Lead';
    const num = r.leadNumber || '';
    return num ? `${name}|${num}` : `${name}|${r.leadId || 'no-id'}`;
  }), [filtered]);
  const byType = useMemo(() => aggregate(filtered, r => r.callType || 'unknown'), [filtered]);
  const byAgentClient = useMemo(() => {
    const map = {};
    for (const r of filtered) {
      const k = `${r.agentUsername || '—'}||${r.leadName || 'Unknown Lead'}||${r.leadNumber || ''}`;
      if (!map[k]) map[k] = { agent: r.agentUsername || '—', client: r.leadName || 'Unknown Lead', leadNumber: r.leadNumber || '', calls: 0, credits: 0 };
      map[k].calls += 1;
      map[k].credits += r.estimatedCredits || 0;
    }
    return Object.values(map).sort((a, b) => b.credits - a.credits);
  }, [filtered]);

  const fmt = (n) => n.toLocaleString('en-US');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>💳 AI Credits — Usage by Agent & Client</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)} style={{ padding: '6px 12px', borderRadius: '4px', border: `1px solid ${range === r.id ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: range === r.id ? `${GOLD}18` : 'transparent', color: range === r.id ? GOLD : '#8a9ab8', cursor: 'pointer', fontSize: '11px', fontWeight: range === r.id ? 'bold' : 'normal' }}>{r.label}</button>
          ))}
          <button onClick={load} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>↻ Refresh</button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px 0', fontSize: '13px' }}>No AI usage recorded in this range yet. Usage is logged automatically as agents use AI features on live calls.</div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <StatCard label="Total AI Calls" value={fmt(totals.calls)} />
            <StatCard label="Est. Credits" value={fmt(totals.credits)} accent />
            <StatCard label="Active Agents" value={fmt(totals.agents)} />
            <StatCard label="Clients Touched" value={fmt(totals.clients)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            {/* By Agent */}
            <Section title="By Agent / Employee">
              <Table headers={['Agent', 'Calls', 'Est. Credits']}>
                {byAgent.map(a => (
                  <tr key={a.key}>
                    <td>{a.key}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(a.calls)}</td>
                    <td style={{ textAlign: 'right', color: GOLD, fontWeight: 'bold' }}>{fmt(a.credits)}</td>
                  </tr>
                ))}
              </Table>
            </Section>

            {/* By Client */}
            <Section title="By Client / Lead">
              <Table headers={['Client', 'Calls', 'Est. Credits']}>
                {byClient.map(c => {
                  const [name, num] = c.key.split('|');
                  return (
                    <tr key={c.key}>
                      <td>{name} {num && num !== 'no-id' && num !== 'Unknown Lead' ? <span style={{ color: GOLD, fontSize: '10px' }}>({num})</span> : null}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(c.calls)}</td>
                      <td style={{ textAlign: 'right', color: GOLD, fontWeight: 'bold' }}>{fmt(c.credits)}</td>
                    </tr>
                  );
                })}
              </Table>
            </Section>
          </div>

          {/* By Call Type */}
          <Section title="By AI Call Type" style={{ marginTop: '16px' }}>
            <Table headers={['Call Type', 'Calls', 'Est. Credits']}>
              {byType.map(t => (
                <tr key={t.key}>
                  <td><code style={{ color: '#60a5fa', fontSize: '11px' }}>{t.key}</code></td>
                  <td style={{ textAlign: 'right' }}>{fmt(t.calls)}</td>
                  <td style={{ textAlign: 'right', color: GOLD, fontWeight: 'bold' }}>{fmt(t.credits)}</td>
                </tr>
              ))}
            </Table>
          </Section>

          {/* By Agent × Client */}
          <Section title="By Agent × Client (who worked which client)" style={{ marginTop: '16px' }}>
            <Table headers={['Agent', 'Client', 'Calls', 'Est. Credits']}>
              {byAgentClient.slice(0, 100).map((row, i) => (
                <tr key={i}>
                  <td>{row.agent}</td>
                  <td>{row.client} {row.leadNumber && <span style={{ color: GOLD, fontSize: '10px' }}>({row.leadNumber})</span>}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(row.calls)}</td>
                  <td style={{ textAlign: 'right', color: GOLD, fontWeight: 'bold' }}>{fmt(row.credits)}</td>
                </tr>
              ))}
            </Table>
            {byAgentClient.length > 100 && <div style={{ color: '#6b7280', fontSize: '11px', padding: '8px 12px' }}>Showing top 100 of {byAgentClient.length} agent-client pairs.</div>}
          </Section>

          {/* Recent activity */}
          <Section title="Recent AI Calls" style={{ marginTop: '16px' }}>
            <Table headers={['When', 'Agent', 'Client', 'Type', 'Est. Credits']}>
              {filtered.slice(0, 50).map(r => (
                <tr key={r.id}>
                  <td style={{ fontSize: '10px', color: '#6b7280' }}>{r.calledAt ? new Date(r.calledAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                  <td>{r.agentUsername || '—'}</td>
                  <td>{r.leadName || '—'} {r.leadNumber && <span style={{ color: GOLD, fontSize: '10px' }}>({r.leadNumber})</span>}</td>
                  <td><code style={{ color: '#60a5fa', fontSize: '10px' }}>{r.callType}</code></td>
                  <td style={{ textAlign: 'right', color: GOLD, fontWeight: 'bold' }}>{r.estimatedCredits || 0}</td>
                </tr>
              ))}
            </Table>
          </Section>

          <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '16px', fontStyle: 'italic' }}>
            Est. credits are approximate — the platform doesn't expose exact per-call InvokeLLM costs. Counts are exact. Tracking started when instrumentation was added; earlier usage isn't captured.
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ background: '#0d1b2a', border: `1px solid ${accent ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.15)'}`, borderRadius: '6px', padding: '14px 16px' }}>
      <div style={{ color: '#8a9ab8', fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
      <div style={{ color: accent ? GOLD : '#e8e0d0', fontSize: '24px', fontWeight: 'bold' }}>{value}</div>
    </div>
  );
}

function Section({ title, children, style }) {
  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '6px', ...style }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ maxHeight: '360px', overflowY: 'auto' }}>{children}</div>
    </div>
  );
}

function Table({ headers, children }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>{headers.map((h, i) => (
          <th key={i} style={{ padding: '8px 12px', textAlign: i >= 1 && headers.length > 3 && i < headers.length - 1 ? 'right' : 'left', color: '#6b7280', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, background: '#0d1b2a' }}>{h}</th>
        ))}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}