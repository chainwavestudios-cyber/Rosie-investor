import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#080f1c';

function formatDur(sec) {
  if (!sec || sec < 1) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_COLORS = {
  answered:    { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  icon: '📞' },
  completed:   { color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  icon: '✅' },
  missed:      { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: '📵' },
  voicemail:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: '📩' },
  ringing:     { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  icon: '🔔' },
  'no-answer': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: '📵' },
};

// ── Live Line Bar ────────────────────────────────────────────────────────────
function LiveLineBar({ line, logs }) {
  const [elapsed, setElapsed] = useState(0);

  const activeLog = logs.find(l =>
    (l.fromNumber === line.number || l.toNumber === line.number) &&
    (l.status === 'answered' || l.status === 'ringing')
  );
  const isActive = !!activeLog;
  const callStart = activeLog?.calledAt ? new Date(activeLog.calledAt) : null;

  useEffect(() => {
    if (!isActive || !callStart) { setElapsed(0); return; }
    const update = () => setElapsed(Math.floor((Date.now() - callStart) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isActive, callStart?.getTime()]);

  const displayName = activeLog?.callerName || (activeLog?.direction === 'inbound' ? activeLog?.fromNumber : activeLog?.toNumber) || '';
  const barColor = isActive ? '#4ade80' : '#ef4444';
  const barBg    = isActive ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.06)';
  const barBorder= isActive ? 'rgba(74,222,128,0.3)'  : 'rgba(239,68,68,0.2)';
  const formatElapsed = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', background:barBg, border:`1px solid ${barBorder}`, borderRadius:'6px', padding:'7px 12px', transition:'all 0.3s' }}>
      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:barColor, boxShadow:isActive?`0 0 8px ${barColor}`:'none', flexShrink:0, animation:isActive?'linePulse 1.2s ease-in-out infinite':'none' }} />
      <div style={{ color:barColor, fontSize:'11px', fontWeight:'bold', flexShrink:0 }}>{line.label}</div>
      <div style={{ color:'#4a5568', fontSize:'10px', fontFamily:'monospace', flexShrink:0 }}>{line.number}</div>
      {isActive ? (
        <div style={{ flex:1, display:'flex', gap:'8px', alignItems:'center', minWidth:0 }}>
          <span style={{ color:'#e8e0d0', fontSize:'11px', fontWeight:'bold', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayName || 'Active Call'}</span>
          <span style={{ marginLeft:'auto', color:'#4ade80', fontSize:'13px', fontFamily:'monospace', fontWeight:'bold', flexShrink:0, textShadow:'0 0 8px rgba(74,222,128,0.5)' }}>{formatElapsed(elapsed)}</span>
        </div>
      ) : (
        <div style={{ flex:1, color:'#4a5568', fontSize:'11px' }}>Idle</div>
      )}
    </div>
  );
}

