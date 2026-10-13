/**
 * FronterAIReportsTab.jsx — Lists AI performance audit reports for the
 * fronter, ordered by date (newest first), then AM before PM within each
 * date. Each report is expandable to view the full markdown report inline.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const TIER_COLORS = {
  green: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', text: '#10b981', emoji: '🟢' },
  yellow: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b', emoji: '🟡' },
  red: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#ef4444', emoji: '🔴' },
};

function fmtDuration(seconds) {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTimestamp(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
}

export default function FronterAIReportsTab({ username, isAdmin }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.FronterPerformanceReport.filter(
        isAdmin ? {} : { fronterUsername: username },
        { sort: '-reportDate', limit: 100 }
      );
      const items = all?.items || all || [];
      // Sort: newest date first, AM before PM within same date
      items.sort((a, b) => {
        if (a.reportDate !== b.reportDate) return b.reportDate.localeCompare(a.reportDate);
        return a.shiftPeriod === 'AM' ? -1 : 1;
      });
      setReports(items);
    } catch {}
    setLoading(false);
  }, [username, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const generateNow = async (fronterUsername, shiftPeriod) => {
    setGenerating(true);
    try {
      await base44.functions.invoke('fronterPerformanceAudit', { action: 'generate', fronterUsername, shiftPeriod });
      await load();
    } catch (e) { alert('Generation failed: ' + (e?.message || String(e))); }
    setGenerating(false);
  };

  // Group by date
  const grouped = {};
  for (const r of reports) {
    if (!grouped[r.reportDate]) grouped[r.reportDate] = [];
    grouped[r.reportDate].push(r);
  }
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>📊 AI Performance Audits</div>
          <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>Twice-daily automated call quality & performance reports with APS scoring.</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isAdmin && (
            <>
              <button onClick={() => generateNow(username, 'AM')} disabled={generating} style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', padding: '6px 14px', cursor: generating ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: generating ? 0.5 : 1 }}>⚡ Generate AM</button>
              <button onClick={() => generateNow(username, 'PM')} disabled={generating} style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '4px', padding: '6px 14px', cursor: generating ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: generating ? 0.5 : 1 }}>⚡ Generate PM</button>
            </>
          )}
          <button onClick={load} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>↻ Refresh</button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading reports…</div>
      ) : reports.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '60px 0', fontSize: '14px' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>📊</div>
          No performance audit reports yet. Reports are generated automatically — AM at 4.5 hours into your shift, PM at clock-out.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {dates.map(date => (
            <div key={date}>
              {/* Date header */}
              <div style={{ color: '#8a9ab8', fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {fmtDate(date)}
              </div>
              {/* AM/PM reports for this date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {grouped[date].map(r => {
                  const tier = TIER_COLORS[r.scoreTier] || TIER_COLORS.yellow;
                  const isExpanded = expandedId === r.id;
                  return (
                    <div key={r.id} style={{ background: '#0d1b2a', border: `1px solid ${tier.border}`, borderRadius: '6px', overflow: 'hidden' }}>
                      {/* Collapsed header */}
                      <button onClick={() => setExpandedId(isExpanded ? null : r.id)} style={{ width: '100%', background: 'none', border: 'none', padding: '14px 16px', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ padding: '2px 10px', borderRadius: '10px', background: r.shiftPeriod === 'AM' ? 'rgba(245,158,11,0.15)' : 'rgba(167,139,250,0.15)', color: r.shiftPeriod === 'AM' ? '#f59e0b' : '#a78bfa', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }}>{r.shiftPeriod}</span>
                            {isAdmin && <span style={{ color: '#8a9ab8', fontSize: '12px' }}>{r.fronterName || r.fronterUsername}</span>}
                            <span style={{ color: '#6b7280', fontSize: '10px' }}>· {fmtTimestamp(r.reportTimestamp)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: tier.text, fontSize: '18px', fontWeight: 'bold' }}>{r.apsScore}</span>
                            <span style={{ color: '#6b7280', fontSize: '10px' }}>/100</span>
                            <span style={{ fontSize: '12px' }}>{tier.emoji}</span>
                            <span style={{ color: '#6b7280', fontSize: '14px', marginLeft: '4px' }}>{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        {/* Quick metrics */}
                        <div style={{ display: 'flex', gap: '16px' }}>
                          <span style={{ color: BLUE, fontSize: '11px' }}>📞 {r.totalCalls} calls</span>
                          <span style={{ color: '#a78bfa', fontSize: '11px' }}>🔄 {r.totalTransfers} transfers ({r.transferRate}%)</span>
                          <span style={{ color: GOLD, fontSize: '11px' }}>⏱ {fmtDuration(r.avgCallDurationSeconds)}</span>
                        </div>
                      </button>
                      {/* Expanded report */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '16px', maxHeight: '600px', overflowY: 'auto' }}>
                          <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.8, fontFamily: 'Georgia, serif' }}>
                            <ReactMarkdown
                              components={{
                                h1: ({ children }) => <h1 style={{ color: '#e8e0d0', fontSize: '18px', fontWeight: 'bold', margin: '0 0 12px' }}>{children}</h1>,
                                h2: ({ children }) => <h2 style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold', margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>{children}</h2>,
                                h3: ({ children }) => <h3 style={{ color: '#8a9ab8', fontSize: '12px', fontWeight: 'bold', margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: '1px' }}>{children}</h3>,
                                p: ({ children }) => <p style={{ margin: '0 0 10px' }}>{children}</p>,
                                ul: ({ children }) => <ul style={{ margin: '0 0 10px', paddingLeft: '20px' }}>{children}</ul>,
                                ol: ({ children }) => <ol style={{ margin: '0 0 10px', paddingLeft: '20px' }}>{children}</ol>,
                                li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                                strong: ({ children }) => <strong style={{ color: '#e8e0d0', fontWeight: 'bold' }}>{children}</strong>,
                                em: ({ children }) => <em style={{ color: '#8a9ab8' }}>{children}</em>,
                                hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '14px 0' }} />,
                              }}
                            >
                              {r.reportMarkdown || 'No report content.'}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}