import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

function fmt(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const diff = Date.now() - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return d.toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
}

function fmtDuration(secs) {
  if (!secs || secs < 1) return '< 1s';
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs/60)}m ${secs%60}s`;
}

export default function SiteVisitsTab({ onOpenLead }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [siteFilter, setSiteFilter] = useState('all');
  const intervalRef = useRef(null);

  useEffect(() => {
    load();
    // Poll every 15s for real-time feel
    intervalRef.current = setInterval(load, 15000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const load = async () => {
    try {
      const all = await base44.entities.SiteVisit.list('-visitedAt', 200);
      setVisits(all);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const filtered = visits.filter(v => siteFilter === 'all' || v.siteType === siteFilter);

  // Group by session to show unique visits
  const sessionMap = {};
  filtered.forEach(v => {
    const key = v.sessionId || v.leadId + v.visitedAt;
    if (!sessionMap[key]) sessionMap[key] = { ...v, pages: [] };
    sessionMap[key].pages.push({ page: v.page, timeOnPage: v.timeOnPage });
  });
  const sessions = Object.values(sessionMap).sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt));

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
        <div>
          <h2 style={{ color:'#e8e0d0', margin:'0 0 2px', fontSize:'18px', fontWeight:'normal' }}>Site Visits</h2>
          <p style={{ color:'#6b7280', fontSize:'12px', margin:0 }}>Real-time tracking · refreshes every 15s</p>
        </div>
        <div style={{ display:'flex', gap:'4px' }}>
          {[['all','All'],['consumer','Consumer Site'],['investor','Investor Site']].map(([id,label]) => (
            <button key={id} onClick={() => setSiteFilter(id)}
              style={{ background: siteFilter===id ? 'rgba(184,147,58,0.15)' : 'transparent', border: siteFilter===id ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.1)', color: siteFilter===id ? GOLD : '#6b7280', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'11px' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Live indicator */}
      <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'12px' }}>
        <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 6px #4ade80', animation:'pulse 2s infinite' }} />
        <span style={{ color:'#4ade80', fontSize:'10px', letterSpacing:'1px' }}>LIVE — {sessions.length} sessions</span>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      </div>

      {loading && <div style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading…</div>}
      {!loading && sessions.length === 0 && (
        <div style={{ color:'#4a5568', textAlign:'center', padding:'40px' }}>
          <div style={{ fontSize:'32px', marginBottom:'8px' }}>🌐</div>
          No site visits yet. Send emails with the consumer site link to start tracking.
        </div>
      )}

      <div style={{ maxHeight:'65vh', overflowY:'auto' }}>
        {sessions.map((session, i) => (
          <div key={i} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'6px', padding:'12px 14px', marginBottom:'8px', cursor: session.leadId ? 'pointer' : 'default' }}
            onClick={() => session.leadId && onOpenLead && onOpenLead(session.leadId)}
            onMouseEnter={e => { if(session.leadId) e.currentTarget.style.background='rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
              <div>
                <span style={{ color:'#e8e0d0', fontSize:'13px', fontWeight:'bold', marginRight:'8px' }}>{session.leadName || 'Unknown'}</span>
                <span style={{ background: session.siteType==='consumer' ? 'rgba(96,165,250,0.15)' : 'rgba(167,139,250,0.15)', color: session.siteType==='consumer' ? '#60a5fa' : '#a78bfa', fontSize:'9px', padding:'1px 6px', borderRadius:'3px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                  {session.siteType === 'consumer' ? '🌐 Consumer' : '💼 Investor'}
                </span>
              </div>
              <span style={{ color:'#6b7280', fontSize:'10px' }}>{fmt(session.visitedAt)}</span>
            </div>
            <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
              {session.pages.slice(0,5).map((p, j) => (
                <span key={j} style={{ color:'#4a5568', fontSize:'10px', background:'rgba(0,0,0,0.2)', padding:'2px 6px', borderRadius:'3px' }}>
                  {p.page} {p.timeOnPage > 0 && `· ${fmtDuration(p.timeOnPage)}`}
                </span>
              ))}
              {session.pages.length > 5 && <span style={{ color:'#4a5568', fontSize:'10px' }}>+{session.pages.length - 5} more</span>}
            </div>
            {session.passcode && <div style={{ color:'#4a5568', fontSize:'9px', marginTop:'4px' }}>ref: {session.passcode}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}