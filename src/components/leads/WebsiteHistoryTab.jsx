import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

function fmt(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
}

function fmtDuration(secs) {
  if (!secs || secs < 1) return '< 1s';
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs/60)}m ${secs%60}s`;
}

export default function WebsiteHistoryTab({ lead }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [siteFilter, setSiteFilter] = useState('all');

  useEffect(() => { if (lead?.id) load(); }, [lead?.id]);

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.SiteVisit.filter({ leadId: lead.id });
      all.sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt));
      setVisits(all);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const filtered = visits.filter(v => siteFilter === 'all' || v.siteType === siteFilter);

  // Group into sessions
  const sessionMap = {};
  filtered.forEach(v => {
    const key = v.sessionId || v.visitedAt;
    if (!sessionMap[key]) sessionMap[key] = { visitedAt: v.visitedAt, siteType: v.siteType, pages: [], totalTime: 0 };
    sessionMap[key].pages.push({ page: v.page, timeOnPage: v.timeOnPage || 0 });
    sessionMap[key].totalTime += v.timeOnPage || 0;
  });
  const sessions = Object.values(sessionMap).sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt));

  // Stats
  const consumerVisits = visits.filter(v => v.siteType === 'consumer').length;
  const investorVisits = visits.filter(v => v.siteType === 'investor').length;
  const totalTime = visits.reduce((sum, v) => sum + (v.timeOnPage || 0), 0);

  return (
    <div>
      {/* Site toggle */}
      <div style={{ display:'flex', gap:'0', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:'16px' }}>
        {[['all','All Sites'],['consumer','🌐 Consumer Site'],['investor','💼 Investor Site']].map(([id,label]) => (
          <button key={id} onClick={() => setSiteFilter(id)}
            style={{ background:'none', border:'none', borderBottom: siteFilter===id ? `2px solid ${GOLD}` : '2px solid transparent', color: siteFilter===id ? GOLD : '#6b7280', padding:'8px 14px', cursor:'pointer', fontSize:'11px', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'16px' }}>
        {[
          ['Total Visits', visits.length, GOLD],
          ['Consumer', consumerVisits, '#60a5fa'],
          ['Investor Site', investorVisits, '#a78bfa'],
          ['Time Spent', fmtDuration(totalTime), '#4ade80'],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'8px', textAlign:'center' }}>
            <div style={{ color, fontSize:'16px', fontWeight:'bold' }}>{val}</div>
            <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', marginTop:'2px' }}>{label}</div>
          </div>
        ))}
      </div>

      {loading && <div style={{ color:'#6b7280', textAlign:'center', padding:'30px' }}>Loading…</div>}

      {!loading && sessions.length === 0 && (
        <div style={{ color:'#4a5568', textAlign:'center', padding:'30px' }}>
          <div style={{ fontSize:'28px', marginBottom:'8px' }}>🌐</div>
          No site visits yet.
          {lead.portalPasscode && (
            <div style={{ marginTop:'8px', fontSize:'11px' }}>
              Passcode: <span style={{ color:GOLD, fontFamily:'monospace' }}>{lead.portalPasscode}</span>
              <br/>
              <span style={{ color:'#4a5568' }}>Consumer link: </span>
              <span style={{ color:'#60a5fa', fontFamily:'monospace', fontSize:'10px' }}>rosieai.tech?ref={lead.portalPasscode}</span>
            </div>
          )}
        </div>
      )}

      <div style={{ maxHeight:'300px', overflowY:'auto' }}>
        {sessions.map((session, i) => (
          <div key={i} style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'4px', padding:'10px 12px', marginBottom:'6px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ background: session.siteType==='consumer' ? 'rgba(96,165,250,0.15)' : 'rgba(167,139,250,0.15)', color: session.siteType==='consumer' ? '#60a5fa' : '#a78bfa', fontSize:'9px', padding:'1px 6px', borderRadius:'3px', textTransform:'uppercase' }}>
                  {session.siteType === 'consumer' ? '🌐 Consumer' : '💼 Investor'}
                </span>
                <span style={{ color:'#8a9ab8', fontSize:'11px' }}>{session.pages.length} page{session.pages.length !== 1 ? 's' : ''}</span>
                {session.totalTime > 0 && <span style={{ color:'#4ade80', fontSize:'11px' }}>· {fmtDuration(session.totalTime)} total</span>}
              </div>
              <span style={{ color:'#6b7280', fontSize:'10px' }}>{fmt(session.visitedAt)}</span>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
              {session.pages.map((p, j) => (
                <span key={j} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'3px', padding:'2px 8px', fontSize:'10px', color:'#8a9ab8' }}>
                  {p.page}{p.timeOnPage > 0 ? ` · ${fmtDuration(p.timeOnPage)}` : ''}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}