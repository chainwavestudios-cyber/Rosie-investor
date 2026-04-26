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
  const [loading, setLoading]           = useState(true);
  const [expandedSession, setExpandedSession]   = useState(null);
  const [expandedConsumer, setExpandedConsumer] = useState(null);

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

      {/* Investors site sessions — full detail */}
      {!loading && site === 'investors' && (
        <div>
          {sessions.length === 0 && <div style={{ color:'#4a5568', textAlign:'center', padding:'20px' }}>No sessions yet on investors.rosieai.tech</div>}
          {sessions.map((s, i) => {
            const isOpen = expandedSession === i;
            return (
              <div key={s.id||i} style={{ border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', marginBottom:'8px', overflow:'hidden' }}>
                {/* Session header — always visible */}
                <div onClick={() => setExpandedSession(isOpen ? null : i)}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', cursor:'pointer', background: isOpen ? 'rgba(184,147,58,0.08)' : 'rgba(0,0,0,0.15)' }}>
                  <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                    <span style={{ color:'#e8e0d0', fontSize:'11px' }}>{fmt(s.startTime)}</span>
                    <span style={{ color:'#4ade80', fontSize:'11px', fontWeight:'bold' }}>{fmtDur(s.durationSeconds)}</span>
                    <span style={{ color:'#60a5fa', fontSize:'10px' }}>{s.pages?.length||0} pages</span>
                    {s.downloads?.length > 0 && <span style={{ color:'#f59e0b', fontSize:'10px' }}>📥 {s.downloads.length} downloads</span>}
                    {s.docViews?.length > 0 && <span style={{ color:'#a78bfa', fontSize:'10px' }}>👁 {s.docViews.length} docs</span>}
                  </div>
                  <span style={{ color:'#4a5568', fontSize:'11px' }}>{isOpen ? '▲' : '▼'}</span>
                </div>
                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding:'12px', borderTop:'1px solid rgba(255,255,255,0.05)', background:'rgba(0,0,0,0.1)' }}>
                    {/* Pages */}
                    {(s.pages||[]).length > 0 && (
                      <div style={{ marginBottom:'10px' }}>
                        <div style={{ color:GOLD, fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'6px' }}>Pages Visited</div>
                        {(s.pages||[]).map((p, pi) => (
                          <div key={pi} style={{ marginBottom:'6px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'2px' }}>
                              <span style={{ color:'#c4cdd8' }}>📄 {p.page || '/'}</span>
                              <span style={{ color:'#4ade80', fontFamily:'monospace' }}>{fmtDur(p.durationSeconds)}</span>
                            </div>
                            {(p.sections||[]).length > 0 && (
                              <div style={{ paddingLeft:'12px', borderLeft:'2px solid rgba(184,147,58,0.2)' }}>
                                {(p.sections||[]).map((sec, si) => (
                                  <div key={si} style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', padding:'1px 0', color:'#6b7280' }}>
                                    <span>› {sec.section}</span>
                                    <span style={{ color:'#f59e0b', fontFamily:'monospace' }}>{fmtDur(sec.durationSeconds)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Documents viewed */}
                    {(s.docViews||[]).length > 0 && (
                      <div style={{ marginBottom:'10px' }}>
                        <div style={{ color:'#a78bfa', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'6px' }}>Documents Viewed</div>
                        {(s.docViews||[]).map((doc, di) => (
                          <div key={di} style={{ background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.15)', borderRadius:'3px', padding:'6px 10px', marginBottom:'4px', fontSize:'11px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between' }}>
                              <span style={{ color:'#c4cdd8' }}>📑 {doc.docName}</span>
                              <span style={{ color:'#a78bfa', fontFamily:'monospace' }}>{fmtDur(doc.durationSeconds)}</span>
                            </div>
                            {doc.pagesViewed?.length > 0 && (
                              <div style={{ color:'#6b7280', fontSize:'10px', marginTop:'3px' }}>
                                Pages viewed: {doc.pagesViewed.map(p => `p.${p.pageNum}`).join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Downloads */}
                    {(s.downloads||[]).length > 0 && (
                      <div>
                        <div style={{ color:'#f59e0b', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'6px' }}>Downloads</div>
                        {(s.downloads||[]).map((d, di) => (
                          <div key={di} style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'3px 0', color:'#f59e0b' }}>
                            <span>↓ {d.fileName}</span>
                            <span style={{ color:'#4a5568' }}>{fmt(d.downloadedAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Consumer site visits — full detail */}
      {!loading && site === 'consumer' && (
        <div>
          {consumerVisits.length === 0 && <div style={{ color:'#4a5568', textAlign:'center', padding:'20px' }}>No visits to rosieai.tech yet via this ref code</div>}
          {Object.values(consumerVisits.reduce((acc, v) => {
            const k = v.sessionId || v.visitedAt;
            if (!acc[k]) acc[k] = { visitedAt: v.visitedAt, sessionId: k, pages: [], totalTime: 0 };
            acc[k].pages.push(v);
            acc[k].totalTime += v.timeOnPage || 0;
            return acc;
          }, {})).sort((a,b) => new Date(b.visitedAt) - new Date(a.visitedAt)).map((g, i) => {
            const isOpen = expandedConsumer === i;
            return (
              <div key={i} style={{ border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', marginBottom:'8px', overflow:'hidden' }}>
                <div onClick={() => setExpandedConsumer(isOpen ? null : i)}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', cursor:'pointer', background: isOpen ? 'rgba(96,165,250,0.06)' : 'rgba(0,0,0,0.15)' }}>
                  <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                    <span style={{ color:'#e8e0d0', fontSize:'11px' }}>{fmt(g.visitedAt)}</span>
                    {g.totalTime > 0 && <span style={{ color:'#4ade80', fontSize:'11px', fontWeight:'bold' }}>{fmtDur(g.totalTime)}</span>}
                    <span style={{ color:'#60a5fa', fontSize:'10px' }}>{g.pages.length} pages</span>
                  </div>
                  <span style={{ color:'#4a5568', fontSize:'11px' }}>{isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && (
                  <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,0.05)', background:'rgba(0,0,0,0.1)' }}>
                    <div style={{ color:GOLD, fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'6px' }}>Pages Visited</div>
                    {g.pages.map((p, pi) => (
                      <div key={pi} style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ color:'#c4cdd8' }}>📄 {p.page || '/'}</span>
                        <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                          {p.referrer && <span style={{ color:'#4a5568', fontSize:'10px' }}>from: {p.referrer.slice(0,30)}</span>}
                          {p.timeOnPage > 0 && <span style={{ color:'#4ade80', fontFamily:'monospace', fontSize:'11px' }}>{fmtDur(p.timeOnPage)}</span>}
                        </div>
                      </div>
                    ))}
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