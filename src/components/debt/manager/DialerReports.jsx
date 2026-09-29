import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function DialerReports({ dialerUsername, managerUsername }) {
  const [subtab, setSubtab] = useState('generate');
  const [intentSnapshots, setIntentSnapshots] = useState([]);
  const [qaHistory, setQaHistory] = useState([]);
  const [coachTips, setCoachTips] = useState([]);
  const [loading, setLoading] = useState(true);

  // Report generation state
  const [reportType, setReportType] = useState('callMeasurement');
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [generating, setGenerating] = useState(false);
  const [reportResult, setReportResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [snapshots, qa, tips] = await Promise.all([
        base44.entities.DebtIntentSnapshot.filter({ agentId: dialerUsername }, '-snapshotTime', 200),
        base44.entities.DebtQAHistory.filter({ agentId: dialerUsername }, '-askedAt', 200),
        base44.entities.DebtCoachTip.filter({ agentId: dialerUsername }, '-tipTime', 200),
      ]);
      setIntentSnapshots(snapshots || []);
      setQaHistory(qa || []);
      setCoachTips(tips || []);
    } catch {}
    setLoading(false);
  }, [dialerUsername]);

  useEffect(() => { load(); }, [load]);

  const generateReport = async () => {
    setGenerating(true); setReportResult(null);
    try {
      const res = await base44.functions.invoke('generateManagerReport', {
        reportType, dialerUsername, managerUsername, startDate, endDate,
      });
      const data = res?.data || res;
      if (data?.error) { setReportResult({ error: data.error }); }
      else { setReportResult(data?.report || data); }
    } catch (e) { setReportResult({ error: e.message }); }
    setGenerating(false);
  };

  const SUBTABS = [
    { id: 'generate', label: '📊 Generate Report' },
    { id: 'intent', label: '🎯 Intent Reports' },
    { id: 'qa', label: '❓ Q&A History' },
    { id: 'coaching', label: ' coach Coaching History' },
    { id: 'intentHistory', label: '📈 Intent History' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: '2px', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setSubtab(t.id)} style={{ padding: '8px 14px', background: 'transparent', border: 'none', borderBottom: `2px solid ${subtab === t.id ? GOLD : 'transparent'}`, color: subtab === t.id ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '11px', fontWeight: subtab === t.id ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{t.label}</button>
        ))}
      </div>

      {subtab === 'generate' && (
        <div>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📊 Generate Report</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={ls}>Report Type</label>
              <select value={reportType} onChange={e => setReportType(e.target.value)} style={inp}>
                <option value="callMeasurement">Call Measurement Analysis</option>
                <option value="intentReport">Intent Report (Cumulative)</option>
                <option value="qaReport">Q&A Report (Given vs Said)</option>
              </select>
            </div>
            <div>
              <label style={ls}>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={ls}>End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inp} />
            </div>
          </div>
          <button onClick={generateReport} disabled={generating} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 24px', cursor: generating ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: generating ? 0.5 : 1, marginBottom: '16px' }}>
            {generating ? '⏳ Generating…' : '📊 Generate Report'}
          </button>

          {reportResult && !reportResult.error && (
            <div style={{ background: '#0d1b2a', border: `1px solid ${GOLD}33`, borderRadius: '6px', padding: '20px' }}>
              {reportType === 'callMeasurement' && <CallMeasurementReport report={reportResult} />}
              {reportType === 'intentReport' && <IntentReportDisplay report={reportResult} />}
              {reportType === 'qaReport' && <QAReportDisplay report={reportResult} />}
            </div>
          )}
          {reportResult?.error && <div style={{ color: '#ef4444', fontSize: '12px' }}>⚠ {reportResult.error}</div>}
        </div>
      )}

      {subtab === 'intent' && (
        <div>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🎯 Intent Snapshots — {intentSnapshots.length}</div>
          {loading ? <div style={{ color: '#4a5568', fontSize: '12px' }}>Loading…</div> :
           intentSnapshots.length === 0 ? <div style={{ color: '#4a5568', fontSize: '12px' }}>No intent snapshots.</div> :
           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
             {intentSnapshots.map((s, i) => (
               <div key={s.id || i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '12px' }}>
                 <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '6px' }}>
                   <span style={{ color: '#f472b6', fontSize: '14px', fontWeight: 'bold' }}>Score: {s.intentScore ?? '—'}</span>
                   <span style={{ color: GOLD, fontSize: '11px' }}>{s.animalType || 'unknown'}</span>
                   <span style={{ color: '#6b7280', fontSize: '10px' }}>{s.leadName || ''}</span>
                   <span style={{ color: '#4a5568', fontSize: '10px', marginLeft: 'auto' }}>{s.snapshotTime ? new Date(s.snapshotTime).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
                 </div>
                 {s.report && <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.report}</div>}
               </div>
             ))}
           </div>}
        </div>
      )}

      {subtab === 'qa' && (
        <div>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>❓ Q&A History — {qaHistory.length}</div>
          {loading ? <div style={{ color: '#4a5568', fontSize: '12px' }}>Loading…</div> :
           qaHistory.length === 0 ? <div style={{ color: '#4a5568', fontSize: '12px' }}>No Q&A history.</div> :
           <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
             {qaHistory.map((q, i) => (
               <div key={q.id || i} style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '4px', padding: '10px 12px' }}>
                 <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                   <span style={{ color: '#60a5fa', fontSize: '9px', background: 'rgba(96,165,250,0.12)', borderRadius: '3px', padding: '1px 6px', textTransform: 'uppercase', fontWeight: 'bold' }}>{q.source || 'auto'}</span>
                   <span style={{ color: '#4a5568', fontSize: '10px' }}>{q.askedAt ? new Date(q.askedAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
                   <span style={{ color: '#e8e0d0', fontSize: '12px', flex: 1 }}>{q.question}</span>
                 </div>
                 {q.answer && <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>💡 {q.answer}</div>}
               </div>
             ))}
           </div>}
        </div>
      )}

      {subtab === 'coaching' && (
        <div>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}> coach Coaching Tips — {coachTips.length}</div>
          {loading ? <div style={{ color: '#4a5568', fontSize: '12px' }}>Loading…</div> :
           coachTips.length === 0 ? <div style={{ color: '#4a5568', fontSize: '12px' }}>No coaching tips.</div> :
           <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
             {coachTips.map((t, i) => (
               <div key={t.id || i} style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '4px', padding: '10px 12px' }}>
                 <div style={{ color: '#4a5568', fontSize: '10px', marginBottom: '4px' }}>{t.tipTime ? new Date(t.tipTime).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : ''} {t.leadName ? `— ${t.leadName}` : ''}</div>
                 <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.tip}</div>
               </div>
             ))}
           </div>}
        </div>
      )}

      {subtab === 'intentHistory' && (
        <div>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📈 Intent History (Chronological)</div>
          {loading ? <div style={{ color: '#4a5568', fontSize: '12px' }}>Loading…</div> :
           intentSnapshots.length === 0 ? <div style={{ color: '#4a5568', fontSize: '12px' }}>No intent history.</div> :
           <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
             {[...intentSnapshots].reverse().map((s, i) => (
               <div key={s.id || i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '8px 12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                 <span style={{ color: '#f472b6', fontSize: '12px', fontWeight: 'bold', minWidth: '60px' }}>{s.intentScore ?? '—'}/100</span>
                 <span style={{ color: GOLD, fontSize: '11px' }}>{s.animalType || 'unknown'}</span>
                 <span style={{ color: '#6b7280', fontSize: '10px' }}>{s.leadName || ''}</span>
                 <span style={{ color: '#4a5568', fontSize: '10px', marginLeft: 'auto' }}>{s.snapshotTime ? new Date(s.snapshotTime).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
               </div>
             ))}
           </div>}
        </div>
      )}
    </div>
  );
}

