import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { fmtDateTime, fmtDate, fmtDateTimeShort } from '@/lib/fmtDate.js';

const DEFAULT_VM_GREETING = "Hi, you've reached Newport Beach Tech Acquisitions. We're unavailable right now. Please leave your message after the beep and we'll call you back shortly.";
const GOLD = '#b8933a';
const DARK = '#080f1c';
const NUMBER_TO_AGENT = {};

function formatDur(sec) {
  if (!sec || sec < 1) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
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

// ── Voicemail Settings Tab ───────────────────────────────────────────────────
// Also syncs vmAudioUrl/vmGreeting to env-readable format for the webhook.
function VoicemailSettingsTab() {
  const [greetingMode, setGreetingMode] = useState('text');
  const [greeting, setGreeting]         = useState('');
  const [vmAudioUrl, setVmAudioUrl]     = useState('');
  const [saving, setSaving]             = useState(false);
  const [msg, setMsg]                   = useState('');
  const [settingsId, setSettingsId]     = useState(null);
  const [recording, setRecording]       = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob]       = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('');
  const [uploading, setUploading]       = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const timerRef         = useRef(null);

  useEffect(() => {
    base44.entities.PortalSettings.filter({ key: 'main' }).then(rows => {
      if (rows?.[0]) {
        setSettingsId(rows[0].id);
        setGreeting(rows[0].vmGreeting || '');
        if (rows[0].vmAudioUrl) { setVmAudioUrl(rows[0].vmAudioUrl); setGreetingMode('recording'); }
      }
    }).catch(() => {});
  }, []);

  const startRecording = async () => {
    chunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setAudioBlob(blob);
      setAudioPreviewUrl(URL.createObjectURL(blob));
    };
    mr.start();
    setRecording(true); setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
  };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); clearInterval(timerRef.current); setRecording(false); };
  const uploadRecording = async () => {
    if (!audioBlob) return;
    setUploading(true); setMsg('');
    try {
      const file = new File([audioBlob], 'vm-greeting.webm', { type: 'audio/webm' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setVmAudioUrl(file_url);
      setMsg('✅ Recording uploaded — click Save to apply.');
    } catch (e) { setMsg('❌ Upload failed: ' + e.message); }
    setUploading(false);
    setTimeout(() => setMsg(''), 5000);
  };

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const updates = greetingMode === 'recording'
        ? { vmAudioUrl, vmGreeting: '' }
        : { vmGreeting: greeting, vmAudioUrl: '' };
      if (settingsId) {
        await base44.entities.PortalSettings.update(settingsId, updates);
      } else {
        const created = await base44.entities.PortalSettings.create({ key: 'main', ...updates });
        setSettingsId(created.id);
      }
      setMsg('✅ Saved. ⚠️ Also update VM_AUDIO_URL or VM_GREETING_TEXT env vars in Base44 to apply to inbound calls.');
    } catch (e) { setMsg('❌ ' + e.message); }
    setSaving(false);
    setTimeout(() => setMsg(''), 6000);
  };

  const fmtTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const btn = (active, onClick, children, extra={}) => (
    <button onClick={onClick} style={{ flex:1, padding:'7px', background: active ? `${GOLD}22` : 'rgba(255,255,255,0.04)', border:`1px solid ${active ? GOLD+'66' : 'rgba(255,255,255,0.1)'}`, color: active ? GOLD : '#6b7280', borderRadius:'4px', cursor:'pointer', fontSize:'11px', fontWeight: active ? 'bold' : 'normal', ...extra }}>{children}</button>
  );

  return (
    <div style={{ padding:'16px', overflowY:'auto', flex:1 }}>
      <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>⚙️ Voicemail Greeting</div>
      <div style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'4px', padding:'10px 12px', marginBottom:'14px', fontSize:'11px', color:'#8a9ab8', display:'flex', gap:'8px' }}>
        <span>ℹ️</span>
        <div>Inbound calls ring for <strong style={{ color:'#f59e0b' }}>~4 rings (20s)</strong>, then go to voicemail. After saving here, also update <code style={{ background:'rgba(255,255,255,0.06)', padding:'1px 5px', borderRadius:'3px' }}>VM_AUDIO_URL</code> or <code style={{ background:'rgba(255,255,255,0.06)', padding:'1px 5px', borderRadius:'3px' }}>VM_GREETING_TEXT</code> env vars in Base44 for the change to take effect on inbound calls.</div>
      </div>
      <div style={{ display:'flex', gap:'6px', marginBottom:'14px' }}>
        {btn(greetingMode==='text', ()=>setGreetingMode('text'), '✏️ Text-to-Speech')}
        {btn(greetingMode==='recording', ()=>setGreetingMode('recording'), '🎙 Voice Recording')}
      </div>
      {greetingMode === 'text' && (
        <>
          <label style={{ display:'block', color:'#8a9ab8', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'5px' }}>Greeting Text</label>
          <textarea value={greeting} onChange={e=>setGreeting(e.target.value)} placeholder={DEFAULT_VM_GREETING} rows={4}
            style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'8px 10px', color:'#e8e0d0', fontSize:'12px', outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'Georgia, serif', lineHeight:1.5 }} />
          <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'8px 10px', margin:'10px 0' }}>
            <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Preview</div>
            <div style={{ color:'#c4cdd8', fontSize:'11px', fontStyle:'italic', lineHeight:1.5 }}>"{greeting || DEFAULT_VM_GREETING}"</div>
          </div>
        </>
      )}
      {greetingMode === 'recording' && (
        <div style={{ marginBottom:'12px' }}>
          <label style={{ display:'block', color:'#8a9ab8', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>Record Your Greeting</label>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
            {!recording ? (
              <button onClick={startRecording} style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.4)', borderRadius:'50%', width:'44px', height:'44px', cursor:'pointer', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center' }}>🎙</button>
            ) : (
              <button onClick={stopRecording} style={{ background:'rgba(239,68,68,0.25)', color:'#ef4444', border:'2px solid #ef4444', borderRadius:'50%', width:'44px', height:'44px', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center' }}>⏹</button>
            )}
            {recording && <><div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#ef4444' }} /><span style={{ color:'#ef4444', fontFamily:'monospace', fontSize:'14px', fontWeight:'bold' }}>{fmtTime(recordingTime)}</span></>}
            {!recording && !audioBlob && <span style={{ color:'#6b7280', fontSize:'11px' }}>Click 🎙 to record</span>}
          </div>
          {audioPreviewUrl && !recording && (
            <div style={{ background:'rgba(74,222,128,0.06)', border:'1px solid rgba(74,222,128,0.2)', borderRadius:'4px', padding:'10px 12px', marginBottom:'10px' }}>
              <div style={{ color:'#4ade80', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'6px' }}>New Recording</div>
              <audio src={audioPreviewUrl} controls style={{ width:'100%', height:'32px' }} />
              <button onClick={uploadRecording} disabled={uploading} style={{ marginTop:'8px', background:'rgba(74,222,128,0.2)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.4)', borderRadius:'4px', padding:'5px 16px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
                {uploading ? '⏳ Uploading…' : '⬆ Use This Recording'}
              </button>
            </div>
          )}
          {vmAudioUrl && (
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'10px 12px', marginBottom:'10px' }}>
              <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Current Saved Greeting</div>
              <audio src={vmAudioUrl} controls style={{ width:'100%', height:'32px' }} />
              <button onClick={()=>{ setVmAudioUrl(''); setAudioBlob(null); setAudioPreviewUrl(''); }} style={{ marginTop:'6px', background:'none', color:'#ef4444', border:'none', cursor:'pointer', fontSize:'10px' }}>🗑 Remove</button>
            </div>
          )}
        </div>
      )}
      <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
        <button onClick={save} disabled={saving || (greetingMode==='recording' && !vmAudioUrl)}
          style={{ background: (saving||(greetingMode==='recording'&&!vmAudioUrl)) ? 'rgba(184,147,58,0.3)' : 'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'7px 20px', cursor:'pointer', fontWeight:'bold', fontSize:'11px' }}>
          {saving ? 'Saving…' : '💾 Save Greeting'}
        </button>
        {msg && <span style={{ fontSize:'11px', color: msg.startsWith('✅') ? '#4ade80' : '#f59e0b', flex:1 }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── Voicemail List Tab ───────────────────────────────────────────────────────
function VoicemailListTab({ callLogs, onMarkListened, onOpenLead, onOpenInvestor, playingVm, setPlayingVm, audioRef }) {
  const voicemails = callLogs.filter(l => l.vmRecordingUrl).sort((a,b)=>new Date(b.calledAt)-new Date(a.calledAt));
  if (voicemails.length === 0) {
    return <div style={{ color:'#4a5568', textAlign:'center', padding:'40px', fontSize:'12px' }}><div style={{ fontSize:'32px', marginBottom:'8px' }}>📩</div>No voicemails yet.</div>;
  }
  return (
    <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
      {voicemails.map(log => {
        const isNew = !log.vmListened;
        const isPlayingThis = playingVm === log.id;
        return (
          <div key={log.id} style={{ background: isNew ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.02)', border:`1px solid ${isNew ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`, borderLeft:`3px solid ${isNew ? '#f59e0b' : '#4a5568'}`, borderRadius:'6px', padding:'10px 12px', marginBottom:'6px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'3px' }}>
                  <span>📩</span>
                  <span style={{ color: isNew ? '#e8e0d0' : '#c4cdd8', fontSize:'13px', fontWeight: isNew ? 'bold' : 'normal', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {log.callerName || log.fromNumber || 'Unknown Caller'}
                  </span>
                  {isNew && <span style={{ background:'rgba(245,158,11,0.2)', color:'#f59e0b', fontSize:'9px', padding:'1px 6px', borderRadius:'8px', fontWeight:'bold', flexShrink:0 }}>NEW</span>}
                </div>
                <div style={{ color:'#60a5fa', fontSize:'11px', fontFamily:'monospace' }}>{log.fromNumber}</div>
                {log.vmTranscription && (
                  <div style={{ color:'#8a9ab8', fontSize:'11px', lineHeight:1.5, fontStyle:'italic', marginTop:'5px' }}>
                    "{log.vmTranscription.slice(0,200)}{log.vmTranscription.length>200?'…':''}"
                  </div>
                )}
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ color:'#6b7280', fontSize:'10px', marginBottom:'4px' }}>{fmtDateTime(log.calledAt)}</div>
                <button onClick={() => onMarkListened(log)}
                  style={{ background: isPlayingThis ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: isPlayingThis ? '#ef4444' : '#f59e0b', border:`1px solid ${isPlayingThis ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'}`, borderRadius:'4px', padding:'3px 10px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }}>
                  {isPlayingThis ? '⏹ Close' : '▶ Play'}
                </button>
              </div>
            </div>
            {isPlayingThis && <audio ref={audioRef} src={log.vmRecordingUrl} controls autoPlay style={{ width:'100%', marginTop:'8px', height:'32px' }} />}
            <div style={{ display:'flex', gap:'6px', marginTop:'8px', flexWrap:'wrap' }}>
              {log.leadId && onOpenLead && (
                <button onClick={() => onOpenLead(log.leadId)} style={{ background:'rgba(167,139,250,0.1)', color:'#a78bfa', border:'1px solid rgba(167,139,250,0.25)', borderRadius:'4px', padding:'3px 10px', cursor:'pointer', fontSize:'10px' }}>📋 Open Lead Card</button>
              )}
              {log.investorId && onOpenInvestor && (
                <button onClick={() => onOpenInvestor(log.investorId)} style={{ background:'rgba(184,147,58,0.1)', color:GOLD, border:'1px solid rgba(184,147,58,0.25)', borderRadius:'4px', padding:'3px 10px', cursor:'pointer', fontSize:'10px' }}>👤 Open Investor Card</button>
              )}
              {!log.vmListened && (
                <button onClick={() => onMarkListened(log, true)} style={{ background:'rgba(255,255,255,0.04)', color:'#4a5568', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'3px 10px', cursor:'pointer', fontSize:'10px' }}>✓ Mark Read</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
    update(); const id = setInterval(update, 1000); return () => clearInterval(id);
  }, [isActive, callStart?.getTime()]);
  const displayName = activeLog?.callerName || (activeLog?.direction === 'inbound' ? activeLog?.fromNumber : activeLog?.toNumber) || '';
  const barColor = isActive ? '#4ade80' : '#ef4444';
  const barBg    = isActive ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.06)';
  const barBorder= isActive ? 'rgba(74,222,128,0.3)'  : 'rgba(239,68,68,0.2)';
  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', background:barBg, border:`1px solid ${barBorder}`, borderRadius:'6px', padding:'7px 12px', transition:'all 0.3s' }}>
      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:barColor, boxShadow:isActive?`0 0 8px ${barColor}`:'none', flexShrink:0, animation:isActive?'linePulse 1.2s ease-in-out infinite':'none' }} />
      <div style={{ color:barColor, fontSize:'11px', fontWeight:'bold', flexShrink:0 }}>{line.label}</div>
      <div style={{ color:'#4a5568', fontSize:'10px', fontFamily:'monospace', flexShrink:0 }}>{line.number}</div>
      {isActive ? (
        <div style={{ flex:1, display:'flex', gap:'8px', alignItems:'center', minWidth:0 }}>
          <span style={{ color:'#e8e0d0', fontSize:'11px', fontWeight:'bold', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayName || 'Active Call'}</span>
          <span style={{ marginLeft:'auto', color:'#4ade80', fontSize:'13px', fontFamily:'monospace', fontWeight:'bold', flexShrink:0 }}>{fmt(elapsed)}</span>
        </div>
      ) : (
        <div style={{ flex:1, color:'#4a5568', fontSize:'11px' }}>Idle</div>
      )}
    </div>
  );
}

// ── Reports Tab ──────────────────────────────────────────────────────────────
function ReportsTab({ lines }) {
  const [mode, setMode]               = useState('day');
  const [date, setDate]               = useState(() => new Date().toISOString().slice(0,10));
  const [year, setYear]               = useState(() => new Date().getFullYear());
  const [agentFilter, setAgentFilter] = useState('all');
  const [report, setReport]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);

  const generate = async () => {
    setLoading(true);
    try {
      const startDate = mode === 'year' ? `${year}-01-01` : date;
      const endDate   = mode === 'year' ? `${year}-12-31` : date;
      const [callRes, leadsData] = await Promise.all([
        base44.functions.invoke('twilioCallLogs', { startDate, endDate }),
        base44.entities.Lead.list('-updated_date', 5000),
      ]);
      const allCalls = (callRes.data?.calls || []).filter(c => c.direction !== 'inbound');
      const filtered = agentFilter === 'all' ? allCalls : allCalls.filter(c => c.from === agentFilter);
      const agentLabel = agentFilter === 'all' ? 'All Agents' : (lines.find(l => l.number === agentFilter)?.label || agentFilter);
      const totalCalls = filtered.length;
      const answered   = filtered.filter(c => c.status === 'completed' && c.duration > 0);
      const answeredCount   = answered.length;
      const connectionRate  = totalCalls > 0 ? ((answeredCount / totalCalls) * 100).toFixed(1) : '0.0';
      const totalDial       = filtered.reduce((s, c) => s + (c.duration || 0), 0);
      const avgDial         = answeredCount > 0 ? Math.round(totalDial / answeredCount) : 0;
      const longestCall     = filtered.reduce((max, c) => Math.max(max, c.duration || 0), 0);
      const start = new Date(startDate + 'T00:00:00'), end = new Date(endDate + 'T23:59:59');
      const converted = (leadsData || []).filter(l => {
        const u = new Date(l.updated_date || 0);
        if (u < start || u > end) return false;
        if (agentFilter !== 'all') { if (l.leadPipelineOwner !== agentLabel.toLowerCase()) return false; }
        return l.status === 'prospect' || l.leadType === 'nb_tech';
      });
      setReport({ totalCalls, answeredCount, connectionRate, totalDial, avgDial, longestCall,
        convertedTotal: converted.length,
        convertedProspect: converted.filter(l=>l.status==='prospect').length,
        convertedNBTech:   converted.filter(l=>l.leadType==='nb_tech').length,
        date, year, mode, agentLabel });
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const inp = { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'8px 12px', color:'#e8e0d0', fontSize:'12px', outline:'none', fontFamily:'Georgia, serif', colorScheme:'dark' };
  const stat = (label, value, color='#e8e0d0') => (
    <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'6px', padding:'14px 16px', textAlign:'center' }}>
      <div style={{ color, fontSize:'22px', fontWeight:'bold', lineHeight:1.1 }}>{value}</div>
      <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase', marginTop:'4px' }}>{label}</div>
    </div>
  );

  return (
    <div style={{ padding:'16px' }}>
      <div style={{ display:'flex', gap:'6px', marginBottom:'14px' }}>
        {[['day','📅 Day'], ['year','📆 Year']].map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); setReport(null); }}
            style={{ background: mode===m?`${GOLD}22`:'rgba(255,255,255,0.04)', border:`1px solid ${mode===m?GOLD+'66':'rgba(255,255,255,0.1)'}`, color: mode===m?GOLD:'#6b7280', borderRadius:'20px', padding:'4px 14px', cursor:'pointer', fontSize:'11px', fontWeight: mode===m?'bold':'normal' }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ display:'flex', gap:'10px', alignItems:'flex-end', marginBottom:'18px', flexWrap:'wrap' }}>
        {mode === 'day'
          ? <div><div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'1px', marginBottom:'5px' }}>DATE</div><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ ...inp, cursor:'pointer' }} /></div>
          : <div><div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'1px', marginBottom:'5px' }}>YEAR</div><select value={year} onChange={e=>setYear(Number(e.target.value))} style={{ ...inp, cursor:'pointer' }}>{years.map(y=><option key={y} value={y}>{y}</option>)}<option value={currentYear}>{currentYear}</option></select></div>
        }
        <div>
          <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'1px', marginBottom:'5px' }}>AGENT</div>
          <select value={agentFilter} onChange={e=>{ setAgentFilter(e.target.value); setReport(null); }} style={{ ...inp, cursor:'pointer' }}>
            <option value="all">👥 All Agents</option>
            {lines.map(l => <option key={l.number} value={l.number}>{l.label==='Steph'?'🟣':'🟡'} {l.label}</option>)}
          </select>
        </div>
        <button onClick={generate} disabled={loading} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'9px 22px', cursor:'pointer', fontWeight:'700', fontSize:'11px', letterSpacing:'1.5px', textTransform:'uppercase', alignSelf:'flex-end' }}>
          {loading ? 'Generating…' : '▶ Generate'}
        </button>
      </div>
      {report && (
        <div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center', marginBottom:'12px', flexWrap:'wrap' }}>
            <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase' }}>
              {report.mode==='year'?`Report for ${report.year}`:`Report for ${fmtDate(report.date+'T12:00:00')}`}
            </div>
            <span style={{ background: report.agentLabel==='Steph'?'rgba(167,139,250,0.15)':'rgba(184,147,58,0.15)', color: report.agentLabel==='Steph'?'#a78bfa':GOLD, border:`1px solid ${report.agentLabel==='Steph'?'rgba(167,139,250,0.35)':'rgba(184,147,58,0.35)'}`, borderRadius:'10px', padding:'2px 10px', fontSize:'10px', fontWeight:'bold' }}>
              {report.agentLabel==='Steph'?'🟣':'🟡'} {report.agentLabel}
            </span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'8px' }}>
            {stat('Total Calls', report.totalCalls, GOLD)}
            {stat('Connected', report.answeredCount, '#4ade80')}
            {stat('Connection Rate', report.connectionRate+'%', '#60a5fa')}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'8px' }}>
            {stat('Total Dial Time', formatDur(report.totalDial), '#a78bfa')}
            {stat('Avg Call Length', formatDur(report.avgDial), '#f59e0b')}
            {stat('Longest Call', formatDur(report.longestCall), '#60a5fa')}
          </div>
          <div style={{ marginTop:'4px' }}>
            <div style={{ color:'#4ade80', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>📈 Conversions</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
              {stat('Total Converted', report.convertedTotal, '#4ade80')}
              {stat('→ Prospect', report.convertedProspect, '#a78bfa')}
              {stat('→ NB Tech', report.convertedNBTech, '#818cf8')}
            </div>
          </div>
        </div>
      )}
      {!report && !loading && <div style={{ color:'#4a5568', textAlign:'center', padding:'40px', fontSize:'12px' }}>Select a date range and click Generate.</div>}
    </div>
  );
}

