import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
}

function fmtDur(secs) {
  if (!secs || secs < 1) return '< 1s';
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs/60)}m ${secs%60}s`;
  return `${Math.floor(secs/3600)}h ${Math.floor((secs%3600)/60)}m`;
}

export default function InvestorWebsiteTab({ lead, user }) {
  // lead = LeadContactCard, user = InvestorContactCard
  // username comes from lead.portalPasscode or user.username
  const username = lead?.portalPasscode || user?.username || null;
  const refCode  = lead?.portalPasscode || user?.username || null;

  const [site, setSite] = useState('investors'); // 'investors' | 'consumer'
  const [sessions, setSessions] = useState([]);
  const [consumerVisits, setConsumerVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [username, refCode]);

  const load = async () => {
    setLoading(true);
    try {
      if (username) {
        const s = await base44.entities.AnalyticsSession.filter({ username });
        s.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        setSessions(s);
      }
      if (refCode) {
        const v = await base44.entities.SiteVisit.filter({ passcode: refCode });
        v.sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt));
        setConsumerVisits(v);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // Stats for investors site
  const totalTime    = sessions.reduce((s, x) => s + (x.durationSeconds || 0), 0);
  const totalPages   = sessions.reduce((s, x) => s + (x.pages?.length || 0), 0);
  const lastVisit    = sessions[0]?.startTime || null;

  // Stats for consumer site
  const cTotalTime  = consumerVisits.reduce((s, x) => s + (x.timeOnPage || 0), 0);
  const cUniqPages  = [...new Set(consumerVisits.map(v => v.page))].length;

  const noData = site === 'investors' ? sessions.length === 0 : consumerVisits.length === 0;

  return (
    <div>
      {/* Site toggle */}
      <div style={{ display:'flex', gap:'0', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:'16px' }}>
        {[['investors','💼 Investors Site'],['consumer','🌐 Consumer Site']].map(([id,label]) => (
          <button key={id} onClick={() => setSite(id)}
            style={{ background:'none', border:'none', borderBottom: site===id ? `2px solid ${GOLD}` : '2px solid transparent', color: site===id ? GOLD : '#6b7280', padding:'8px 16px', cursor:'pointer', fontSize:'11px', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      {/* No username warning */}
      {!username && !refCode && (
        <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:'4px', padding:'12px 16px', marginBottom:'16px', color:'#f59e0b', fontSize:'12px' }}>
          ⚠️ No username/passcode assigned yet. Send the prospect email to generate one.
        </div>
      )}

      {/* Username display */}
      {username && (
        <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'8px 12px', marginBottom:'12px', display:'flex', gap:'16px', fontSize:'11px' }}>
          <span style={{ color:'#4a5568' }}>Username:</span>
          <span style={{ color:GOLD, fontFamily:'monospace' }}>{username}</span>
          {site === 'consumer' && refCode && <>
            <span style={{ color:'#4a5568' }}>Ref code:</span>
            <span style={{ color:'#60a5fa', fontFamily:'monospace' }}>{refCode}</span>
          </>}
        </div>
      )}

      {/* ── INVESTORS SITE ── */}
      {site === 'investors' && (
        <>
          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'16px' }}>
            {[
              ['Sessions',   sessions.length,   GOLD],
              ['Pages Viewed', totalPages,       '#60a5fa'],
              ['Time Spent', fmtDur(totalTime),  '#4ade80'],
              ['Last Visit', lastVisit ? fmt(lastVisit) : '—', '#f59e0b'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'8px', textAlign:'center' }}>
                <div style={{ color, fontSize: label==='Last Visit'?'11px':'16px', fontWeight:'bold' }}>{val}</div>
                <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', marginTop:'2px' }}>{label}</div>
              </div>
            ))}
          </div>

          {loading && <div style={{ color:'#6b7280', textAlign:'center', padding:'30px' }}>Loading…</div>}
          {!loading && noData && (
            <div style={{ color:'#4a5568', textAlign:'center', padding:'30px' }}>
              <div style={{ fontSize:'28px', marginBottom:'8px' }}>💼</div>
              No visits to investors.rosieai.tech yet.
            </div>
          )}

          <div style={{ maxHeight:'340px', overflowY:'auto' }}>
            {sessions.map((s, i) => (
              <div key={s.id || i} style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'4px', padding:'12px 14px', marginBottom:'8px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                  <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                    <span style={{ color:'#e8e0d0', fontSize:'12px', fontWeight:'bold' }}>Session {i + 1}</span>
                    <span style={{ color:'#4ade80', fontSize:'11px' }}>{fmtDur(s.durationSeconds)}</span>
                    <span style={{ color:'#60a5fa', fontSize:'11px' }}>{s.pages?.length || 0} pages</span>
                  </div>
                  <span style={{ color:'#6b7280', fontSize:'10px' }}>{fmt(s.startTime)}</span>
                </div>
                {/* Pages visited */}
                {s.pages?.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                    {s.pages.map((p, j) => (
                      <span key={j} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'3px', padding:'2px 8px', fontSize:'10px', color:'#8a9ab8' }}>
                        {p.page || p.section || '/'}{p.durationSeconds > 0 ? ` · ${fmtDur(p.durationSeconds)}` : ''}
                      </span>
                    ))}
                  </div>
                )}
                {s.downloads?.length > 0 && (
                  <div style={{ marginTop:'6px', color:'#f59e0b', fontSize:'10px' }}>
                    📥 Downloads: {s.downloads.map(d => d.fileName || d.name).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── CONSUMER SITE ── */}
      {site === 'consumer' && (
        <>
          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'16px' }}>
            {[
              ['Page Views',   consumerVisits.length, GOLD],
              ['Unique Pages', cUniqPages,            '#60a5fa'],
              ['Time Spent',   fmtDur(cTotalTime),    '#4ade80'],
              ['Last Visit',   consumerVisits[0]?.visitedAt ? fmt(consumerVisits[0].visitedAt) : '—', '#f59e0b'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'8px', textAlign:'center' }}>
                <div style={{ color, fontSize: label==='Last Visit'?'11px':'16px', fontWeight:'bold' }}>{val}</div>
                <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', marginTop:'2px' }}>{label}</div>
              </div>
            ))}
          </div>

          {loading && <div style={{ color:'#6b7280', textAlign:'center', padding:'30px' }}>Loading…</div>}
          {!loading && noData && (
            <div style={{ color:'#4a5568', textAlign:'center', padding:'30px' }}>
              <div style={{ fontSize:'28px', marginBottom:'8px' }}>🌐</div>
              No visits to rosieai.tech yet via this ref code.
            </div>
          )}

          <div style={{ maxHeight:'340px', overflowY:'auto' }}>
            {/* Group by sessionId */}
            {Object.values(consumerVisits.reduce((acc, v) => {
              const key = v.sessionId || v.visitedAt;
              if (!acc[key]) acc[key] = { visitedAt: v.visitedAt, pages: [], totalTime: 0 };
              acc[key].pages.push(v);
              acc[key].totalTime += v.timeOnPage || 0;
              return acc;
            }, {})).map((group, i) => (
              <div key={i} style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'4px', padding:'12px 14px', marginBottom:'8px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                  <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                    <span style={{ color:'#e8e0d0', fontSize:'12px', fontWeight:'bold' }}>Visit {i + 1}</span>
                    {group.totalTime > 0 && <span style={{ color:'#4ade80', fontSize:'11px' }}>{fmtDur(group.totalTime)}</span>}
                    <span style={{ color:'#60a5fa', fontSize:'11px' }}>{group.pages.length} page{group.pages.length !== 1 ? 's' : ''}</span>
                  </div>
                  <span style={{ color:'#6b7280', fontSize:'10px' }}>{fmt(group.visitedAt)}</span>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                  {group.pages.map((p, j) => (
                    <span key={j} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'3px', padding:'2px 8px', fontSize:'10px', color:'#8a9ab8' }}>
                      {p.page}{p.timeOnPage > 0 ? ` · ${fmtDur(p.timeOnPage)}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}