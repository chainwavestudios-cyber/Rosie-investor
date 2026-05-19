import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { fmtDateTime, fmtDate, fmtDateTimeShort } from '@/lib/fmtDate.js';

const GOLD = '#b8933a';
const DARK = '#080f1c';

function formatDur(sec) {
  if (!sec || sec < 1) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const STATUS_COLORS = {
  answered:    { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  icon: '📞' },
  completed:   { color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  icon: '✅' },
  missed:      { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: '📵' },
  voicemail:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: '📩' },
  ringing:     { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  icon: '🔔' },
  'no-answer': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: '📵' },
};

// Map from number to agent label
const NUMBER_TO_AGENT = {};

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
  const [mode, setMode] = useState('day');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [agentFilter, setAgentFilter] = useState('all'); // 'all' | line.number
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);

  const generate = async () => {
    setLoading(true);
    try {
      const startDate = mode === 'year' ? `${year}-01-01` : date;
      const endDate   = mode === 'year' ? `${year}-12-31` : date;

      // Parallel: fetch Twilio calls + Lead conversions in the date range
      const [callRes, leadsData] = await Promise.all([
        base44.functions.invoke('twilioCallLogs', { startDate, endDate }),
        base44.entities.Lead.list('-updated_date', 5000),
      ]);

      const allCalls = (callRes.data?.calls || []).filter(c => c.direction !== 'inbound');

      // Filter by agent line if selected
      const filtered = agentFilter === 'all'
        ? allCalls
        : allCalls.filter(c => c.from === agentFilter);

      const agentLabel = agentFilter === 'all'
        ? 'All Agents'
        : (lines.find(l => l.number === agentFilter)?.label || agentFilter);

      const totalCalls    = filtered.length;
      const answered      = filtered.filter(c => c.status === 'completed' && c.duration > 0);
      const answeredCount = answered.length;
      const connectionRate = totalCalls > 0 ? ((answeredCount / totalCalls) * 100).toFixed(1) : '0.0';
      const totalDial     = filtered.reduce((sum, c) => sum + (c.duration || 0), 0);
      const avgDial       = answeredCount > 0 ? Math.round(totalDial / answeredCount) : 0;
      const longestCall   = filtered.reduce((max, c) => Math.max(max, c.duration || 0), 0);

      // Count leads converted to prospect or nb_tech in the date range
      const start = new Date(startDate + 'T00:00:00');
      const end   = new Date(endDate   + 'T23:59:59');
      const converted = (leadsData || []).filter(l => {
        const updatedAt = new Date(l.updated_date || 0);
        if (updatedAt < start || updatedAt > end) return false;
        // If filtering by agent, match by pipeline owner
        if (agentFilter !== 'all') {
          const ownerMatch = l.leadPipelineOwner === agentLabel.toLowerCase();
          if (!ownerMatch) return false;
        }
        return l.status === 'prospect' || l.leadType === 'nb_tech';
      });
      const convertedProspect = converted.filter(l => l.status === 'prospect').length;
      const convertedNBTech   = converted.filter(l => l.leadType === 'nb_tech').length;
      const convertedTotal    = converted.length;

      setReport({ totalCalls, answeredCount, connectionRate, totalDial, avgDial, longestCall,
        convertedTotal, convertedProspect, convertedNBTech, date, year, mode, startDate, endDate, agentLabel });
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
      <div style={{ display:'flex', gap:'6px', marginBottom:'14px' }}>
        {[['day','📅 Day'], ['year','📆 Year']].map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); setReport(null); }}
            style={{ background: mode===m ? `${GOLD}22` : 'rgba(255,255,255,0.04)', border:`1px solid ${mode===m ? GOLD+'66' : 'rgba(255,255,255,0.1)'}`, color: mode===m ? GOLD : '#6b7280', borderRadius:'20px', padding:'4px 14px', cursor:'pointer', fontSize:'11px', fontWeight: mode===m ? 'bold' : 'normal' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display:'flex', gap:'10px', alignItems:'flex-end', marginBottom:'18px', flexWrap:'wrap' }}>
        {mode === 'day' ? (
          <div>
            <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'1px', marginBottom:'5px' }}>DATE</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, cursor:'pointer' }} />
          </div>
        ) : (
          <div>
            <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'1px', marginBottom:'5px' }}>YEAR</div>
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...inp, cursor:'pointer' }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
              <option value={currentYear}>{currentYear}</option>
            </select>
          </div>
        )}
        <div>
          <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'1px', marginBottom:'5px' }}>AGENT</div>
          <select value={agentFilter} onChange={e => { setAgentFilter(e.target.value); setReport(null); }} style={{ ...inp, cursor:'pointer' }}>
            <option value="all">👥 All Agents</option>
            {lines.map(l => (
              <option key={l.number} value={l.number}>{l.label === 'Steph' ? '🟣' : '🟡'} {l.label}</option>
            ))}
          </select>
        </div>
        <button onClick={generate} disabled={loading}
          style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'9px 22px', cursor:'pointer', fontWeight:'700', fontSize:'11px', letterSpacing:'1.5px', textTransform:'uppercase', alignSelf:'flex-end' }}>
          {loading ? 'Generating…' : '▶ Generate'}
        </button>
      </div>

      {report && (
        <div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center', marginBottom:'12px', flexWrap:'wrap' }}>
            <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase' }}>
              {report.mode === 'year' ? `Report for ${report.year}` : `Report for ${fmtDate(report.date + 'T12:00:00')}`}
            </div>
            <span style={{
              background: report.agentLabel === 'Steph' ? 'rgba(167,139,250,0.15)' : report.agentLabel === 'All Agents' ? 'rgba(255,255,255,0.06)' : 'rgba(184,147,58,0.15)',
              color: report.agentLabel === 'Steph' ? '#a78bfa' : report.agentLabel === 'All Agents' ? '#8a9ab8' : GOLD,
              border: `1px solid ${report.agentLabel === 'Steph' ? 'rgba(167,139,250,0.35)' : report.agentLabel === 'All Agents' ? 'rgba(255,255,255,0.12)' : 'rgba(184,147,58,0.35)'}`,
              borderRadius:'10px', padding:'2px 10px', fontSize:'10px', fontWeight:'bold',
            }}>
              {report.agentLabel === 'Steph' ? '🟣' : report.agentLabel === 'All Agents' ? '👥' : '🟡'} {report.agentLabel}
            </span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'8px' }}>
            {stat('Total Calls', report.totalCalls, GOLD)}
            {stat('Connected', report.answeredCount, '#4ade80')}
            {stat('Connection Rate', report.connectionRate + '%', '#60a5fa')}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'8px' }}>
            {stat('Total Dial Time', formatDur(report.totalDial), '#a78bfa')}
            {stat('Avg Call Length', formatDur(report.avgDial), '#f59e0b')}
            {stat('Longest Call', formatDur(report.longestCall), '#60a5fa')}
          </div>
          {/* Conversions section */}
          <div style={{ marginTop:'4px', marginBottom:'8px' }}>
            <div style={{ color:'#4ade80', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>📈 Conversions</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
              {stat('Total Converted', report.convertedTotal, '#4ade80')}
              {stat('→ Prospect', report.convertedProspect, '#a78bfa')}
              {stat('→ NB Tech', report.convertedNBTech, '#818cf8')}
            </div>
          </div>
        </div>
      )}

      {!report && !loading && (
        <div style={{ color:'#4a5568', textAlign:'center', padding:'40px', fontSize:'12px' }}>
          Select a date range and click Generate.
        </div>
      )}
    </div>
  );
}