// ── Normalize phone to last 10 digits for comparison ────────────────────────
function normalizePhone(p) {
  if (!p) return '';
  const digits = p.replace(/\D/g, '');
  return digits.slice(-10);
}

// ── Call Row (shared by inbound + outbound) ───────────────────────────────────
function CallRow({ log, isOutbound, leads, lines, onOpenLead, onOpenInvestor, onMarkVm, playingVm, setPlayingVm, audioRef }) {
  const [converting, setConverting] = useState(false);
  const [converted, setConverted]   = useState(null);

  // For outbound: log.to is the dialed number, log.from is agent's number
  // For inbound: log.fromNumber is caller, log.toNumber is our number
  const phone = isOutbound ? log.to : log.fromNumber;
  const phoneNorm = normalizePhone(phone);

  const agent = isOutbound ? (() => {
    if (!log.from) return '—';
    // Exact match first
    const lineMatch = lines.find(l => l.number && (
      l.number === log.from ||
      normalizePhone(l.number) === normalizePhone(log.from)
    ));
    if (lineMatch?.label) return lineMatch.label;
    // NUMBER_TO_AGENT map
    const m = NUMBER_TO_AGENT[log.from];
    if (m) return m;
    // Known last-4 fallbacks
    const last4 = log.from.slice(-4);
    if (last4 === '5680') return 'Admin';
    if (last4 === '5681') return 'Steph';
    if (last4 === '5682') return 'Line 3';
    return last4;
  })() : null;

  // Match lead by normalizing phone numbers — fixes "Robert Nalley on every row" bug
  const matchedLead = phoneNorm
    ? leads.find(l => {
        const lp  = normalizePhone(l.phone);
        const lp2 = normalizePhone(l.phone2);
        return (lp && lp === phoneNorm) || (lp2 && lp2 === phoneNorm);
      })
    : null;

  const leadName = matchedLead
    ? `${matchedLead.firstName || ''} ${matchedLead.lastName || ''}`.trim()
    : '';

  // Fix operator-precedence bug: was (log.callerName || matchedLead) ? ...
  const displayName = isOutbound
    ? (leadName || log.to || '—')
    : (log.callerName || leadName || log.fromNumber || '—');

  const isNameResolved = !!leadName || (isOutbound ? false : !!log.callerName);

  const connected  = isOutbound ? (log.status === 'completed' && log.duration > 0) : (log.status === 'completed' || log.status === 'answered');
  const statusColor = isOutbound
    ? (log.status==='completed'?(log.duration>0?'#4ade80':'#8a9ab8'):log.status==='busy'||log.status==='no-answer'?'#f59e0b':log.status==='failed'?'#ef4444':'#8a9ab8')
    : ((STATUS_COLORS[log.status]||STATUS_COLORS.ringing).color);
  const icon = isOutbound ? (connected?'📞':'📵') : (STATUS_COLORS[log.status]||STATUS_COLORS.ringing).icon;

  const isUnread = !isOutbound && !log.dismissed && (log.status==='missed'||log.status==='no-answer'||(log.vmRecordingUrl&&!log.vmListened));
  const isPlayingThis = !isOutbound && playingVm === log.id;

  const convertLead = async (type) => {
    if (!matchedLead) return;
    setConverting(true);
    try {
      if (type === 'prospect') {
        await base44.entities.Lead.update(matchedLead.id, { status:'prospect', leadPipelineStage:'reviewing' });
        await base44.entities.LeadHistory.create({ leadId:matchedLead.id, type:'prospect', content:'Converted to Prospect from Call Log', createdBy:'admin' });
      } else {
        await base44.entities.Lead.update(matchedLead.id, { leadType:'nb_tech', leadPipelineStage: matchedLead.leadPipelineStage||'reviewing' });
        await base44.entities.LeadHistory.create({ leadId:matchedLead.id, type:'note', content:'💡 Converted to NB Tech from Call Log', createdBy:'admin' });
      }
      setConverted(type);
    } catch(e) { console.error(e); }
    setConverting(false);
  };

  const openCard = () => {
    const lid = isOutbound ? matchedLead?.id : (log.leadId || matchedLead?.id);
    const iid = !isOutbound && log.investorId;
    if (lid && onOpenLead) onOpenLead(lid);
    else if (iid && onOpenInvestor) onOpenInvestor(iid);
  };
  const hasCard = isOutbound
    ? !!matchedLead
    : !!(log.leadId || matchedLead?.id || log.investorId);

  return (
    <div style={{ background: isUnread?'rgba(255,255,255,0.04)':'rgba(255,255,255,0.015)', border:`1px solid ${isUnread?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.05)'}`, borderLeft:`3px solid ${statusColor}`, borderRadius:'6px', padding:'10px 12px', marginBottom:'6px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
        <div style={{ flex:1, minWidth:0 }}>
          {/* Name row — clickable if we have a card */}
          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'3px' }}>
            <span style={{ fontSize:'13px' }}>{icon}</span>
            <span
              onClick={hasCard ? openCard : undefined}
              style={{ color: isUnread?'#e8e0d0':'#c4cdd8', fontSize:'13px', fontWeight: isUnread||isNameResolved?'bold':'normal', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor: hasCard?'pointer':'default', textDecoration: hasCard?'underline':'none', textDecorationColor:'rgba(184,147,58,0.5)' }}
              title={hasCard ? 'Open contact card' : undefined}
            >
              {displayName}
            </span>
            {!isOutbound && !log.dismissed && <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#ef4444', flexShrink:0, display:'inline-block' }} />}
          </div>
          {/* Phone + agent badge */}
          <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', alignItems:'center', marginBottom:'4px' }}>
            <span style={{ color:'#60a5fa', fontSize:'11px', fontFamily:'monospace' }}>{phone}</span>
            {agent && (
              <><span style={{ color:'#4a5568', fontSize:'9px' }}>·</span>
              <span style={{ background: agent==='Steph'?'rgba(167,139,250,0.15)':'rgba(184,147,58,0.15)', color: agent==='Steph'?'#a78bfa':GOLD, border:`1px solid ${agent==='Steph'?'rgba(167,139,250,0.35)':'rgba(184,147,58,0.35)'}`, borderRadius:'3px', padding:'2px 8px', fontSize:'10px', fontWeight:'bold' }}>
                {agent==='Steph'?'🟣':'🟡'} {agent}
              </span></>
            )}
            {(isOutbound ? log.duration > 0 : log.durationSeconds > 0) && (
              <span style={{ color:'#a78bfa', fontSize:'10px' }}>⏱ {formatDur(isOutbound ? log.duration : log.durationSeconds)}</span>
            )}
          </div>
          {/* Convert buttons for outbound */}
          {isOutbound && matchedLead && matchedLead.status !== 'not_interested' && !converted && (
            <div style={{ display:'flex', gap:'4px', alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ color:'#4a5568', fontSize:'9px' }}>Convert:</span>
              {matchedLead.status !== 'prospect' && (
                <button onClick={()=>convertLead('prospect')} disabled={converting}
                  style={{ background:'rgba(74,222,128,0.12)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'4px', padding:'2px 8px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }}>✅ Prospect</button>
              )}
              {matchedLead.leadType !== 'nb_tech' && (
                <button onClick={()=>convertLead('nb_tech')} disabled={converting}
                  style={{ background:'rgba(99,102,241,0.12)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'4px', padding:'2px 8px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }}>💡 NB Tech</button>
              )}
            </div>
          )}
          {converted && <span style={{ color:'#4ade80', fontSize:'10px' }}>✅ Converted to {converted==='prospect'?'Prospect':'NB Tech'}</span>}
        </div>
        {/* Timestamp + status */}
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ color:'#6b7280', fontSize:'10px', marginBottom:'2px' }}>
            {isOutbound ? (log.startTime ? fmtDateTimeShort(log.startTime) : '—') : fmtDateTime(log.calledAt)}
          </div>
          <span style={{ background: isOutbound?'transparent':(STATUS_COLORS[log.status]||STATUS_COLORS.ringing).bg, color:statusColor, padding:'1px 6px', borderRadius:'3px', fontSize:'10px' }}>
            {isOutbound ? log.status : log.status}
          </span>
        </div>
      </div>

      {/* Voicemail player (inbound) */}
      {!isOutbound && log.vmRecordingUrl && (
        <div style={{ marginTop:'8px', background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'4px', padding:'7px 10px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:'#f59e0b', fontSize:'11px', fontWeight:'bold' }}>📩 Voicemail {!log.vmListened&&'· NEW'}</span>
            <button onClick={() => onMarkVm(log)}
              style={{ background:'rgba(245,158,11,0.15)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.35)', borderRadius:'4px', padding:'3px 10px', cursor:'pointer', fontSize:'10px' }}>
              {isPlayingThis ? '⏹ Close' : '▶ Play'}
            </button>
          </div>
          {log.vmTranscription && <div style={{ color:'#8a9ab8', fontSize:'11px', lineHeight:1.5, fontStyle:'italic', marginTop:'4px' }}>"{log.vmTranscription.slice(0,200)}{log.vmTranscription.length>200?'…':''}"</div>}
          {isPlayingThis && <audio ref={audioRef} src={log.vmRecordingUrl} controls autoPlay style={{ width:'100%', marginTop:'6px', height:'32px' }} />}
        </div>
      )}

      {/* Action buttons (inbound) */}
      {!isOutbound && (
        <div style={{ display:'flex', gap:'6px', marginTop:'6px', flexWrap:'wrap' }}>
          {hasCard && (
            <button onClick={openCard}
              style={{ background:'rgba(167,139,250,0.1)', color:'#a78bfa', border:'1px solid rgba(167,139,250,0.25)', borderRadius:'4px', padding:'3px 10px', cursor:'pointer', fontSize:'10px' }}>
              {log.investorId ? '👤 Open Investor' : '📋 Open Lead'}
            </button>
          )}
          {!log.dismissed && (
            <button onClick={async()=>{ await base44.entities.CallLog.update(log.id,{dismissed:true}).catch(()=>{}); }}
              style={{ background:'rgba(255,255,255,0.04)', color:'#4a5568', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'3px 10px', cursor:'pointer', fontSize:'10px' }}>✓ Dismiss</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────
export default function CallLogPanel({ onClose, onOpenLead, onOpenInvestor }) {
  const [callLogs, setCallLogs]       = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [lines, setLines]             = useState([]);
  const [leads, setLeads]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [dirTab, setDirTab]           = useState('inbound');
  const [mainTab, setMainTab]         = useState('calls');
  const [vmSubTab, setVmSubTab]       = useState('list'); // 'list' | 'settings'
  const [playingVm, setPlayingVm]     = useState(null);
  const [lineFilter, setLineFilter]   = useState('all');
  const [listStart, setListStart]     = useState(() => new Date().toISOString().slice(0,10));
  const [listEnd,   setListEnd]       = useState(() => new Date().toISOString().slice(0,10));
  const audioRef = useRef(null);

  // Drag & resize
  const [pos, setPos]   = useState({ x: Math.max(0, window.innerWidth - 580), y: 70 });
  const [size, setSize] = useState({ w: 560, h: Math.min(window.innerHeight * 0.85, 720) });
  const dragging  = useRef(false), resizing  = useRef(false);
  const dragStart = useRef({ mx:0, my:0, px:0, py:0 });
  const resStart  = useRef({ mx:0, my:0, w:0, h:0 });
  const panelRef  = useRef(null);

  useEffect(() => {
    const onMove = e => {
      if (dragging.current) setPos({ x:Math.max(0,Math.min(window.innerWidth-200,dragStart.current.px+e.clientX-dragStart.current.mx)), y:Math.max(0,Math.min(window.innerHeight-60,dragStart.current.py+e.clientY-dragStart.current.my)) });
      if (resizing.current) setSize({ w:Math.max(420,resStart.current.w+e.clientX-resStart.current.mx), h:Math.max(320,resStart.current.h+e.clientY-resStart.current.my) });
    };
    const onUp = () => { dragging.current=false; resizing.current=false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  useEffect(() => {
    loadData();
    const poll = setInterval(loadCallLogs, 60000);
    return () => clearInterval(poll);
  }, []);

  const loadData = async () => {
    try {
      const [clData, linesData, leadsData] = await Promise.all([
        base44.entities.CallLog.list('-calledAt', 200),
        base44.functions.invoke('twilioGetLines', {}),
        base44.entities.Lead.list('-updated_date', 5000),
      ]);
      const fetchedLines = linesData?.data?.lines || linesData?.lines || [];
      fetchedLines.forEach(l => { NUMBER_TO_AGENT[l.number] = l.label; });
      setCallLogs(clData || []);
      setLines(fetchedLines);
      setLeads(leadsData || []);
    } catch(e) { console.error(e); }
    await loadOutbound(listStart, listEnd);
    setLoading(false);
  };

  const loadOutbound = async (start, end) => {
    try {
      const res = await base44.functions.invoke('twilioCallLogs', { startDate: start, endDate: end });
      const calls = (res.data?.calls || []).filter(c =>
        c.direction !== 'inbound' &&
        // Filter out internal browser client calls — these are not real outbound calls
        !c.to?.startsWith('client:') &&
        !c.to?.startsWith('sip:')
      );
      setHistoryRows(calls);
    } catch(e) { console.error(e); }
  };

  const loadCallLogs = async () => {
    try { setCallLogs(await base44.entities.CallLog.list('-calledAt', 200) || []); } catch {}
  };

  const markVmListened = async (log, justMark = false) => {
    if (!log.vmListened) {
      await base44.entities.CallLog.update(log.id, { vmListened: true, dismissed: true }).catch(() => {});
      setCallLogs(prev => prev.map(l => l.id===log.id ? {...l, vmListened:true, dismissed:true} : l));
    }
    if (!justMark) setPlayingVm(log.id === playingVm ? null : log.id);
  };

  const dismissAll = async () => {
    const unread = callLogs.filter(l => !l.dismissed);
    await Promise.all(unread.map(l => base44.entities.CallLog.update(l.id, { dismissed:true }).catch(()=>{})));
    setCallLogs(prev => prev.map(l => ({ ...l, dismissed:true })));
  };

  const inboundFiltered = callLogs.filter(l => l.direction === 'inbound');
  const outboundFiltered = lineFilter === 'all' ? historyRows : historyRows.filter(c => c.from === lineFilter);

  const unlistenedVm = callLogs.filter(l => l.vmRecordingUrl && !l.vmListened).length;
  const missedCount  = callLogs.filter(l => (l.status==='missed'||l.status==='no-answer') && !l.dismissed).length;

  const handleOpenLead = (leadId) => {
    if (onOpenLead) { onOpenLead(leadId); onClose(); }
  };
  const handleOpenInvestor = (investorId) => {
    if (onOpenInvestor) { onOpenInvestor(investorId); onClose(); }
  };

  return (
    <>
      <style>{`@keyframes linePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(1.3)}}`}</style>
      <div ref={panelRef} style={{ position:'fixed', left:pos.x, top:pos.y, zIndex:99990, width:size.w, height:size.h, background:DARK, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'10px', boxShadow:'0 20px 60px rgba(0,0,0,0.9)', fontFamily:'Georgia, serif', display:'flex', flexDirection:'column', minWidth:'420px', minHeight:'320px' }}>

        {/* Header */}
        <div onMouseDown={e=>{ if(e.target.closest('button'))return; dragging.current=true; dragStart.current={mx:e.clientX,my:e.clientY,px:pos.x,py:pos.y}; e.preventDefault(); }}
          style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0, cursor:'move' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ color:GOLD, fontSize:'12px', letterSpacing:'1.5px', textTransform:'uppercase', fontWeight:'bold' }}>📋 Call Log</span>
            {unlistenedVm > 0 && <span style={{ background:'rgba(245,158,11,0.2)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.4)', borderRadius:'10px', padding:'1px 7px', fontSize:'10px', fontWeight:'bold' }}>📩 {unlistenedVm} VM</span>}
            {missedCount  > 0 && <span style={{ background:'rgba(239,68,68,0.15)',  color:'#ef4444', border:'1px solid rgba(239,68,68,0.35)',  borderRadius:'10px', padding:'1px 7px', fontSize:'10px', fontWeight:'bold' }}>📵 {missedCount} Missed</span>}
          </div>
          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
            <button onClick={dismissAll} style={{ background:'rgba(255,255,255,0.05)', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'3px 10px', cursor:'pointer', fontSize:'10px' }}>Mark All Read</button>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'20px', lineHeight:1 }}>×</button>
          </div>
        </div>

        {/* Live Line Bars */}
        <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
          <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>Live Line Status</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
            {lines.length > 0
              ? lines.map((line,i) => <LiveLineBar key={i} line={line} logs={callLogs} />)
              : [0,1,2].map(n => (
                  <div key={n} style={{ display:'flex', alignItems:'center', gap:'10px', background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:'6px', padding:'7px 12px' }}>
                    <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#374151', flexShrink:0 }} />
                    <div style={{ color:'#4a5568', fontSize:'11px' }}>Line {n+1} — loading…</div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Main Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          {[['calls','📋 Calls'], ['reports','📊 Reports'], ['voicemail','📩 Voicemail' + (unlistenedVm>0?` (${unlistenedVm})`:'')]].map(([id, label]) => (
            <button key={id} onClick={() => setMainTab(id)}
              style={{ flex:1, background:'none', border:'none', borderBottom: mainTab===id?`2px solid ${GOLD}`:'2px solid transparent', color: mainTab===id?GOLD:'#6b7280', padding:'9px', cursor:'pointer', fontSize:'11px', letterSpacing:'0.5px' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Voicemail Tab ── */}
        {mainTab === 'voicemail' && (
          <>
            <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
              {[['list','📩 Messages'], ['settings','⚙️ Greeting']].map(([id, label]) => (
                <button key={id} onClick={() => setVmSubTab(id)}
                  style={{ flex:1, background:'none', border:'none', borderBottom: vmSubTab===id?`2px solid #f59e0b`:'2px solid transparent', color: vmSubTab===id?'#f59e0b':'#6b7280', padding:'8px', cursor:'pointer', fontSize:'11px' }}>
                  {label}
                </button>
              ))}
            </div>
            {vmSubTab === 'list' && (
              <VoicemailListTab
                callLogs={callLogs}
                onMarkListened={markVmListened}
                onOpenLead={handleOpenLead}
                onOpenInvestor={handleOpenInvestor}
                playingVm={playingVm}
                setPlayingVm={setPlayingVm}
                audioRef={audioRef}
              />
            )}
            {vmSubTab === 'settings' && <VoicemailSettingsTab />}
          </>
        )}

        {/* ── Reports Tab ── */}
        {mainTab === 'reports' && <div style={{ flex:1, overflowY:'auto' }}><ReportsTab lines={lines} /></div>}

        {/* ── Calls Tab ── */}
        {mainTab === 'calls' && (
          <>
            {/* Inbound / Outbound sub-tabs */}
            <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
              {[['inbound','↙ Incoming', inboundFiltered.length], ['outbound','↗ Outgoing', outboundFiltered.length]].map(([dir, label, count]) => (
                <button key={dir} onClick={() => setDirTab(dir)}
                  style={{ flex:1, background:'none', border:'none', borderBottom: dirTab===dir?`2px solid ${dir==='inbound'?'#60a5fa':'#a78bfa'}`:'2px solid transparent', color: dirTab===dir?(dir==='inbound'?'#60a5fa':'#a78bfa'):'#6b7280', padding:'8px', cursor:'pointer', fontSize:'11px' }}>
                  {label} <span style={{ fontSize:'10px', opacity:0.7 }}>({count})</span>
                </button>
              ))}
            </div>

            {/* Outbound filters */}
            {dirTab === 'outbound' && (
              <div style={{ padding:'8px 14px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0, display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', flexShrink:0 }}>Range:</span>
                <input type="date" value={listStart} onChange={e=>setListStart(e.target.value)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'4px 8px', color:'#e8e0d0', fontSize:'11px', outline:'none', colorScheme:'dark' }} />
                <span style={{ color:'#4a5568', fontSize:'11px' }}>→</span>
                <input type="date" value={listEnd} onChange={e=>setListEnd(e.target.value)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'4px 8px', color:'#e8e0d0', fontSize:'11px', outline:'none', colorScheme:'dark' }} />
                <button onClick={() => { setLoading(true); loadOutbound(listStart, listEnd).then(() => setLoading(false)); }} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'4px 14px', cursor:'pointer', fontSize:'10px', fontWeight:'bold' }}>Load</button>
                <select value={lineFilter} onChange={e=>setLineFilter(e.target.value)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'4px 8px', color:'#e8e0d0', fontSize:'11px', outline:'none', colorScheme:'dark', cursor:'pointer', marginLeft:'auto' }}>
                  <option value="all">👥 All Agents</option>
                  {lines.map(l => <option key={l.number} value={l.number}>{l.label==='Steph'?'🟣':'🟡'} {l.label}</option>)}
                </select>
              </div>
            )}

            {/* Call list */}
            <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
              {loading && <div style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading…</div>}

              {!loading && dirTab === 'inbound' && (
                <>
                  {inboundFiltered.length === 0 && <div style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}><div style={{ fontSize:'32px', marginBottom:'8px' }}>📋</div>No incoming call records.</div>}
                  {inboundFiltered.map(log => (
                    <CallRow key={log.id} log={log} isOutbound={false} leads={leads} lines={lines}
                      onOpenLead={handleOpenLead} onOpenInvestor={handleOpenInvestor}
                      onMarkVm={markVmListened} playingVm={playingVm} setPlayingVm={setPlayingVm} audioRef={audioRef}
                    />
                  ))}
                </>
              )}

              {!loading && dirTab === 'outbound' && (
                <>
                  {outboundFiltered.length === 0 && <div style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}><div style={{ fontSize:'32px', marginBottom:'8px' }}>📋</div>No outgoing call records for this range.</div>}
                  {outboundFiltered.map(c => (
                    <CallRow key={c.sid} log={c} isOutbound={true} leads={leads} lines={lines}
                      onOpenLead={handleOpenLead} onOpenInvestor={handleOpenInvestor}
                      onMarkVm={null} playingVm={null} setPlayingVm={null} audioRef={audioRef}
                    />
                  ))}
                </>
              )}
            </div>
          </>
        )}

        {/* Resize handle */}
        <div onMouseDown={e=>{ resizing.current=true; resStart.current={mx:e.clientX,my:e.clientY,w:size.w,h:size.h}; e.preventDefault(); e.stopPropagation(); }}
          style={{ position:'absolute', bottom:0, right:0, width:'20px', height:'20px', cursor:'se-resize', display:'flex', alignItems:'flex-end', justifyContent:'flex-end', padding:'4px' }}>
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none"><path d="M2 9L9 2M5 9L9 5M9 9L9 9" stroke="rgba(184,147,58,0.5)" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
      </div>
    </>
  );
}