// ── Reports Tab ──────────────────────────────────────────────────────────────
function ReportsTab({ lines }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [userFilter, setUserFilter] = useState('all');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.CallLog.list('-calledAt', 500);
      const dayStart = new Date(date + 'T00:00:00');
      const dayEnd   = new Date(date + 'T23:59:59');

      let filtered = (all || []).filter(l => {
        const t = new Date(l.calledAt);
        return t >= dayStart && t <= dayEnd;
      });

      // User filter — we use toNumber to match known lines
      // "admin" = calls from TWILIO_FROM_NUMBER or _2, "steph" = TWILIO_FROM_NUMBER_3
      // Since we don't store who dialed, we map by which outbound number was used
      const adminNumbers = lines.slice(0, 2).map(l => l.number);
      const stephNumbers = lines.slice(2).map(l => l.number);

      if (userFilter === 'admin') {
        filtered = filtered.filter(l => adminNumbers.includes(l.fromNumber) || adminNumbers.includes(l.toNumber));
      } else if (userFilter === 'steph') {
        filtered = filtered.filter(l => stephNumbers.includes(l.fromNumber) || stephNumbers.includes(l.toNumber));
      }

      const totalCalls = filtered.length;
      const answered = filtered.filter(l => l.status === 'answered' || l.status === 'completed');
      const answeredCount = answered.length;
      const connectionRate = totalCalls > 0 ? ((answeredCount / totalCalls) * 100).toFixed(1) : '0.0';
      const totalDial = filtered.reduce((sum, l) => sum + (l.durationSeconds || 0), 0);
      const avgDial = answeredCount > 0 ? Math.round(totalDial / answeredCount) : 0;
      const longestCall = answered.reduce((max, l) => Math.max(max, l.durationSeconds || 0), 0);

      // Converted leads: leads that moved to prospect or nb_tech — check LeadHistory for that day
      let convertedCount = 0;
      try {
        const histories = await base44.entities.LeadHistory.list('-created_date', 300);
        convertedCount = (histories || []).filter(h => {
          const t = new Date(h.created_date || h.createdAt || 0);
          return t >= dayStart && t <= dayEnd && (h.type === 'interested' || h.content?.toLowerCase().includes('converted') || h.content?.toLowerCase().includes('prospect'));
        }).length;
      } catch {}
      const convertedPct = totalCalls > 0 ? ((convertedCount / totalCalls) * 100).toFixed(1) : '0.0';

      setReport({ totalCalls, answeredCount, connectionRate, totalDial, avgDial, longestCall, convertedCount, convertedPct, date, userFilter });
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const inp = { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'8px 12px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'Georgia, serif', colorScheme:'dark' };

  const stat = (label, value, color='#e8e0d0', sub=null) => (
    <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'6px', padding:'14px 16px', textAlign:'center' }}>
      <div style={{ color, fontSize:'22px', fontWeight:'bold', lineHeight:1.1 }}>{value}</div>
      <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase', marginTop:'4px' }}>{label}</div>
      {sub && <div style={{ color:'#6b7280', fontSize:'10px', marginTop:'3px' }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding:'16px' }}>
      <div style={{ display:'flex', gap:'10px', alignItems:'flex-end', marginBottom:'18px', flexWrap:'wrap' }}>
        <div>
          <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'1px', marginBottom:'5px' }}>DATE</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, cursor:'pointer' }} />
        </div>
        <div>
          <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'1px', marginBottom:'5px' }}>USER</div>
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
            <option value="all">All Users</option>
            <option value="admin">Admin</option>
            <option value="steph">Steph</option>
          </select>
        </div>
        <button onClick={generate} disabled={loading}
          style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'9px 22px', cursor:'pointer', fontWeight:'700', fontSize:'11px', letterSpacing:'1.5px', textTransform:'uppercase', alignSelf:'flex-end' }}>
          {loading ? 'Generating…' : '▶ Generate'}
        </button>
      </div>

      {report && (
        <div>
          <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>
            Report for {fmtDate(report.date + 'T12:00:00')} · {report.userFilter === 'all' ? 'All Users' : report.userFilter === 'admin' ? 'Admin' : 'Steph'}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'8px' }}>
            {stat('Total Calls', report.totalCalls, GOLD)}
            {stat('Answered', report.answeredCount, '#4ade80')}
            {stat('Connection Rate', report.connectionRate + '%', '#60a5fa')}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'8px' }}>
            {stat('Total Dial Time', formatDur(report.totalDial), '#a78bfa')}
            {stat('Avg Call Length', formatDur(report.avgDial), '#f59e0b')}
            {stat('Longest Call', formatDur(report.longestCall), '#60a5fa')}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
            {stat('Converted Leads', report.convertedCount, '#4ade80', 'Lead → Prospect or NB Tech')}
            {stat('Conversion Rate', report.convertedPct + '%', '#4ade80')}
          </div>
        </div>
      )}

      {!report && !loading && (
        <div style={{ color:'#4a5568', textAlign:'center', padding:'40px', fontSize:'12px' }}>
          Select a date and user, then click Generate.
        </div>
      )}
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────
export default function CallLogPanel({ onClose, onOpenLead }) {
  const [logs, setLogs]               = useState([]);
  const [lines, setLines]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedNums, setSelectedNums] = useState(['all']); // 'all' or array of numbers
  const [dirTab, setDirTab]           = useState('inbound');   // 'inbound' | 'outbound'
  const [mainTab, setMainTab]         = useState('calls');     // 'calls' | 'reports'
  const [playingVm, setPlayingVm]     = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    loadData();
    const poll = setInterval(loadLogs, 5000);
    return () => clearInterval(poll);
  }, []);

  const loadData = async () => {
    try {
      const [logsData, linesData] = await Promise.all([
        base44.entities.CallLog.list('-calledAt', 150),
        base44.functions.invoke('twilioGetLines', {}),
      ]);
      setLogs(logsData || []);
      setLines(linesData?.data?.lines || linesData?.lines || []);
    } catch {}
    setLoading(false);
  };

  const loadLogs = async () => {
    try {
      const data = await base44.entities.CallLog.list('-calledAt', 150);
      setLogs(data || []);
    } catch {}
  };

  const toggleNumber = (num) => {
    if (num === 'all') { setSelectedNums(['all']); return; }
    setSelectedNums(prev => {
      const without = prev.filter(n => n !== 'all');
      if (without.includes(num)) {
        const next = without.filter(n => n !== num);
        return next.length === 0 ? ['all'] : next;
      }
      return [...without, num];
    });
  };

  const isSelected = (num) => num === 'all' ? selectedNums.includes('all') : selectedNums.includes(num);

  const filteredByNum = logs.filter(l => {
    if (selectedNums.includes('all')) return true;
    return selectedNums.some(n => l.fromNumber === n || l.toNumber === n);
  });

  const filtered = filteredByNum.filter(l => l.direction === dirTab);

  const markVmListened = async (log) => {
    if (!log.vmListened) {
      await base44.entities.CallLog.update(log.id, { vmListened: true, dismissed: true }).catch(() => {});
      setLogs(prev => prev.map(l => l.id === log.id ? { ...l, vmListened: true, dismissed: true } : l));
    }
    setPlayingVm(log.id === playingVm ? null : log.id);
  };

  const dismissAll = async () => {
    const unread = logs.filter(l => !l.dismissed);
    await Promise.all(unread.map(l => base44.entities.CallLog.update(l.id, { dismissed: true }).catch(() => {})));
    setLogs(prev => prev.map(l => ({ ...l, dismissed: true })));
  };

  const unlistenedVm = logs.filter(l => l.vmRecordingUrl && !l.vmListened).length;
  const missedCount  = logs.filter(l => (l.status === 'missed' || l.status === 'no-answer') && !l.dismissed).length;

  const pillStyle = (active, color = GOLD) => ({
    padding: '4px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '11px', fontFamily: 'Georgia, serif',
    background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? color + '66' : 'rgba(255,255,255,0.1)'}`,
    color: active ? color : '#6b7280',
    fontWeight: active ? 'bold' : 'normal',
    userSelect: 'none',
  });

  return (
    <>
      <style>{`
        @keyframes linePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }
      `}</style>
      <div style={{
        position: 'fixed', top: '70px', right: '20px', zIndex: 99990,
        width: '540px', maxHeight: '88vh',
        background: DARK, border: `1px solid rgba(184,147,58,0.3)`,
        borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
        fontFamily: 'Georgia, serif', display: 'flex', flexDirection: 'column',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: GOLD, fontSize: '12px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>📋 Call Log</span>
            {unlistenedVm > 0 && <span style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 'bold' }}>📩 {unlistenedVm} VM</span>}
            {missedCount > 0 && <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 'bold' }}>📵 {missedCount} Missed</span>}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={dismissAll} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px' }}>Mark All Read</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* ── Live Line Bars ── */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Live Line Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {lines.length > 0
              ? lines.map((line, i) => <LiveLineBar key={i} line={line} logs={logs} />)
              : [0,1,2].map(n => (
                  <div key={n} style={{ display:'flex', alignItems:'center', gap:'10px', background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:'6px', padding:'7px 12px' }}>
                    <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#374151', flexShrink:0 }} />
                    <div style={{ color:'#4a5568', fontSize:'11px' }}>Line {n+1} — loading…</div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* ── Main Tab: Calls | Reports ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {[['calls','📋 Calls'], ['reports','📊 Reports']].map(([id, label]) => (
            <button key={id} onClick={() => setMainTab(id)}
              style={{ flex: 1, background: 'none', border: 'none', borderBottom: mainTab === id ? `2px solid ${GOLD}` : '2px solid transparent', color: mainTab === id ? GOLD : '#6b7280', padding: '9px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.5px' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Reports ── */}
        {mainTab === 'reports' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <ReportsTab lines={lines} />
          </div>
        )}

        {/* ── Calls Tab ── */}
        {mainTab === 'calls' && (
          <>
            {/* Phone # Multi-Select */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <div style={{ color: '#4a5568', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '7px' }}>Filter by Phone #</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <div onClick={() => toggleNumber('all')} style={pillStyle(isSelected('all'))}>All</div>
                {lines.map((line) => (
                  <div key={line.number} onClick={() => toggleNumber(line.number)} style={pillStyle(isSelected(line.number))}>
                    {line.label} — {line.number}
                  </div>
                ))}
              </div>
            </div>

            {/* Incoming / Outgoing Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
              {[['inbound','↙ Incoming'], ['outbound','↗ Outgoing']].map(([dir, label]) => {
                const count = filteredByNum.filter(l => l.direction === dir).length;
                return (
                  <button key={dir} onClick={() => setDirTab(dir)}
                    style={{ flex: 1, background: 'none', border: 'none', borderBottom: dirTab === dir ? `2px solid ${dir === 'inbound' ? '#60a5fa' : '#a78bfa'}` : '2px solid transparent', color: dirTab === dir ? (dir === 'inbound' ? '#60a5fa' : '#a78bfa') : '#6b7280', padding: '8px', cursor: 'pointer', fontSize: '11px' }}>
                    {label} <span style={{ fontSize: '10px', opacity: 0.7 }}>({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Call List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {loading && <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Loading…</div>}
              {!loading && filtered.length === 0 && (
                <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
                  No {dirTab === 'inbound' ? 'incoming' : 'outgoing'} call records.
                </div>
              )}
              {filtered.map((log) => {
                const st = STATUS_COLORS[log.status] || STATUS_COLORS.ringing;
                const isUnread = !log.dismissed && (log.status === 'missed' || log.status === 'no-answer' || (log.vmRecordingUrl && !log.vmListened));
                const displayName = log.callerName || (log.direction === 'inbound' ? log.fromNumber : log.toNumber) || '—';
                const displayNum  = log.direction === 'inbound' ? log.fromNumber : log.toNumber;
                const isPlayingThis = playingVm === log.id;

                // Which of our lines was used?
                const usedLine = lines.find(l => l.number === log.fromNumber || l.number === log.toNumber);

                return (
                  <div key={log.id} style={{
                    background: isUnread ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)',
                    border: `1px solid ${isUnread ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
                    borderLeft: `3px solid ${st.color}`,
                    borderRadius: '6px', padding: '10px 12px', marginBottom: '6px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '13px' }}>{st.icon}</span>
                          <span style={{ color: isUnread ? '#e8e0d0' : '#c4cdd8', fontSize: '13px', fontWeight: isUnread ? 'bold' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                          {!log.dismissed && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0, display: 'inline-block' }} />}
                        </div>
                        {/* Number */}
                        <div style={{ color: '#60a5fa', fontSize: '11px', fontFamily: 'monospace', marginBottom: '2px' }}>{displayNum || '—'}</div>
                        {/* Line used + who called */}
                        <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' }}>
                          {usedLine && (
                            <span style={{ background:'rgba(184,147,58,0.1)', color:GOLD, border:'1px solid rgba(184,147,58,0.2)', borderRadius:'3px', padding:'1px 6px', fontSize:'9px', letterSpacing:'0.5px' }}>
                              via {usedLine.label}
                            </span>
                          )}
                          {log.createdBy && (
                            <span style={{ background:'rgba(167,139,250,0.1)', color:'#a78bfa', border:'1px solid rgba(167,139,250,0.2)', borderRadius:'3px', padding:'1px 6px', fontSize:'9px' }}>
                              👤 {log.createdBy}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: date + status + duration */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ color: '#6b7280', fontSize: '10px', marginBottom: '2px' }}>{fmtDateTime(log.calledAt)}</div>
                        <div style={{ display:'flex', gap:'4px', justifyContent:'flex-end', alignItems:'center' }}>
                          <span style={{ background: st.bg, color: st.color, padding: '1px 6px', borderRadius: '3px', fontSize: '10px' }}>{log.status}</span>
                          {log.durationSeconds > 0 && <span style={{ color: '#6b7280', fontSize: '10px' }}>⏱ {formatDur(log.durationSeconds)}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Voicemail */}
                    {log.vmRecordingUrl && (
                      <div style={{ marginTop: '8px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', padding: '7px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 'bold' }}>📩 Voicemail {!log.vmListened && '· NEW'}</span>
                          <button onClick={() => markVmListened(log)}
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px' }}>
                            {isPlayingThis ? '⏹ Close' : '▶ Play'}
                          </button>
                        </div>
                        {log.vmTranscription && (
                          <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5, fontStyle: 'italic', marginTop: '4px' }}>
                            "{log.vmTranscription.slice(0, 200)}{log.vmTranscription.length > 200 ? '…' : ''}"
                          </div>
                        )}
                        {isPlayingThis && (
                          <audio ref={audioRef} src={log.vmRecordingUrl} controls autoPlay style={{ width: '100%', marginTop: '6px', height: '32px' }} />
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      {log.leadId && onOpenLead && (
                        <button onClick={() => onOpenLead(log.leadId)}
                          style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px' }}>
                          📋 Open Lead
                        </button>
                      )}
                      {!log.dismissed && (
                        <button onClick={async () => {
                          await base44.entities.CallLog.update(log.id, { dismissed: true }).catch(() => {});
                          setLogs(prev => prev.map(l => l.id === log.id ? { ...l, dismissed: true } : l));
                        }} style={{ background: 'rgba(255,255,255,0.04)', color: '#4a5568', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px' }}>
                          ✓ Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}