// ── Convert Lead Buttons ─────────────────────────────────────────────────────
function ConvertButtons({ call, leads, onConverted }) {
  const [converting, setConverting] = useState(false);
  const [done, setDone] = useState(null); // 'prospect' | 'nb_tech'

  // Try to match lead by phone number
  const matchedLead = leads.find(l =>
    l.phone === call.to || l.phone === call.from ||
    l.phone2 === call.to || l.phone2 === call.from
  );

  if (!matchedLead || matchedLead.status === 'not_interested') return null;
  if (matchedLead.status === 'prospect' && done !== 'prospect') {
    return <span style={{ color:'#a78bfa', fontSize:'10px' }}>⭐ Prospect</span>;
  }
  if (matchedLead.leadType === 'nb_tech' && done !== 'nb_tech') {
    return <span style={{ color:'#818cf8', fontSize:'10px' }}>💡 NB Tech</span>;
  }
  if (done) return <span style={{ color:'#4ade80', fontSize:'10px' }}>✅ Converted to {done === 'prospect' ? 'Prospect' : 'NB Tech'}</span>;

  const convert = async (type) => {
    setConverting(true);
    try {
      if (type === 'prospect') {
        await base44.entities.Lead.update(matchedLead.id, { status: 'prospect', leadPipelineStage: 'reviewing' });
        await base44.entities.LeadHistory.create({ leadId: matchedLead.id, type: 'prospect', content: 'Converted to Prospect from Call Log', createdBy: 'admin' });
      } else {
        await base44.entities.Lead.update(matchedLead.id, { leadType: 'nb_tech', leadPipelineStage: matchedLead.leadPipelineStage || 'reviewing' });
        await base44.entities.LeadHistory.create({ leadId: matchedLead.id, type: 'note', content: '💡 Converted to NB Tech from Call Log', createdBy: 'admin' });
      }
      setDone(type);
      onConverted && onConverted();
    } catch(e) { console.error(e); }
    setConverting(false);
  };

  return (
    <div style={{ display:'flex', gap:'4px', alignItems:'center', flexWrap:'wrap' }}>
      <span style={{ color:'#4a5568', fontSize:'9px' }}>Convert:</span>
      <button onClick={() => convert('prospect')} disabled={converting}
        style={{ background:'rgba(74,222,128,0.12)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'4px', padding:'2px 8px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }}>
        ✅ Prospect
      </button>
      <button onClick={() => convert('nb_tech')} disabled={converting}
        style={{ background:'rgba(99,102,241,0.12)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'4px', padding:'2px 8px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }}>
        💡 NB Tech
      </button>
      <button disabled
        style={{ background:'rgba(239,68,68,0.08)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'4px', padding:'2px 8px', cursor:'not-allowed', fontSize:'10px', opacity:0.6 }}>
        ✗ No Convert
      </button>
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────
export default function CallLogPanel({ onClose, onOpenLead }) {
  const [callLogs, setCallLogs]         = useState([]);
  const [historyRows, setHistoryRows]   = useState([]);
  const [lines, setLines]               = useState([]);
  const [leads, setLeads]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [dirTab, setDirTab]             = useState('outbound');
  const [mainTab, setMainTab]           = useState('calls');
  const [playingVm, setPlayingVm]       = useState(null);
  const [lineFilter, setLineFilter]     = useState('all'); // 'all' | phone number
  const audioRef = useRef(null);

  // Drag & resize state
  const [pos, setPos]   = useState({ x: window.innerWidth - 580, y: 70 });
  const [size, setSize] = useState({ w: 560, h: Math.min(window.innerHeight * 0.85, 720) });
  const dragging  = useRef(false);
  const resizing  = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const resStart  = useRef({ mx: 0, my: 0, w: 0, h: 0 });
  const panelRef  = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      if (dragging.current) {
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - 200, dragStart.current.px + e.clientX - dragStart.current.mx)),
          y: Math.max(0, Math.min(window.innerHeight - 60, dragStart.current.py + e.clientY - dragStart.current.my)),
        });
      }
      if (resizing.current) {
        setSize({
          w: Math.max(400, resStart.current.w + e.clientX - resStart.current.mx),
          h: Math.max(300, resStart.current.h + e.clientY - resStart.current.my),
        });
      }
    };
    const onUp = () => { dragging.current = false; resizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  useEffect(() => {
    loadData();
    const poll = setInterval(loadCallLogs, 120000); // Was 30s — slowed to reduce API load
    return () => clearInterval(poll);
  }, []);

  const [listStart, setListStart] = useState(() => new Date().toISOString().slice(0,10));
  const [listEnd,   setListEnd]   = useState(() => new Date().toISOString().slice(0,10));

  const loadData = async () => {
    try {
      const [clData, linesData, leadsData] = await Promise.all([
        base44.entities.CallLog.list('-calledAt', 200),
        base44.functions.invoke('twilioGetLines', {}),
        base44.entities.Lead.list('-updated_date', 5000),
      ]);
      setCallLogs(clData || []);
      setLines(linesData?.data?.lines || linesData?.lines || []);
      setLeads(leadsData || []);
      const fetchedLines = linesData?.data?.lines || linesData?.lines || [];
      fetchedLines.forEach(l => { NUMBER_TO_AGENT[l.number] = l.label; });
    } catch(e) { console.error(e); }
    await loadOutbound(listStart, listEnd);
    setLoading(false);
  };

  const loadOutbound = async (start, end) => {
    try {
      const res = await base44.functions.invoke('twilioCallLogs', { startDate: start, endDate: end });
      const calls = (res.data?.calls || []).filter(c => c.direction !== 'inbound');
      setHistoryRows(calls);
    } catch(e) { console.error(e); }
  };

  const loadCallLogs = async () => {
    try {
      const data = await base44.entities.CallLog.list('-calledAt', 150);
      setCallLogs(data || []);
    } catch {}
  };

  const logs = callLogs;
  const inboundFiltered = callLogs.filter(l => l.direction === 'inbound');

  // Filter outbound by line
  const outboundFiltered = lineFilter === 'all'
    ? historyRows
    : historyRows.filter(c => c.from === lineFilter);

  const markVmListened = async (log) => {
    if (!log.vmListened) {
      await base44.entities.CallLog.update(log.id, { vmListened: true, dismissed: true }).catch(() => {});
      setCallLogs(prev => prev.map(l => l.id === log.id ? { ...l, vmListened: true, dismissed: true } : l));
    }
    setPlayingVm(log.id === playingVm ? null : log.id);
  };

  const dismissAll = async () => {
    const unread = callLogs.filter(l => !l.dismissed);
    await Promise.all(unread.map(l => base44.entities.CallLog.update(l.id, { dismissed: true }).catch(() => {})));
    setCallLogs(prev => prev.map(l => ({ ...l, dismissed: true })));
  };

  const unlistenedVm = callLogs.filter(l => l.vmRecordingUrl && !l.vmListened).length;
  const missedCount  = callLogs.filter(l => (l.status === 'missed' || l.status === 'no-answer') && !l.dismissed).length;

  // Look up lead name from phone number
  const getLeadForCall = (call) => {
    return leads.find(l =>
      l.phone === call.to || l.phone === call.from ||
      l.phone2 === call.to || l.phone2 === call.from
    );
  };

  // Determine agent (from number → line label)
  const getAgent = (fromNumber) => {
    if (!fromNumber) return '—';
    // Try exact match from loaded lines first
    const lineMatch = lines.find(l => l.number === fromNumber || fromNumber.endsWith(l.number?.slice(-4)));
    if (lineMatch?.label) return lineMatch.label;
    // Fallback: infer from last 4 digits via NUMBER_TO_AGENT map
    const mapLabel = NUMBER_TO_AGENT[fromNumber];
    if (mapLabel) return mapLabel;
    // Last resort: known endings
    if (fromNumber.endsWith('5680')) return 'Admin';
    if (fromNumber.endsWith('5681')) return 'Steph';
    if (fromNumber.endsWith('5682')) return 'Line 3';
    return fromNumber.slice(-4);
  };

  return (
    <>
      <style>{`
        @keyframes linePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }
      `}</style>
      <div ref={panelRef} style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 99990,
        width: size.w, height: size.h,
        background: DARK, border: `1px solid rgba(184,147,58,0.3)`,
        borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
        fontFamily: 'Georgia, serif', display: 'flex', flexDirection: 'column',
        userSelect: dragging.current || resizing.current ? 'none' : 'auto',
        minWidth: '400px', minHeight: '300px',
      }}>

        {/* ── Header (drag handle) ── */}
        <div
          onMouseDown={e => { if (e.target.closest('button')) return; dragging.current = true; dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }; e.preventDefault(); }}
          style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, cursor: 'move' }}>
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
              ? lines.map((line, i) => <LiveLineBar key={i} line={line} logs={callLogs} />)
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
            {/* Incoming / Outgoing Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
              {[['outbound','↗ Outgoing', outboundFiltered.length], ['inbound','↙ Incoming', inboundFiltered.length]].map(([dir, label, count]) => (
                <button key={dir} onClick={() => setDirTab(dir)}
                  style={{ flex: 1, background: 'none', border: 'none', borderBottom: dirTab === dir ? `2px solid ${dir === 'inbound' ? '#60a5fa' : '#a78bfa'}` : '2px solid transparent', color: dirTab === dir ? (dir === 'inbound' ? '#60a5fa' : '#a78bfa') : '#6b7280', padding: '8px', cursor: 'pointer', fontSize: '11px' }}>
                  {label} <span style={{ fontSize: '10px', opacity: 0.7 }}>({count})</span>
                </button>
              ))}
            </div>

            {/* Outbound filters row */}
            {dirTab === 'outbound' && (
              <div style={{ padding:'8px 14px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0, display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', flexShrink:0 }}>Range:</span>
                <input type="date" value={listStart} onChange={e => setListStart(e.target.value)}
                  style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'4px 8px', color:'#e8e0d0', fontSize:'11px', outline:'none', colorScheme:'dark' }} />
                <span style={{ color:'#4a5568', fontSize:'11px' }}>→</span>
                <input type="date" value={listEnd} onChange={e => setListEnd(e.target.value)}
                  style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'4px 8px', color:'#e8e0d0', fontSize:'11px', outline:'none', colorScheme:'dark' }} />
                <button onClick={() => { setLoading(true); loadOutbound(listStart, listEnd).then(() => setLoading(false)); }}
                  style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'4px 14px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }}>
                  Load
                </button>
                {/* Line/number filter */}
                <select value={lineFilter} onChange={e => setLineFilter(e.target.value)}
                  style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'4px 8px', color:'#e8e0d0', fontSize:'11px', outline:'none', colorScheme:'dark', cursor:'pointer', marginLeft:'auto' }}>
                  <option value="all">👥 All Agents</option>
                  {lines.map(l => (
                    <option key={l.number} value={l.number}>{l.label === 'Steph' ? '🟣' : '🟡'} {l.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Call List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {loading && <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Loading…</div>}

              {/* ── OUTBOUND: from Twilio API ── */}
              {!loading && dirTab === 'outbound' && (
                <>
                  {outboundFiltered.length === 0 && (
                    <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>No outgoing call records for this range.
                    </div>
                  )}
                  {outboundFiltered.map((c) => {
                    const connected = c.status === 'completed' && c.duration > 0;
                    const statusColor = c.status === 'completed' ? (c.duration > 0 ? '#4ade80' : '#8a9ab8') : c.status === 'busy' || c.status === 'no-answer' ? '#f59e0b' : c.status === 'failed' ? '#ef4444' : '#8a9ab8';
                    const matchedLead = getLeadForCall(c);
                    const agentLabel = getAgent(c.from);
                    const leadName = matchedLead ? `${matchedLead.firstName || ''} ${matchedLead.lastName || ''}`.trim() : null;
                    return (
                      <div key={c.sid} style={{
                        background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.06)`,
                        borderLeft: `3px solid ${statusColor}`, borderRadius: '6px', padding: '10px 12px', marginBottom: '6px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Lead name + phone */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                              <span style={{ fontSize: '13px' }}>{connected ? '📞' : '📵'}</span>
                              {leadName ? (
                                <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{leadName}</span>
                              ) : (
                                <span style={{ color: '#8a9ab8', fontSize: '12px', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.to}</span>
                              )}
                            </div>
                            {/* Phone + agent + SID */}
                            <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', alignItems:'center', marginBottom:'4px' }}>
                              <span style={{ color:'#4ade80', fontSize:'11px', fontFamily:'monospace' }}>{c.to}</span>
                              <span style={{ color:'#4a5568', fontSize:'9px' }}>·</span>
                              <span style={{ background: agentLabel === 'Steph' ? 'rgba(167,139,250,0.15)' : 'rgba(184,147,58,0.15)', color: agentLabel === 'Steph' ? '#a78bfa' : GOLD, border: `1px solid ${agentLabel === 'Steph' ? 'rgba(167,139,250,0.35)' : 'rgba(184,147,58,0.35)'}`, borderRadius:'3px', padding:'2px 8px', fontSize:'10px', fontWeight:'bold' }}>
                                {agentLabel === 'Steph' ? '🟣' : '🟡'} {agentLabel}
                              </span>
                              {c.duration > 0 && (
                                <span style={{ color: '#a78bfa', fontSize: '10px' }}>⏱ {formatDur(c.duration)}</span>
                              )}
                            </div>
                            {/* Convert buttons */}
                            <ConvertButtons call={c} leads={leads} onConverted={() => base44.entities.Lead.list('-updated_date', 5000).then(setLeads).catch(()=>{})} />
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ color: '#6b7280', fontSize: '10px', marginBottom: '2px' }}>
                              {c.startTime ? fmtDateTimeShort(c.startTime) : '—'}
                            </div>
                            <div style={{ display:'flex', gap:'4px', justifyContent:'flex-end', alignItems:'center' }}>
                              <span style={{ color: statusColor, fontSize: '10px' }}>{c.status}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* ── INBOUND: from CallLog entity ── */}
              {!loading && dirTab === 'inbound' && (
                <>
                  {inboundFiltered.length === 0 && (
                    <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>No incoming call records.
                    </div>
                  )}
                  {inboundFiltered.map((log) => {
                    const st = STATUS_COLORS[log.status] || STATUS_COLORS.ringing;
                    const isUnread = !log.dismissed && (log.status === 'missed' || log.status === 'no-answer' || (log.vmRecordingUrl && !log.vmListened));
                    const displayName = log.callerName || log.fromNumber || '—';
                    const isPlayingThis = playingVm === log.id;
                    return (
                      <div key={log.id} style={{
                        background: isUnread ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)',
                        border: `1px solid ${isUnread ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
                        borderLeft: `3px solid ${st.color}`, borderRadius: '6px', padding: '10px 12px', marginBottom: '6px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                              <span style={{ fontSize: '13px' }}>{st.icon}</span>
                              <span style={{ color: isUnread ? '#e8e0d0' : '#c4cdd8', fontSize: '13px', fontWeight: isUnread ? 'bold' : 'normal' }}>{displayName}</span>
                              {!log.dismissed && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0, display: 'inline-block' }} />}
                            </div>
                            <div style={{ color: '#60a5fa', fontSize: '11px', fontFamily: 'monospace' }}>{log.fromNumber || '—'}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ color: '#6b7280', fontSize: '10px', marginBottom: '2px' }}>{fmtDateTime(log.calledAt)}</div>
                            <div style={{ display:'flex', gap:'4px', justifyContent:'flex-end' }}>
                              <span style={{ background: st.bg, color: st.color, padding: '1px 6px', borderRadius: '3px', fontSize: '10px' }}>{log.status}</span>
                              {log.durationSeconds > 0 && <span style={{ color: '#6b7280', fontSize: '10px' }}>⏱ {formatDur(log.durationSeconds)}</span>}
                            </div>
                          </div>
                        </div>
                        {log.vmRecordingUrl && (
                          <div style={{ marginTop: '8px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', padding: '7px 10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 'bold' }}>📩 Voicemail {!log.vmListened && '· NEW'}</span>
                              <button onClick={() => markVmListened(log)} style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px' }}>
                                {isPlayingThis ? '⏹ Close' : '▶ Play'}
                              </button>
                            </div>
                            {log.vmTranscription && <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5, fontStyle: 'italic', marginTop: '4px' }}>"{log.vmTranscription.slice(0,200)}{log.vmTranscription.length>200?'…':''}"</div>}
                            {isPlayingThis && <audio ref={audioRef} src={log.vmRecordingUrl} controls autoPlay style={{ width: '100%', marginTop: '6px', height: '32px' }} />}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                          {log.leadId && onOpenLead && <button onClick={() => onOpenLead(log.leadId)} style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px' }}>📋 Open Lead</button>}
                          {!log.dismissed && <button onClick={async () => { await base44.entities.CallLog.update(log.id, { dismissed: true }).catch(() => {}); setCallLogs(prev => prev.map(l => l.id === log.id ? { ...l, dismissed: true } : l)); }} style={{ background: 'rgba(255,255,255,0.04)', color: '#4a5568', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '10px' }}>✓ Dismiss</button>}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </>
        )}

        {/* ── Resize handle ── */}
        <div
          onMouseDown={e => { resizing.current = true; resStart.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h }; e.preventDefault(); e.stopPropagation(); }}
          style={{ position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', cursor: 'se-resize', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '4px' }}
        >
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
            <path d="M2 9L9 2M5 9L9 5M9 9L9 9" stroke="rgba(184,147,58,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </>
  );
}