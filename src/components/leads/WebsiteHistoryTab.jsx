import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

function fmt(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
}

function fmtDur(secs) {
  if (!secs || secs < 1) return '< 1s';
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs/60)}m ${secs%60}s`;
}

export default function WebsiteHistoryTab({ lead }) {
  const [site, setSite] = useState('investors');
  const [sessions, setSessions] = useState([]);       // AnalyticsSession for investors site
  const [consumerVisits, setConsumerVisits] = useState([]); // SiteVisit for consumer site
  const [loading, setLoading] = useState(true);

  const username = lead?.portalPasscode || null;
  const refCode  = lead?.portalPasscode || null;

  useEffect(() => { if (lead?.id) load(); }, [lead?.id]);

  const load = async () => {
    setLoading(true);
    try {
      const [sess, visits] = await Promise.all([
        username ? base44.entities.AnalyticsSession.filter({ username }).catch(() => []) : Promise.resolve([]),
        refCode  ? base44.entities.SiteVisit.filter({ passcode: refCode }).catch(() => []) : Promise.resolve([]),
      ]);
      sess.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
      visits.sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt));
      setSessions(sess);
      setConsumerVisits(visits);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const invTotalTime = sessions.reduce((s, x) => s + (x.durationSeconds || 0), 0);
  const conTotalTime = consumerVisits.reduce((s, x) => s + (x.timeOnPage || 0), 0);

  return (
    <div>
      {/* Site toggle */}
      <div style={{ display:'flex', gap:'0', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:'16px' }}>
        {[['investors','💼 Investors Site'],['consumer','🌐 Consumer Site']].map(([id,label]) => (
          <button key={id} onClick={() => setSite(id)}
            style={{ background:'none', border:'none', borderBottom: site===id ? `2px solid ${GOLD}` : '2px solid transparent', color: site===id ? GOLD : '#6b7280', padding:'8px 16px', cursor:'pointer', fontSize:'11px', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
            {label} ({id==='investors' ? sessions.length : consumerVisits.length})
          </button>
        ))}
      </div>

      {!username && (
        <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:'4px', padding:'10px 14px', marginBottom:'12px', color:'#f59e0b', fontSize:'12px' }}>
          ⚠️ No passcode assigned yet — send the prospect email to enable tracking.
        </div>
      )}
      {username && (
        <div style={{ background:'rgba(0,0,0,0.15)', borderRadius:'4px', padding:'6px 12px', marginBottom:'12px', fontSize:'11px', display:'flex', gap:'12px' }}>
          <span style={{ color:'#4a5568' }}>Username / Ref:</span>
          <span style={{ color:GOLD, fontFamily:'monospace' }}>{username}</span>
        </div>
      )}

      {/* Stats */}
      {(() => {
        const statRows = site === 'investors'
          ? [['Sessions', sessions.length, GOLD],['Pages', sessions.reduce((s,x) => s+(x.pages?.length||0),0), '#60a5fa'],['Time', fmtDur(invTotalTime), '#4ade80']]
          : [['Page Views', consumerVisits.length, GOLD],['Unique Pages', [...new Set(consumerVisits.map(v=>v.page))].length, '#60a5fa'],['Time', fmtDur(conTotalTime), '#4ade80']];
        return (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', marginBottom:'14px' }}>
            {statRows.map(([label,val,color]) => (
              <div key={label} style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'8px', textAlign:'center' }}>
                <div style={{ color, fontSize:'15px', fontWeight:'bold' }}>{val}</div>
                <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', marginTop:'2px' }}>{label}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {loading && <div style={{ color:'#6b7280', textAlign:'center', padding:'20px' }}>Loading…</div>}

      {/* Investors site sessions */}
      {!loading && site === 'investors' && (
        <div style={{ maxHeight:'280px', overflowY:'auto' }}>
          {sessions.length === 0 && <div style={{ color:'#4a5568', textAlign:'center', padding:'20px' }}>No sessions yet on investors.rosieai.tech</div>}
          {sessions.map((s, i) => (
            <div key={s.id||i} style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'4px', padding:'10px 12px', marginBottom:'6px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                <div style={{ display:'flex', gap:'10px', fontSize:'11px' }}>
                  <span style={{ color:'#4ade80' }}>{fmtDur(s.durationSeconds)}</span>
                  <span style={{ color:'#60a5fa' }}>{s.pages?.length||0} pages</span>
                  {s.downloads?.length > 0 && <span style={{ color:'#f59e0b' }}>📥 {s.downloads.length}</span>}
                </div>
                <span style={{ color:'#6b7280', fontSize:'10px' }}>{fmt(s.startTime)}</span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'3px' }}>
                {(s.pages||[]).map((p,j) => (
                  <span key={j} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'3px', padding:'1px 7px', fontSize:'10px', color:'#8a9ab8' }}>
                    {p.page||p.section||'/'}{p.durationSeconds>0?` · ${fmtDur(p.durationSeconds)}`:''}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Consumer site visits */}
      {!loading && site === 'consumer' && (
        <div style={{ maxHeight:'280px', overflowY:'auto' }}>
          {consumerVisits.length === 0 && <div style={{ color:'#4a5568', textAlign:'center', padding:'20px' }}>No visits to rosieai.tech yet via this ref code</div>}
          {Object.values(consumerVisits.reduce((acc,v) => {
            const k = v.sessionId||v.visitedAt;
            if (!acc[k]) acc[k] = { visitedAt:v.visitedAt, pages:[], totalTime:0 };
            acc[k].pages.push(v); acc[k].totalTime += v.timeOnPage||0;
            return acc;
          }, {})).map((g,i) => (
            <div key={i} style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'4px', padding:'10px 12px', marginBottom:'6px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                <div style={{ display:'flex', gap:'10px', fontSize:'11px' }}>
                  {g.totalTime > 0 && <span style={{ color:'#4ade80' }}>{fmtDur(g.totalTime)}</span>}
                  <span style={{ color:'#60a5fa' }}>{g.pages.length} pages</span>
                </div>
                <span style={{ color:'#6b7280', fontSize:'10px' }}>{fmt(g.visitedAt)}</span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'3px' }}>
                {g.pages.map((p,j) => (
                  <span key={j} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'3px', padding:'1px 7px', fontSize:'10px', color:'#8a9ab8' }}>
                    {p.page}{p.timeOnPage>0?` · ${fmtDur(p.timeOnPage)}`:''}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}