/**
 * Restored Gmail-only Debt Call Coach engagement command center.
 * Uses the existing hot-record/lead-card workflows and never queries Fronter.
 * Pulls every 30 seconds while visible; only actionable new events notify.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { composeGmailIntelligence, shortHost } from '@/lib/coachGmailIntelligence';
import { logNotification } from '@/lib/notifyCenter';
import HotLeadBanner from '@/components/engagement/HotLeadBanner';
import HotLeadRecord from '@/components/engagement/HotLeadRecord';
import EngagedLeadList from '@/components/engagement/EngagedLeadList';
import EngagementContactCard from '@/components/engagement/EngagementContactCard';
import EngagementMetricList from '@/components/engagement/EngagementMetricList';
import DebtGmailVisualJourney from './DebtGmailVisualJourney';

const tones = { gold: '#e4bd78', teal: '#34d399', blue: '#60a5fa', purple: '#c4b5fd', red: '#fb7185', text: '#e6efe9', muted: '#9cafb4', border: 'rgba(163,212,201,.16)' };
const prettyDate = (d) => d ? new Date(d).toLocaleString() : '—';
const percentage = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
const actionCards = [
  { key: 'emailsSent', label: 'Gmail sends', tone: tones.blue, note: 'Successful sends' },
  { key: 'leadsEngaged', label: 'Active prospects', tone: tones.teal, note: 'Distinct clicked or qualified' },
  { key: 'uniqueOpeners', label: 'Possible readers', tone: tones.purple, note: 'Non-proxy opens, unverified' },
  { key: 'uniqueClickers', label: 'Link clickers', tone: tones.gold, note: 'People taking link actions' },
  { key: 'hotLeads', label: 'High email intent', tone: tones.red, note: 'Meaningful activity + score' },
  { key: 'avgScore', label: 'Average score', tone: tones.gold, note: 'Directional, not deal probability' },
];

export default function DebtCoachGmailCommandCenter() {
  const { sessionUserId, sessionToken, isAdmin, user } = useDebtCoachAuth();
  const [days, setDays] = useState(30);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState(null);
  const [card, setCard] = useState(null);
  const [soundOn, setSoundOn] = useState(false);
  const [handlingId, setHandlingId] = useState('');
  const [newActions, setNewActions] = useState([]);
  const seenRef = useRef(new Set());
  const initialized = useRef(false);
  const hotRef = useRef(null);
  const view = useMemo(() => composeGmailIntelligence(report), [report]);
  const showLead = (who) => { if (who?.leadId && who?.onFile !== false) setCard({ leadId: who.leadId, source: 'coach', name: who.name }); };

  const refresh = useCallback(async () => {
    if (!isAdmin || !sessionUserId || !sessionToken) return;
    try {
      const result = await base44.functions.invoke('sendDebtEmail', { action: 'gmailReport', sessionUserId, sessionToken, days, view: 'report' });
      if (result?.data?.error) throw new Error(result.data.error);
      const next = result.data || {};
      const noteworthy = [];
      for (const m of next.timeline || []) {
        for (const e of m.events || []) if (e.type === 'click' && e.quality !== 'proxy_or_automated' && e.url) {
          noteworthy.push({ key: 'clicked:' + (e.id || m.sendId + ':' + e.at), title: 'Tracked email link opened', subject: m.contactName || m.contactEmail || 'Contact', detail: shortHost(e.url) + ' · visitor unverified' });
        }
        if (m.audioCompleted) noteworthy.push({ key: 'audio:' + m.sendId, title: 'Personal audio completed', subject: m.contactName || m.contactEmail || 'Contact', detail: 'Welcome message completed' });
        if (m.calendarOpened) noteworthy.push({ key: 'calendar:' + m.sendId, title: 'Calendar opened', subject: m.contactName || m.contactEmail || 'Contact', detail: 'Booking not yet confirmed' });
        if (m.websiteClicked) noteworthy.push({ key: 'site:' + m.sendId, title: 'Company website clicked', subject: m.contactName || m.contactEmail || 'Contact', detail: 'Official Debt Advisors of America website' });
      }
      if (initialized.current) {
        const fresh = noteworthy.filter(n => !seenRef.current.has(n.key));
        if (fresh.length) {
          setNewActions(fresh.slice(0, 5));
          for (const action of fresh.slice(0, 8)) logNotification({
            title: action.title + ': ' + action.subject, body: action.detail,
            type: 'email_engagement', source: 'Debt Call Coach Gmail', linkPath: '/debt-call-coach?tab=engagement',
          });
        }
      } else initialized.current = true;
      for (const n of noteworthy) seenRef.current.add(n.key);
      setReport(next);
      setError('');
    } catch (e) { setError(e?.response?.data?.error || e.message || 'Could not load Gmail intelligence.'); }
    finally { setLoading(false); }
  }, [days, isAdmin, sessionUserId, sessionToken]);

  useEffect(() => {
    initialized.current = false;
    seenRef.current = new Set();
    setLoading(true);
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  const markHandled = async (record, handled) => {
    setHandlingId(record.id);
    try {
      const result = await base44.functions.invoke('sendDebtEmail', { action: 'gmailReport',
        reportAction: 'handleCoachHotLead', recordId: record.id, handled, sessionUserId, sessionToken });
      if (result.data?.error) throw new Error(result.data.error);
      await refresh();
    } catch (e) { setError(e.message || 'Could not update hot-lead record'); }
    finally { setHandlingId(''); }
  };

  if (!isAdmin) return <p style={{ color: tones.muted }}>Gmail Engagement is available to Debt Call Coach administrators.</p>;
  return <div className="coach-gmail-console" style={{ color: tones.text, fontFamily: 'system-ui,sans-serif', paddingBottom: 28 }}>
    <style>{`
    @keyframes cgc-slide{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes cgc-dot{0%,100%{box-shadow:0 0 0 0 #34d39966}50%{box-shadow:0 0 0 7px #34d39900}}
    .coach-gmail-console .cgc-card{transition:transform .18s ease,border-color .18s ease;animation:cgc-slide .4s both}
    .coach-gmail-console button.cgc-card:hover{transform:translateY(-3px);border-color:#34d399!important}
    .coach-gmail-console .cgc-live{animation:cgc-dot 2.2s infinite}
    @media(prefers-reduced-motion:reduce){.coach-gmail-console *{animation:none!important;transition:none!important}}
    `}</style>
    <div style={{ background:'linear-gradient(110deg,#10243c 0%,#12342e 64%,#0a1b28 100%)',border:'1px solid #275b51',borderRadius:13,padding:'22px clamp(16px,3vw,28px)',marginBottom:14,boxShadow:'0 12px 38px #0003' }}>
      <div style={{ display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap' }}>
        <div>
          <div style={{ color:tones.gold,fontSize:10,letterSpacing:2.4,fontWeight:760,marginBottom:5 }}>ROSIE AI · DEBT CALL COACH</div>
          <h2 style={{ font:'normal clamp(23px,3vw,31px)/1.15 Georgia,serif',margin:'0 0 7px' }}>Email Engagement Intelligence</h2>
          <div style={{fontSize:12,color:'#b5c9c6'}}>Every Gmail template send, tracked click, audio playback and calendar interaction — one contact, one record.</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <span className="cgc-live" style={{width:8,height:8,borderRadius:9,background:tones.teal}}/>
          <span style={{fontSize:11,color:tones.teal}}>Auto-refresh · 30s</span>
          {[7,30,90,180].map(d=><button key={d} onClick={()=>setDays(d)} style={{border:'1px solid #42655b',borderRadius:6,padding:'7px 9px',background:d===days?'#165d4c':'#142935',color:'#e4f2ea',cursor:'pointer'}}>{d}d</button>)}
          <button onClick={refresh} style={{background:'#dab779',color:'#14221c',border:0,borderRadius:6,padding:'8px 12px',fontWeight:750,cursor:'pointer'}}>Refresh</button>
        </div>
      </div>
    </div>
    {error && <div role="alert" style={{marginBottom:12,padding:12,border:'1px solid #e46b75',borderRadius:9,color:'#ffb8bd'}}>{error}</div>}
    {loading && !report && <div style={{padding:24,color:tones.muted}}>Loading Gmail engagement…</div>}
    {report && <>
      {Object.values(report.truncated || {}).some(Boolean) && <div style={{border:'1px solid #dcae5b',borderRadius:7,color:'#e5ca91',padding:10,marginBottom:12,fontSize:12}}>Some data reached the reporting limit. Narrow the date range for more complete totals.</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(152px,1fr))',gap:9,marginBottom:13}}>
        {actionCards.map((tile,i)=><button type="button" key={tile.key} onClick={()=>setPicked(prev=>prev?.key===tile.key?null:tile)} className="cgc-card"
          style={{textAlign:'left',cursor:'pointer',padding:'13px 14px',background:'linear-gradient(145deg,#132333,#102027)',border:'1px solid '+(picked?.key===tile.key?tile.tone:tones.border),borderTop:'3px solid '+tile.tone,borderRadius:9}}>
          <div style={{fontSize:10,letterSpacing:.6,color:'#a9bfc1',textTransform:'uppercase'}}>{tile.label}</div>
          <div style={{fontSize:28,fontWeight:800,color:tile.tone,margin:'5px 0 2px'}}>{view.summary[tile.key] || 0}</div>
          <div style={{fontSize:10,color:'#879da3'}}>{tile.note}</div>
        </button>)}
      </div>
      {picked && <EngagementMetricList metric={picked} system="coach" leads={view.leads} ids={view.metricLeads[picked.key] || []} onOpenLead={showLead} onClose={()=>setPicked(null)}/>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:9,marginBottom:17}}>
        {[
          ['🎧 Audio started',report.summary?.audioStarted || 0,tones.purple],
          ['✓ Audio completed',report.summary?.audioCompleted || 0,tones.teal],
          ['📅 Calendar opened',report.summary?.calendarOpened || 0,tones.gold],
          ['↗ Company site clicked',report.summary?.companyWebsiteClicked || 0,tones.blue],
          ['◌ Proxy-only opens',report.summary?.proxyOnlyOpens || 0,tones.muted],
        ].map(([name,value,tone])=><div className="cgc-card" key={name} style={{border:'1px solid '+tones.border,background:'#10222a',borderRadius:9,padding:13}}>
          <div style={{fontSize:11,color:'#aec5c1'}}>{name}</div><strong style={{fontSize:24,color:tone}}>{value}</strong>
        </div>)}
      </div>
      {newActions.length>0 && <div style={{border:'1px solid #358f76',background:'#0f342c',borderRadius:10,padding:13,marginBottom:13}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><strong style={{color:tones.teal}}>New engagement detected</strong><button onClick={()=>setNewActions([])} style={{background:'none',border:0,color:tones.muted,cursor:'pointer'}}>Dismiss</button></div>
        {newActions.map(a=><p key={a.key} style={{margin:'6px 0 0',fontSize:12}}>{a.title} · <strong>{a.subject}</strong> · {a.detail}</p>)}
      </div>}
      <DebtGmailVisualJourney people={view.leads} onOpen={showLead}/>
      <HotLeadBanner hot={view.hot} leads={view.leads} system="coach" recorded={view.hotHistory.length} onOpenLead={showLead} onViewRecord={()=>hotRef.current?.scrollIntoView({behavior:'smooth'})}/>
      <div ref={hotRef}><HotLeadRecord history={view.hotHistory} system="coach" onOpenLead={showLead} onHandle={markHandled} handlingId={handlingId} soundOn={soundOn} onToggleSound={()=>setSoundOn(v=>!v)}/></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(450px,100%),1fr))',gap:14,marginTop:15}}>
        <section style={{padding:16,borderRadius:10,background:'#10212e',border:'1px solid '+tones.border}}>
          <h3 style={{margin:'0 0 5px',fontSize:15,color:tones.gold}}>Template effectiveness</h3>
          <p style={{color:tones.muted,fontSize:11,margin:'0 0 11px'}}>Verified Gmail sends and meaningful engagement, excluding proxy opens from the human-interest column.</p>
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:460}}>
            <thead><tr>{['Template','Sent','Opened*','Clicked','Click rate'].map(h=><th key={h} style={{textAlign:'left',padding:8,color:'#92aaaf',borderBottom:'1px solid #33504f'}}>{h}</th>)}</tr></thead>
            <tbody>{view.templates.map(row=><tr key={row.templateId}><td style={{padding:8,borderBottom:'1px solid #233c45'}}>{row.name}</td>
              <td style={{padding:8,borderBottom:'1px solid #233c45'}}>{row.sent}</td>
              <td style={{padding:8,borderBottom:'1px solid #233c45'}}>{row.opened}</td>
              <td style={{padding:8,borderBottom:'1px solid #233c45',color:tones.teal}}>{row.clicked}</td>
              <td style={{padding:8,borderBottom:'1px solid #233c45',color:tones.gold}}>{percentage(row.clicked,row.sent)}</td></tr>)}</tbody>
          </table></div><p style={{fontSize:10,color:tones.muted,margin:'8px 0 0'}}>*Non-proxy opens can still be automated. A click is not a verified appointment.</p>
        </section>
        <section style={{padding:16,borderRadius:10,background:'#10212e',border:'1px solid '+tones.border}}>
          <h3 style={{margin:'0 0 5px',fontSize:15,color:tones.purple}}>Recent Gmail actions</h3>
          <p style={{color:tones.muted,fontSize:11,margin:'0 0 11px'}}>Tracked events from sent Gmail messages only. No Fronter activity.</p>
          <div style={{maxHeight:350,overflow:'auto'}}>
            {view.feed.length===0 && <p style={{color:tones.muted,fontSize:12}}>No tracked activity in this period.</p>}
            {view.feed.slice(0,45).map(e=><div key={e.id} style={{padding:'9px 2px',borderBottom:'1px solid #27414b',fontSize:11,display:'flex',gap:8,alignItems:'center'}}>
              <span style={{fontSize:16}}>{e.eventType==='click'?'🔗':e.eventType==='open'?'◉':'◌'}</span>
              <div style={{minWidth:0,flex:1}}><button onClick={()=>showLead(e)} style={{background:'none',border:0,color:tones.text,textDecoration:'underline dotted',cursor:'pointer',padding:0,fontSize:12}}>{e.leadName}</button>
                <div style={{color:e.quality==='proxy_or_automated'?tones.muted:e.quality==='unverified_relay_click'?tones.gold:tones.teal}}>{e.eventType==='click'?'Tracked link · '+shortHost(e.url):e.eventType==='open'?'Open pixel':'Event'} {e.quality==='proxy_or_automated'?'· proxy/automated':e.quality==='unverified_relay_click'?'· relay, visitor unverified':''}</div></div>
              <span style={{color:tones.muted,whiteSpace:'nowrap'}}>{e.trackedAt?new Date(e.trackedAt).toLocaleDateString():''}</span>
            </div>)}
          </div>
        </section>
        <section style={{padding:16,borderRadius:10,background:'#10212e',border:'1px solid '+tones.border}}>
          <h3 style={{margin:'0 0 8px',fontSize:15,color:tones.teal}}>Leads to follow up with</h3>
          <EngagedLeadList leads={view.leads} system="coach" onOpenLead={showLead}/>
        </section>
        <section style={{padding:16,borderRadius:10,background:'#10212e',border:'1px solid '+tones.border}}>
          <h3 style={{margin:'0 0 8px',fontSize:15,color:tones.gold}}>Welcome page intelligence</h3>
          <p style={{fontSize:12,color:tones.muted}}>Audio listening and calendar interaction are available per recipient; the Google booking calendar does not reveal completed appointments directly.</p>
          {view.sends.filter(x=>x.audioPlays||x.calendarOpened||x.websiteClicked).sort((a,b)=>new Date(b.lastEventAt||b.sentAt)-new Date(a.lastEventAt||a.sentAt)).slice(0,16).map(m=><div key={m.sendId} style={{borderBottom:'1px solid #29424b',padding:'8px 0',display:'flex',gap:9,justifyContent:'space-between',fontSize:12}}>
            <button onClick={()=>showLead({leadId:m.contactId,name:m.contactName,onFile:!!(report.leadDirectory||{})[m.contactId]})} style={{background:'none',border:0,color:tones.text,textDecoration:'underline dotted',padding:0,cursor:'pointer',fontSize:12}}>{m.contactName||m.contactEmail}</button>
            <span style={{color:tones.teal}}>{m.audioPlays?m.audioBestPercent+'% audio':''}</span>
            <span style={{color:tones.gold}}>{m.calendarOpened?'Calendar opened':''}</span>
            <span style={{color:tones.blue}}>{m.websiteClicked?'Website clicked':''}</span>
          </div>)}
        </section>
      </div>
      <p style={{fontSize:10,color:tones.muted,marginTop:15}}>Scores combine tracked redirects with first-party playback and calendar actions. Redirects alone cannot confirm human browsing, intent, eligibility, or completed appointments. Notifications appear while this console is open.</p>
    </>}
    <EngagementContactCard target={card} username={user?.username} onClose={()=>setCard(null)}/>
  </div>;
}
