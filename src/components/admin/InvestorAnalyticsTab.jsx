import { useState } from 'react';
import analytics from '@/lib/analytics';
import { computeEngagementScore, getScoreColor, getScoreLabel } from '@/lib/engagementScore';

const GOLD = '#b8933a';

function fmt(s) { return analytics.formatDuration(s); }
function fmtDT(iso) { return analytics.formatDateTime(iso); }

// Score breakdown breakdown row
function ScoreRow({ label, points, earned }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderRadius:'2px', background: earned ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)', border:`1px solid ${earned ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)'}`, marginBottom:'4px' }}>
      <span style={{ color: earned ? '#c4cdd8' : '#4a5568', fontSize:'12px' }}>{label}</span>
      <span style={{ color: earned ? '#4ade80' : '#4a5568', fontWeight:'bold', fontSize:'12px', fontFamily:'monospace' }}>{earned ? `+${points}` : `—`}</span>
    </div>
  );
}

export default function InvestorAnalyticsTab({ user, sessions, stats }) {
  const [expandedSession, setExpandedSession] = useState(null);

  const allDocViews = sessions.flatMap(s => s.docViews || []);
  const allDownloads = sessions.flatMap(s => s.downloads || []);
  const allPages = sessions.flatMap(s => s.pages || []);

  // Compute score components for breakdown
  const hasPPM = allDocViews.some(d => /ppm|circular|offering/i.test(d.docName || ''));
  const hasSubscription = allDocViews.some(d => /subscription|sub agreement/i.test(d.docName || ''));
  const hasQuestionnaire = allDocViews.some(d => /questionnaire|questionaire|accreditation/i.test(d.docName || ''));
  const hasOperatingAgreement = allDocViews.some(d => /operating agreement|operating/i.test(d.docName || ''));
  const ppmDoc = allDocViews.find(d => /ppm|circular|offering/i.test(d.docName || ''));
  const ppmPct = ppmDoc && ppmDoc.pagesViewed && ppmDoc.totalPages ? ppmDoc.pagesViewed.length / ppmDoc.totalPages : 0;
  const uniqueDownloads = new Set(allDownloads.map(d => d.fileName)).size;
  const longSession = sessions.some(s => (s.durationSeconds || 0) >= 900);
  const sessionsByDay = {};
  sessions.forEach(s => {
    if (!s.startTime) return;
    const day = new Date(s.startTime).toDateString();
    sessionsByDay[day] = (sessionsByDay[day] || 0) + 1;
  });
  const daysWithTriple = Object.values(sessionsByDay).filter(c => c >= 3).length;

  // Page time breakdown
  const pageTimeEntries = Object.entries(stats.pageTime || {}).sort((a,b) => b[1]-a[1]);
  // Section time breakdown
  const sectionTimeEntries = Object.entries(stats.sectionTime || {}).sort((a,b) => b[1]-a[1]);

  const score = user.engagementScore || 0;
  const col = getScoreColor(score);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

      {/* Score Header */}
      <div style={{ background:`${col}10`, border:`1px solid ${col}33`, borderRadius:'4px', padding:'16px 20px', display:'flex', alignItems:'center', gap:'20px' }}>
        <div style={{ width:'64px', height:'64px', borderRadius:'50%', border:`3px solid ${col}`, display:'flex', alignItems:'center', justifyContent:'center', background:`${col}15`, flexShrink:0 }}>
          <span style={{ color:col, fontSize:'22px', fontWeight:'bold' }}>{score}</span>
        </div>
        <div>
          <div style={{ color:col, fontSize:'18px', fontWeight:'bold', marginBottom:'2px' }}>{getScoreLabel(score)} Investor</div>
          <div style={{ color:'#8a9ab8', fontSize:'12px' }}>Engagement Score · {analytics.formatDate(stats.firstSeen)} → {analytics.formatDate(stats.lastSeen)}</div>
        </div>
        <div style={{ flex:1 }} />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'12px', textAlign:'center' }}>
          {(() => {
            const now = Date.now();
            const sessionsThisWeek = sessions.filter(s => s.startTime && (now - new Date(s.startTime).getTime()) < 7*24*60*60*1000);
            const sessionsToday = sessions.filter(s => s.startTime && new Date(s.startTime).toDateString() === new Date().toDateString());
            return [[stats.sessionCount,'Total Logins',GOLD],[sessionsThisWeek.length,'This Week','#a78bfa'],[sessionsToday.length,'Today','#f59e0b'],[fmt(stats.totalTime),'Time','#4ade80'],[stats.totalDownloads,'Downloads','#60a5fa'],[stats.totalDocViews,'Doc Views','#f59e0b']];
          })().map(([v,l,c]) => (
            <div key={l}>
              <div style={{ color:c, fontWeight:'bold', fontSize:'18px' }}>{v}</div>
              <div style={{ color:'#4a5568', fontSize:'9px', textTransform:'uppercase', letterSpacing:'1px' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Score Breakdown */}
      <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'4px', padding:'16px' }}>
        <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>Score Breakdown</div>
        <ScoreRow label="First login" points={5} earned={sessions.length >= 1} />
        <ScoreRow label={`Additional sessions (+${Math.max(0,sessions.length-1)} × 1pt)`} points={Math.max(0,sessions.length-1)} earned={sessions.length > 1} />
        <ScoreRow label={`3+ logins in a day bonus (${daysWithTriple} day${daysWithTriple!==1?'s':''})`} points={daysWithTriple*10} earned={daysWithTriple > 0} />
        <ScoreRow label="Read PPM / Circular / Offering doc" points={10} earned={hasPPM} />
        <ScoreRow label="Read Subscription docs" points={10} earned={hasSubscription} />
        <ScoreRow label="Read Investor Questionnaire" points={10} earned={hasQuestionnaire} />
        <ScoreRow label="Read Operating Agreement" points={10} earned={hasOperatingAgreement} />
        <ScoreRow label="75%+ of PPM viewed" points={5} earned={ppmPct >= 0.75} />
        <ScoreRow label={`Downloaded ${uniqueDownloads} document${uniqueDownloads!==1?'s':''}`} points={uniqueDownloads>=3?20:uniqueDownloads===2?15:uniqueDownloads===1?10:0} earned={uniqueDownloads > 0} />
        <ScoreRow label="SignNow documents sent" points={40} earned={(user.signnowRequested)} />
        <ScoreRow label="15+ min in portal (single session)" points={10} earned={longSession} />
      </div>

      {/* Page Time */}
      {pageTimeEntries.length > 0 && (
        <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'16px' }}>
          <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>Time per Page</div>
          {pageTimeEntries.map(([page, secs]) => {
            const pct = stats.totalTime > 0 ? Math.min(100, Math.round(secs / stats.totalTime * 100)) : 0;
            return (
              <div key={page} style={{ marginBottom:'8px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                  <span style={{ color:'#c4cdd8', fontSize:'12px' }}>{page}</span>
                  <span style={{ color:'#4ade80', fontSize:'12px', fontFamily:'monospace' }}>{fmt(secs)}</span>
                </div>
                <div style={{ height:'4px', background:'rgba(255,255,255,0.06)', borderRadius:'2px' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#4ade80,#22c55e)', borderRadius:'2px' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Section Time */}
      {sectionTimeEntries.length > 0 && (
        <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'16px' }}>
          <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>Time per Section</div>
          {sectionTimeEntries.map(([sec, secs]) => (
            <div key={sec} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:'12px' }}>
              <span style={{ color:'#8a9ab8' }}>{sec}</span>
              <span style={{ color:'#f59e0b', fontFamily:'monospace' }}>{fmt(secs)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Document Views */}
      {allDocViews.length > 0 && (
        <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'16px' }}>
          <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>Document Views ({allDocViews.length})</div>
          {allDocViews.map((doc, i) => {
            const pages = doc.pagesViewed || [];
            return (
              <div key={i} style={{ marginBottom:'8px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'2px', padding:'10px 12px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <span style={{ color:'#c4cdd8', fontSize:'13px', fontWeight:'bold' }}>{doc.docName}</span>
                    <span style={{ color:'#4a5568', fontSize:'11px', marginLeft:'8px' }}>{doc.docType}</span>
                  </div>
                  <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                    {pages.length > 0 && <span style={{ color:'#a78bfa', fontSize:'11px' }}>{pages.length} pages viewed</span>}
                    <span style={{ color:'#4ade80', fontFamily:'monospace', fontSize:'12px' }}>{fmt(doc.durationSeconds)}</span>
                    <span style={{ color:'#4a5568', fontSize:'11px' }}>{analytics.formatDate(doc.openedAt)}</span>
                  </div>
                </div>
                {pages.length > 0 && (
                  <div style={{ marginTop:'8px', display:'flex', flexWrap:'wrap', gap:'4px' }}>
                    {pages.map((p, pi) => (
                      <span key={pi} style={{ background:'rgba(167,139,250,0.1)', color:'#a78bfa', border:'1px solid rgba(167,139,250,0.2)', borderRadius:'2px', padding:'2px 7px', fontSize:'10px' }}>
                        p.{p.pageNum} {p.durationSeconds > 0 ? `(${fmt(p.durationSeconds)})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Downloads */}
      {allDownloads.length > 0 && (
        <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'16px' }}>
          <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>Downloads ({allDownloads.length})</div>
          {allDownloads.map((d, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:'12px' }}>
              <span style={{ color:'#60a5fa' }}>↓ {d.fileName}</span>
              <span style={{ color:'#4a5568' }}>{fmtDT(d.downloadedAt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Login History */}
      <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'16px' }}>
        <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'12px' }}>Login History ({sessions.length} sessions)</div>
        {sessions.length === 0 ? (
          <p style={{ color:'#4a5568', fontSize:'12px', textAlign:'center', padding:'16px' }}>No sessions yet.</p>
        ) : sessions.map((sess, i) => {
          const isOpen = expandedSession === i;
          const sessPages = sess.pages || [];
          return (
            <div key={i} style={{ marginBottom:'6px', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'2px', overflow:'hidden' }}>
              <div onClick={() => setExpandedSession(isOpen ? null : i)}
                style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', cursor:'pointer', background:isOpen?'rgba(184,147,58,0.08)':'rgba(255,255,255,0.02)' }}>
                <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
                  <span style={{ color:'#e8e0d0', fontSize:'12px' }}>{fmtDT(sess.startTime)}</span>
                  <span style={{ color:'#4a5568', fontSize:'11px' }}>📄 {sessPages.length} pages · 📥 {sess.downloads?.length||0} · 👁 {sess.docViews?.length||0} docs</span>
                  {!sess.endTime && <span style={{ color:'#4ade80', fontSize:'10px' }}>● Active</span>}
                </div>
                <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                  <span style={{ color:GOLD, fontFamily:'monospace', fontSize:'13px', fontWeight:'bold' }}>{fmt(sess.durationSeconds)}</span>
                  <span style={{ color:'#4a5568', fontSize:'11px' }}>{isOpen?'▲':'▼'}</span>
                </div>
              </div>
              {isOpen && sessPages.length > 0 && (
                <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                  {sessPages.map((pg, pi) => (
                    <div key={pi} style={{ marginBottom:'6px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'3px' }}>
                        <span style={{ color:'#c4cdd8' }}>{pg.page}</span>
                        <span style={{ color:'#4ade80', fontFamily:'monospace' }}>{fmt(pg.durationSeconds)}</span>
                      </div>
                      {(pg.sections||[]).length > 0 && (
                        <div style={{ paddingLeft:'12px', borderLeft:'2px solid rgba(184,147,58,0.2)' }}>
                          {pg.sections.map((sec, si) => (
                            <div key={si} style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'1px 0' }}>
                              <span style={{ color:'#6b7280' }}>› {sec.section}</span>
                              <span style={{ color:'#f59e0b', fontFamily:'monospace' }}>{fmt(sec.durationSeconds)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}