function CallMeasurementReport({ report }) {
  return (
    <div>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📊 Call Measurement Report — {report.dialer}</div>
      <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '16px' }}>{new Date(report.dateRange.start).toLocaleDateString()} — {new Date(report.dateRange.end).toLocaleDateString()}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatBox label="Total Calls" value={report.totalCalls} color="#60a5fa" />
        <StatBox label="Total Call Time" value={report.totalCallTimeFormatted} color="#10b981" />
        <StatBox label="Avg Call Time" value={report.avgCallTimeFormatted} color="#f59e0b" />
        <StatBox label="Total Login Time" value={report.totalLoginTimeFormatted} color="#a855f7" />
      </div>
      {report.dailyBreakdown && report.dailyBreakdown.length > 0 && (
        <div>
          <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Daily Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {report.dailyBreakdown.map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', padding: '6px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', fontSize: '12px' }}>
                <span style={{ color: '#8a9ab8', minWidth: '100px' }}>{new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <span style={{ color: '#60a5fa' }}>{d.calls} calls</span>
                <span style={{ color: '#10b981' }}>{d.timeFormatted}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IntentReportDisplay({ report }) {
  const trendColor = report.trend === 'IMPROVING' ? '#4ade80' : report.trend === 'DECLINING' ? '#ef4444' : '#f59e0b';
  return (
    <div>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🎯 Intent Report — {report.dialer}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatBox label="Avg Intent" value={`${report.avgIntent}/100`} color="#f472b6" />
        <StatBox label="Prev Period" value={`${report.prevAvgIntent}/100`} color="#6b7280" />
        <StatBox label="Trend" value={report.trend} color={trendColor} />
        <StatBox label="Total Calls" value={report.totalCalls} color="#60a5fa" />
      </div>
      <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{report.aiReport}</div>
    </div>
  );
}

function QAReportDisplay({ report }) {
  return (
    <div>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>❓ Q&A Report — {report.dialer}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatBox label="Total Q&A" value={report.totalQA} color="#60a5fa" />
        <StatBox label="Total Calls" value={report.totalCalls} color="#10b981" />
        <StatBox label="Date Range" value={`${new Date(report.dateRange.start).toLocaleDateString()} → ${new Date(report.dateRange.end).toLocaleDateString()}`} color="#a855f7" />
      </div>
      <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{report.aiReport}</div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`, borderRadius: '4px', padding: '12px', textAlign: 'center' }}>
      <div style={{ color, fontSize: '16px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{label}</div>
    </div>
  );
}