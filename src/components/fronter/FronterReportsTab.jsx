/**
 * FronterReportsTab.jsx — Daily cumulative reports for fronters.
 * Admin can generate and view one daily report per fronter.
 * Each report shows: # calls, login/logout time, total talk time, transfers, future meetings.
 * Cumulative report uses all post-call reports for that day as reference.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

function fmtTime(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function FronterReportsTab({ fronters }) {
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyReports, setDailyReports] = useState([]);
  const [generating, setGenerating] = useState('');
  const [expandedReport, setExpandedReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.FronterDailyReport.filter({ reportDate }, '-created_date', 100);
      setDailyReports(all || []);
    } catch {}
    setLoading(false);
  }, [reportDate]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const generateReport = async (fronterUsername) => {
    setGenerating(fronterUsername);
    try {
      // Load all call reports for this fronter on this date
      const dayStart = new Date(reportDate + 'T00:00:00');
      const dayEnd = new Date(reportDate + 'T23:59:59');
      const allReports = await base44.entities.FronterCallReport.filter({ fronterUsername }, '-callDate', 500);
      const dayReports = (allReports || []).filter(r => {
        const d = new Date(r.callDate);
        return d >= dayStart && d <= dayEnd;
      });

      // Load leads for metrics
      const allLeads = await base44.entities.FronterLead.filter({ assignedTo: fronterUsername }, '-created_date', 500);
      const dayLeads = (allLeads || []).filter(l => {
        if (!l.lastCalledAt) return false;
        const d = new Date(l.lastCalledAt);
        return d >= dayStart && d <= dayEnd;
      });

      const totalCalls = dayReports.length;
      const totalTalkTimeSeconds = dayReports.reduce((s, r) => s + (r.durationSeconds || 0), 0);
      const transferCalls = (allLeads || []).filter(l => l.status === 'transferred' && l.transferredAt && new Date(l.transferredAt) >= dayStart && new Date(l.transferredAt) <= dayEnd).length;
      const futureMeetingCalls = (allLeads || []).filter(l => l.status === 'lead' && l.lastCalledAt && new Date(l.lastCalledAt) >= dayStart && new Date(l.lastCalledAt) <= dayEnd).length;

      // Login/logout from localStorage
      const loginTime = localStorage.getItem(`fronter_login_${fronterUsername}`);
      const logoutTime = localStorage.getItem(`fronter_logout_${fronterUsername}`);

      // Generate cumulative report using InvokeLLM
      const reportsText = dayReports.map((r, i) => `--- Call ${i + 1}: ${r.leadName} (${r.durationSeconds}s) ---\nSentiment: ${r.sentiment}\nInterest: ${r.customerInterest}\nScript Adherence: ${r.scriptAdherence}\nObjection Handling: ${r.objectionHandling}\nPersonality: ${r.personalityReview}\nFull Report: ${r.fullReport}`).join('\n\n');

      let cumulativeReport = '';
      if (dayReports.length > 0) {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a call center supervisor writing a daily cumulative performance report for a fronter named ${fronterUsername} on ${reportDate}.

DAILY METRICS:
- Total Calls: ${totalCalls}
- Total Talk Time: ${fmtTime(totalTalkTimeSeconds)}
- Transfer Calls: ${transferCalls}
- Future Meeting/Callback Calls: ${futureMeetingCalls}
- Login Time: ${loginTime ? fmtDate(loginTime) : '—'}
- Logout Time: ${logoutTime ? fmtDate(logoutTime) : '—'}

INDIVIDUAL CALL REPORTS:
${reportsText}

Write a comprehensive daily report covering:
1. Overall performance summary
2. Strengths demonstrated across calls
3. Areas for improvement
4. Script adherence patterns
5. Objection handling patterns
6. Customer sentiment trends
7. Specific coaching recommendations for tomorrow

Keep it professional, specific, and actionable. 3-5 paragraphs.`,
        });
        cumulativeReport = res || '';
      } else {
        cumulativeReport = 'No calls were made on this date.';
      }

      // Create or update daily report
      const existing = dailyReports.find(r => r.fronterUsername === fronterUsername);
      if (existing) {
        await base44.entities.FronterDailyReport.update(existing.id, {
          totalCalls, loginTime: loginTime || null, logoutTime: logoutTime || null,
          totalTalkTimeSeconds, transferCalls, futureMeetingCalls, cumulativeReport,
        });
      } else {
        await base44.entities.FronterDailyReport.create({
          fronterUsername, reportDate, totalCalls,
          loginTime: loginTime || null, logoutTime: logoutTime || null,
          totalTalkTimeSeconds, transferCalls, futureMeetingCalls, cumulativeReport,
        });
      }

      loadReports();
    } catch (e) {
      alert('Report generation failed: ' + (e?.message || String(e)));
    }
    setGenerating('');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📊 Daily Fronter Reports</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ ...ls, marginBottom: 0 }}>Date</label>
          <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={{ ...inp, width: 'auto' }} />
          <button onClick={loadReports} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px' }}>↻ Refresh</button>
        </div>
      </div>

      {/* Generate buttons per fronter */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Generate Report for:</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {fronters.map(f => {
            const hasReport = dailyReports.some(r => r.fronterUsername === f.username);
            return (
              <button key={f.id} onClick={() => generateReport(f.username)} disabled={generating === f.username} style={{ background: hasReport ? `${GOLD}18` : 'rgba(255,255,255,0.05)', color: hasReport ? GOLD : '#8a9ab8', border: `1px solid ${hasReport ? GOLD + '44' : 'rgba(255,255,255,0.12)'}`, borderRadius: '4px', padding: '8px 14px', cursor: generating === f.username ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: generating === f.username ? 0.5 : 1 }}>
                {generating === f.username ? '⏳ Generating…' : hasReport ? '↻ Regenerate' : '+ Generate'} {f.username}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reports list */}
      {loading ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
      ) : dailyReports.length === 0 ? (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>No reports generated for this date yet. Click "Generate" above to create one.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {dailyReports.map(r => {
            const isExpanded = expandedReport === r.id;
            return (
              <div key={r.id} style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', overflow: 'hidden' }}>
                {/* Header with metrics */}
                <button onClick={() => setExpandedReport(isExpanded ? null : r.id)} style={{ width: '100%', background: 'none', border: 'none', padding: '16px', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ color: '#e8e0d0', fontSize: '15px', fontWeight: 'bold' }}>{r.fronterUsername}</span>
                    <span style={{ color: '#6b7280', fontSize: '11px' }}>{r.reportDate}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                    <MetricBox label="Calls" value={r.totalCalls} color={BLUE} />
                    <MetricBox label="Login" value={r.loginTime ? new Date(r.loginTime).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }) : '—'} color={GOLD} />
                    <MetricBox label="Logout" value={r.logoutTime ? new Date(r.logoutTime).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }) : '—'} color={AMBER} />
                    <MetricBox label="Talk Time" value={fmtTime(r.totalTalkTimeSeconds)} color={GOLD} />
                    <MetricBox label="Transfers" value={r.transferCalls} color={PURPLE} />
                    <MetricBox label="Meetings" value={r.futureMeetingCalls} color={BLUE} />
                  </div>
                </button>

                {/* Expanded report */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '16px' }}>
                    <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>📋 Cumulative Daily Report</div>
                    <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>{r.cumulativeReport}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`, borderRadius: '4px', padding: '8px', textAlign: 'center' }}>
      <div style={{ color, fontSize: '14px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>{label}</div>
    </div>
  );
}