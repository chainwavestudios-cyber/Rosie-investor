/**
 * MarketingEngagementReport.jsx — the nightly engagement report for the Debt
 * Call Coach marketing campaigns.
 *
 * One block per night, and under it every person that something happened with:
 * whether their email was opened, whether they watched the welcome message,
 * which links they clicked, whether the Introduction 2 follow-up went out and
 * the call it booked. "Run report now" builds today's report on demand.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const th = { padding: '6px 9px', color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' };
const td = { padding: '6px 9px', fontSize: '11px', color: '#e8e0d0', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'top' };

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : '—');
const shortUrl = (url) => String(url || '').replace(/^https?:\/\//i, '').split('?')[0].slice(0, 46);

function rowsOf(report) {
  try { const v = JSON.parse(report.rowsJson || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

export default function MarketingEngagementReport() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    const raw = await base44.entities.DebtMarketingReport.list('-reportDate', 14).catch(() => []);
    setReports(Array.isArray(raw) ? raw : raw?.items || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('debtMarketingReport', {});
      if (res?.data?.error) throw new Error(res.data.error);
      await load();
      setOpenId(res?.data?.report?.id || null);
    } catch (e) {
      alert('Could not run the report: ' + (e?.message || e));
    }
    setRunning(false);
  };

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '8px', padding: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div>
          <div style={{ color: BLUE, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📊 Nightly engagement report</div>
          <div style={{ color: '#8a9ab8', fontSize: '11px', marginTop: '4px' }}>What was opened, which welcome messages were watched and every link clicked — person by person.</div>
        </div>
        <button onClick={runNow} disabled={running} style={{ background: 'rgba(96,165,250,0.14)', color: BLUE, border: '1px solid rgba(96,165,250,0.4)', borderRadius: '4px', padding: '8px 14px', cursor: running ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: running ? 0.6 : 1 }}>
          {running ? '⏳ Building…' : '▶ Run report now'}
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#8a9ab8', fontSize: '12px' }}>Loading…</div>
      ) : reports.length === 0 ? (
        <div style={{ color: '#8a9ab8', fontSize: '12px' }}>No reports yet — the first one runs tonight, or press “Run report now”.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {reports.map((report) => {
            const people = rowsOf(report);
            const open = openId === report.id;
            return (
              <div key={report.id} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', overflow: 'hidden' }}>
                <button onClick={() => setOpenId(open ? null : report.id)} style={{ width: '100%', textAlign: 'left', background: open ? 'rgba(96,165,250,0.08)' : 'rgba(255,255,255,0.02)', border: 'none', padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: 'bold' }}>{report.reportDate}</span>
                  <span style={{ color: '#8a9ab8', fontSize: '11px' }}>
                    {report.peopleCount || 0} people · {report.totalEmailsSent || 0} sent · <span style={{ color: BLUE }}>{report.totalOpened || 0} opened</span> · <span style={{ color: GOLD }}>{report.totalWelcomeViewed || 0} welcome watched</span> · {report.totalLinksClicked || 0} links · {report.totalIntro2Sent || 0} Intro 2 · {report.totalCallsScheduled || 0} calls booked
                  </span>
                </button>

                {open && (
                  people.length === 0 ? (
                    <div style={{ padding: '12px', color: '#8a9ab8', fontSize: '11px' }}>Nothing happened with this campaign group on this day.</div>
                  ) : (
                    <div style={{ overflowX: 'auto', padding: '0 6px 8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={th}>Person</th><th style={th}>Email</th><th style={th}>Opened</th>
                            <th style={th}>Welcome message</th><th style={th}>Links clicked</th>
                            <th style={th}>Introduction 2</th><th style={th}>Call booked</th>
                          </tr>
                        </thead>
                        <tbody>
                          {people.map((p, i) => (
                            <tr key={`${p.email}-${i}`}>
                              <td style={td}>{p.leadName}{p.campaignName ? <div style={{ color: '#8a9ab8', fontSize: '9px' }}>{p.campaignName}{p.kind === 'intro2' ? ' · Intro 2' : ''}</div> : null}</td>
                              <td style={td}>{p.email || '—'}</td>
                              <td style={td}>{p.opened ? <span style={{ color: BLUE }}>✓ {p.openCount || 1}×<div style={{ color: '#8a9ab8', fontSize: '9px' }}>{fmt(p.firstOpenedAt)}</div></span> : <span style={{ color: '#6b7280' }}>—</span>}</td>
                              <td style={td}>{p.welcomeViewedAt ? <span style={{ color: GOLD }}>✓<div style={{ color: '#8a9ab8', fontSize: '9px' }}>{fmt(p.welcomeViewedAt)}</div></span> : <span style={{ color: '#6b7280' }}>—</span>}</td>
                              <td style={td}>
                                {(p.linksClicked || []).length === 0 ? <span style={{ color: '#6b7280' }}>—</span> : (p.linksClicked || []).map((l, j) => (
                                  <div key={j} style={{ fontSize: '10px' }}>{shortUrl(l.url)}<span style={{ color: '#8a9ab8' }}> · {fmt(l.at)}</span></div>
                                ))}
                              </td>
                              <td style={td}>{p.intro2SentAt ? <span style={{ color: GOLD }}>✓<div style={{ color: '#8a9ab8', fontSize: '9px' }}>{fmt(p.intro2SentAt)}</div></span> : <span style={{ color: '#6b7280' }}>—</span>}</td>
                              <td style={td}>{p.callAt ? <span style={{ color: '#f59e0b' }}>📞<div style={{ color: '#8a9ab8', fontSize: '9px' }}>{fmt(p.callAt)}</div></span> : <span style={{ color: '#6b7280' }}>—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}