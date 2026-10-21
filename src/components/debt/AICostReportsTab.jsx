/**
 * AICostReportsTab.jsx — "AI Reports" tab in the Debt Call Coach.
 * Nightly AI cost reports: exact dollar cost per call, per agent and per AI
 * feature, built from the real Anthropic token usage each AI call reports.
 * Reports are generated nightly (3am ET) and can be regenerated on demand.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import CostSummaryCards from './aicost/CostSummaryCards';
import CostCallTable from './aicost/CostCallTable';
import CostBreakdownTables from './aicost/CostBreakdownTables';
import { usd } from './aicost/CostUi';

const GOLD = '#10b981';
const MUTED = '#8a9ab8';

function etToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function shiftDay(dateStr, offset) {
  const [y, m, d] = (dateStr || etToday()).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

export default function AICostReportsTab() {
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [date, setDate] = useState(() => shiftDay(etToday(), -1));
  const [message, setMessage] = useState('');

  const load = useCallback(async (keepSelection) => {
    setLoading(true);
    try {
      const res = await base44.entities.AICostReport.list('-reportDate', 60);
      const list = res?.items || res || [];
      setReports(list);
      setSelectedId((prev) => (keepSelection && prev && list.some((r) => r.id === prev) ? prev : (list[0]?.id || null)));
    } catch {
      setReports([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(false); }, [load]);

  const selected = useMemo(() => reports.find((r) => r.id === selectedId) || reports[0] || null, [reports, selectedId]);
  const parse = (json) => { try { return JSON.parse(json || '[]'); } catch { return []; } };
  const calls = useMemo(() => parse(selected?.callsJson), [selected]);
  const byAgent = useMemo(() => parse(selected?.byAgentJson), [selected]);
  const byType = useMemo(() => parse(selected?.byTypeJson), [selected]);

  const generate = async () => {
    setGenerating(true);
    setMessage('');
    try {
      const res = await base44.functions.invoke('aiCostReport', { date });
      const data = res?.data || {};
      if (data.error) {
        setMessage(`Could not generate: ${data.error}`);
      } else {
        await load(true);
        setSelectedId((prev) => prev);
        setMessage(`Report for ${data.reportDate} generated — ${data.totalAICalls} AI calls, ${usd(data.totalCostUsd)} exact cost.`);
      }
    } catch (e) {
      setMessage(`Could not generate: ${e?.response?.data?.error || e?.message || 'request failed'}`);
    }
    setGenerating(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>🧾 AI Reports — Exact AI Cost Per Call</div>
          <div style={{ color: '#5b6b85', fontSize: '11px', marginTop: '4px' }}>
            Built nightly at 3am ET from real Anthropic token usage. Every AI call is priced from its own input / output / cached tokens.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={date}
            max={etToday()}
            onChange={(e) => setDate(e.target.value)}
            style={{ background: '#141d2d', color: '#e8e0d0', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 10px', fontSize: '12px' }}
          />
          <button
            onClick={generate}
            disabled={generating}
            style={{ background: generating ? 'rgba(16,185,129,0.35)' : 'linear-gradient(135deg,#10b981,#22c55e)', color: '#0a0f1e', border: 'none', borderRadius: '4px', padding: '7px 16px', cursor: generating ? 'wait' : 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}
          >
            {generating ? 'Building…' : '⚡ Build report'}
          </button>
          <button
            onClick={() => load(true)}
            style={{ background: 'rgba(255,255,255,0.05)', color: MUTED, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '7px 14px', cursor: 'pointer', fontSize: '11px' }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {message && (
        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#d7dde8', borderRadius: '4px', padding: '10px 14px', fontSize: '12px', marginBottom: '14px' }}>{message}</div>
      )}

      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px 0' }}>Loading reports…</div>
      ) : reports.length === 0 ? (
        <div style={{ background: '#141d2d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>No AI cost reports yet</div>
          <div style={{ color: MUTED, fontSize: '12px', maxWidth: '520px', margin: '0 auto' }}>
            The nightly report runs at 3am ET and reports the day that just ended. Pick a date above and press “Build report” to generate one now.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '6px' }}>
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                style={{
                  flexShrink: 0, padding: '7px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px',
                  border: `1px solid ${selected?.id === r.id ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`,
                  background: selected?.id === r.id ? `${GOLD}18` : 'transparent',
                  color: selected?.id === r.id ? GOLD : MUTED,
                  fontWeight: selected?.id === r.id ? 'bold' : 'normal',
                }}
              >
                <div>{r.reportDate}</div>
                <div style={{ fontSize: '10px', color: selected?.id === r.id ? GOLD : '#5b6b85' }}>{usd(r.totalCostUsd)} · {r.totalAICalls} calls</div>
              </button>
            ))}
          </div>

          {selected && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>Report for {selected.reportDate} (Eastern Time)</div>
                <div style={{ color: '#5b6b85', fontSize: '11px' }}>
                  Generated {selected.generatedAt ? new Date(selected.generatedAt).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '—'} · {selected.generatedBy || '—'}
                </div>
              </div>
              <CostSummaryCards report={selected} />
              <div style={{ marginTop: '16px' }}>
                <CostCallTable calls={calls} truncated={!!selected.truncated} />
              </div>
              <div style={{ marginTop: '16px' }}>
                <CostBreakdownTables byAgent={byAgent} byType={byType} />
              </div>
              <div style={{ color: '#5b6b85', fontSize: '11px', marginTop: '14px', lineHeight: 1.6 }}>
                Exact cost is computed from the real token counts Anthropic returns for every AI call (input, output, cache read and cache write at current Haiku rates).
                Calls shown as “platform credits” ran on the platform’s InvokeLLM fallback and have no per-token price, so they are counted but not priced.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}