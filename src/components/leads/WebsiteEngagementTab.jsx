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

function fmtDur(secs) {
  if (!secs || secs < 1) return '';
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs/60)}m ${secs%60}s`;
}

export default function WebsiteEngagementTab({ onOpenLead }) {
  const [site, setSite] = useState('investors');
  const [investorSessions, setInvestorSessions] = useState([]);
  const [consumerVisits, setConsumerVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 15000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const load = async () => {
    try {
      // Investor site: get recent AnalyticsSession records that have a leadId or are prospects
      // We identify prospect sessions by cross-referencing InvestorUser.status === 'prospect'
      const [allSessions, allLeads, siteVisits] = await Promise.all([
        base44.entities.AnalyticsSession.list('-startTime', 200).catch(() => []),
        base44.entities.Lead.filter({ status: 'prospect' }).catch(() => []),
        base44.entities.SiteVisit.list('-visitedAt', 200).catch(() => []),
      ]);

      // Build username → lead map
      const usernameToLead = {};
      allLeads.forEach(l => { if (l.portalPasscode) usernameToLead[l.portalPasscode] = l; });

      // Filter sessions to only prospects
      const prospectSessions = allSessions.filter(s => usernameToLead[s.username]);
      prospectSessions.forEach(s => { s._lead = usernameToLead[s.username]; });

      setInvestorSessions(prospectSessions);
      setConsumerVisits(siteVisits);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const openLead = async (leadId) => {
    if (!leadId || !onOpenLead) return;
    try {
      const leads = await base44.entities.Lead.filter({ id: leadId });
      if (leads?.[0]) onOpenLead(leads[0]);
    } catch {}
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
        <div>
          <h2 style={{ color:'#e8e0d0', margin:'0 0 2px', fontSize:'18px', fontWeight:'normal' }}>Website Engagement</h2>
          <p style={{ color:'#6b7280', fontSize:'12px', margin:0 }}>Prospect activity · auto-refreshes every 15s</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 5px #4ade80', animation:'pulse 2s infinite' }} />
          <span style={{ color:'#4ade80', fontSize:'10px' }}>LIVE</span>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
        </div>
      </div>

      {/* Site toggle */}
      <div style={{ display:'flex', gap:'0', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:'16px' }}>
        {[['investors',`💼 Investors Site (${investorSessions.length})`],['consumer',`🌐 Consumer Site (${consumerVisits.length})`]].map(([id,label]) => (
          <button key={id} onClick={() => setSite(id)}
            style={{ background:'none', border:'none', borderBottom: site===id ? `2px solid ${GOLD}` : '2px solid transparent', color: site===id ? GOLD : '#6b7280', padding:'8px 16px', cursor:'pointer', fontSize:'11px', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div style={{ color:'#6b7280', textAlign:'center', padding:'30px' }}>Loading…</div>}

      {/* Investors site sessions */}
      {site === 'investors' && !loading && (
        <>
          {investorSessions.length === 0 && (
            <div style={{ color:'#4a5568', textAlign:'center', padding:'30px' }}>
              <div style={{ fontSize:'28px', marginBottom:'8px' }}>💼</div>
              No prospect sessions yet on investors.rosieai.tech
            </div>
          )}
          <div style={{ maxHeight:'65vh', overflowY:'auto' }}>
            {investorSessions.map((s, i) => (
              <div key={s.id || i}
                onClick={() => s._lead && openLead(s._lead.id)}
                style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'6px', padding:'12px 14px', marginBottom:'8px', cursor: s._lead ? 'pointer' : 'default' }}
                onMouseEnter={e => { if(s._lead) e.currentTarget.style.background='rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
                  <div>
                    <span style={{ color:'#e8e0d0', fontSize:'13px', fontWeight:'bold', marginRight:'8px' }}>
                      {s._lead ? `${s._lead.firstName} ${s._lead.lastName}` : s.username}
                    </span>
                    <span style={{ color:'#a78bfa', fontSize:'10px', fontFamily:'monospace' }}>{s.username}</span>
                  </div>
                  <span style={{ color:'#6b7280', fontSize:'10px' }}>{fmt(s.startTime)}</span>
                </div>
                <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', fontSize:'11px' }}>
                  {s.durationSeconds > 0 && <span style={{ color:'#4ade80' }}>⏱ {fmtDur(s.durationSeconds)}</span>}
                  {s.pages?.length > 0 && <span style={{ color:'#60a5fa' }}>📄 {s.pages.length} pages</span>}
                  {s.downloads?.length > 0 && <span style={{ color:'#f59e0b' }}>📥 {s.downloads.length} downloads</span>}
                </div>
                {s.pages?.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'3px', marginTop:'6px' }}>
                    {s.pages.slice(0,4).map((p, j) => (
                      <span key={j} style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'3px', padding:'1px 6px', fontSize:'9px', color:'#6b7280' }}>
                        {p.page || p.section || '/'}
                      </span>
                    ))}
                    {s.pages.length > 4 && <span style={{ color:'#4a5568', fontSize:'9px' }}>+{s.pages.length-4}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Consumer site visits */}
      {site === 'consumer' && !loading && (
        <>
          {consumerVisits.length === 0 && (
            <div style={{ color:'#4a5568', textAlign:'center', padding:'30px' }}>
              <div style={{ fontSize:'28px', marginBottom:'8px' }}>🌐</div>
              No tracked visits to rosieai.tech yet
            </div>
          )}
          <div style={{ maxHeight:'65vh', overflowY:'auto' }}>
            {consumerVisits.map((v, i) => (
              <div key={v.id || i}
                onClick={() => v.leadId && openLead(v.leadId)}
                style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'6px', padding:'10px 14px', marginBottom:'6px', cursor: v.leadId ? 'pointer' : 'default' }}
                onMouseEnter={e => { if(v.leadId) e.currentTarget.style.background='rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    <span style={{ color:'#e8e0d0', fontSize:'12px', fontWeight:'bold' }}>{v.leadName || v.passcode}</span>
                    <span style={{ color:'#60a5fa', fontSize:'10px', background:'rgba(96,165,250,0.1)', padding:'1px 6px', borderRadius:'3px' }}>{v.page}</span>
                    {v.timeOnPage > 0 && <span style={{ color:'#4ade80', fontSize:'10px' }}>{fmtDur(v.timeOnPage)}</span>}
                  </div>
                  <span style={{ color:'#6b7280', fontSize:'10px' }}>{fmt(v.visitedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}