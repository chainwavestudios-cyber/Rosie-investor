/**
 * Premium, accessible Gmail engagement journey cards.
 * Scope: Debt Call Coach's existing tracked Gmail templates only.
 */
import { useMemo, useState, useEffect } from 'react';
import { BadgeCheck, CalendarDays, Check, ChevronDown, Crown, ExternalLink, Headphones, Medal, Search, ShieldCheck, Sparkles, Star, TrendingUp } from 'lucide-react';
import { MILESTONE_FILTERS, matchesMilestoneFilter, compareEngagementPeople } from '@/lib/coachGmailMilestones';
import DebtGmailCompactRows from './DebtGmailCompactRows';

const colors = { gold:'#edc979', pale:'#f9e6b4', green:'#48d9a8', blue:'#83bfff', muted:'#97abb7', panel:'#111e2b', line:'rgba(157,192,199,.17)' };
const formatDate = (s) => s ? new Date(s).toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : 'No activity yet';
const safePct = (v) => Math.max(0, Math.min(100, Math.round(Number(v)||0)));
const journeyItems = [
  { key:'bbb', label:'BBB', detail:'BBB tracked link' },
  { key:'trustpilot', label:'Trustpilot', detail:'Trustpilot tracked link' },
  { key:'company', label:'Company site', detail:'Debt Advisors site tracked link' },
  { key:'calendar', label:'Calendar', detail:'Booking calendar opened, not booked' },
];

function JourneyChip({ item, checked }) {
  return <span title={item.detail + (checked ? ' recorded' : ' not recorded')}
    style={{ display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap', padding:'7px 10px', borderRadius:8,
      background:checked ? 'rgba(46,145,112,.14)' : 'rgba(106,127,145,.065)',
      border:'1px solid '+(checked ? 'rgba(72,217,168,.38)' : 'rgba(120,143,162,.14)'),
      color:checked ? '#7eecbf' : '#8294a3', fontSize:11, fontWeight:checked?720:520 }}>
    <span style={{ display:'inline-grid',placeItems:'center', width:15,height:15,borderRadius:5,
      border:'1px solid '+(checked ? '#65d9ab' : '#657785'),
      background:checked ? 'rgba(57,201,140,.18)' : 'transparent' }}>
      {checked ? <Check size={11} strokeWidth={3}/> : null}
    </span>
    {item.label}
  </span>;
}

function MilestoneBadge({ level }) {
  if (level === 'none') return null;
  const config = level === 'elite'
    ? { name:'ELITE JOURNEY', color:'#f5dfaa', border:'#d4a844', bg:'linear-gradient(110deg,#44320c,#725621 52%,#352607)', Icon:Crown }
    : level === 'all_signals'
    ? { name:'ALL LINKS + AUDIO', color:'#f0d5a0',border:'#a98d61',bg:'linear-gradient(110deg,#2c2834,#473b28,#242a2e)',Icon:Sparkles }
    : { name:'GOLD LISTENER',color:'#f6d999',border:'#c4a153',bg:'linear-gradient(110deg,#47320c,#342812)',Icon:Medal };
  const Icon = config.Icon;
  return <span className={level==='elite'?'cgj-badge cgj-badge-elite':'cgj-badge'} style={{
    display:'inline-flex',alignItems:'center',gap:6,padding:'6px 9px',borderRadius:99,color:config.color,
    fontSize:10,fontWeight:850,letterSpacing:'.9px',border:'1px solid '+config.border,background:config.bg,
    boxShadow:level==='elite'?'0 0 24px rgba(238,185,66,.23)':'0 0 12px rgba(230,186,83,.10)' }}>
    <Icon size={13}/>{config.name}
  </span>;
}

export function EngagementJourneyCard({ person, onOpen }) {
  const percent = safePct(person.percent);
  const fill = person.goldListener ? 'linear-gradient(90deg,#9b742c 0%,#e7b84b 58%,#ffe7a2 100%)'
    : percent>=75 ? 'linear-gradient(90deg,#176b68,#39d3b0)' : percent>=25 ? 'linear-gradient(90deg,#295d93,#62b5ef)' : '#455c6b';
  const featured = person.allLinksAndAudio;
  return <article className={'cgj-lead '+(featured?'cgj-featured':'')} style={{
    background: featured ? 'linear-gradient(115deg,rgba(52,41,25,.92),#131e2a 48%,#10272c)' : 'linear-gradient(125deg,#172534,#101b29)',
    border: '1px solid '+(featured ? 'rgba(224,179,80,.62)' : colors.line), borderRadius:13,
    padding:'clamp(14px,2vw,19px)', position:'relative', overflow:'hidden',
    boxShadow:featured?'0 8px 24px rgba(202,159,60,.10)':'0 6px 20px rgba(0,0,0,.11)',
  }}>
    {featured && <div className="cgj-shimmer" aria-hidden="true" style={{ position:'absolute',inset:0,pointerEvents:'none',opacity:.15,background:'linear-gradient(106deg, transparent 23%, rgba(255,228,165,.7) 45%,transparent 58%)' }}/>}
    <div style={{position:'relative',display:'grid',gridTemplateColumns:'minmax(175px,1.1fr) minmax(190px,1.4fr)',gap:'12px 20px',alignItems:'start'}}>
      <div style={{minWidth:0}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:10,flexWrap:'wrap'}}>
          <button type="button" onClick={()=>onOpen(person)} style={{fontSize:15,fontWeight:790,background:'none',color:'#f2f7f3',border:0,padding:0,textAlign:'left',cursor:'pointer',overflowWrap:'anywhere'}}>{person.name || person.email || 'Unknown contact'}</button>
          <MilestoneBadge level={person.milestone}/>
        </div>
        <div style={{fontSize:11,color:colors.muted,marginTop:5,overflowWrap:'anywhere'}}>{person.email||'No email on contact'}</div>
        <div style={{fontSize:10,color:'#809baa',marginTop:6}}>{person.lastTemplate || 'Gmail template'} · {person.sent} sent</div>
      </div>
      <div>
        <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'baseline',marginBottom:8}}>
          <span style={{fontSize:12,fontWeight:730,color:person.goldListener?colors.gold:'#b9d4d1',display:'inline-flex',alignItems:'center',gap:7}}><Headphones size={14}/> Audio playback</span>
          <strong style={{fontSize:19,color:person.goldListener?colors.pale:'#e1f4ee',fontVariantNumeric:'tabular-nums'}}>{percent}%</strong>
        </div>
        <div role="progressbar" aria-label={'Estimated audio played for '+(person.name||person.email)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
          style={{height:12,borderRadius:99,background:'#071923',border:'1px solid #36505d',padding:2,overflow:'hidden'}}>
          <div className={'cgj-progress '+(person.goldListener?'cgj-gold-fill':'')} style={{height:'100%',width:percent+'%',borderRadius:99,background:fill,boxShadow:person.goldListener?'0 0 15px rgba(252,206,86,.68)':'none'}}/>
        </div>
        <div style={{fontSize:10,color:'#859fa7',marginTop:7,display:'flex',justifyContent:'space-between',gap:7}}>
          <span>{person.goldListener ? (person.estimated ? 'Estimated full playback' : 'Completion event recorded') : percent>=75?'Strong listening activity':percent>0?'Playback recorded':'No playback recorded'}</span>
          <span style={{whiteSpace:'nowrap'}}>{person.audioPlays || 0} play starts</span>
        </div>
      </div>
      <div style={{gridColumn:'1 / -1',display:'flex',alignItems:'center',flexWrap:'wrap',gap:6}}>
        {journeyItems.map(item=><JourneyChip key={item.key} item={item} checked={!!person.flags?.[item.key]}/>)}
        {person.allLinksAndAudio && <span title="Full estimated audio playback and all three website links recorded" style={{fontSize:11,color:colors.gold,fontWeight:700,marginLeft:4}}><Sparkles size={13} style={{display:'inline-block',verticalAlign:'middle'}}/> Complete link journey</span>}
      </div>
      <div style={{gridColumn:'1 / -1',display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap',borderTop:'1px solid '+colors.line,paddingTop:12,marginTop:2}}>
        <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:11,color:colors.muted}}>Engagement <strong style={{color:person.score>=60?colors.gold:colors.green,fontSize:14}}>{person.score}/100</strong></span>
          <span style={{fontSize:10,color:'#8fa4af'}}>{formatDate(person.lastEngagementAt || person.lastAt)}</span>
          {person.eliteJourney && <span style={{color:colors.pale,fontSize:11,fontWeight:720}}><Star size={12} style={{display:'inline-block',verticalAlign:'middle'}}/> All milestones reached</span>}
        </div>
        <button type="button" onClick={()=>onOpen(person)} disabled={!person.leadId || !person.onFile}
          style={{background:'rgba(61,149,119,.14)',color:'#9dedd0',border:'1px solid rgba(83,195,149,.42)',borderRadius:7,padding:'8px 12px',fontSize:11,fontWeight:760,cursor:'pointer',opacity:!person.leadId||!person.onFile?.5:1}}>Open contact <ExternalLink size={12} style={{display:'inline-block',verticalAlign:'middle',marginLeft:4}}/></button>
      </div>
    </div>
  </article>;
}

export default function DebtGmailVisualJourney({ people = [], onOpen }) {
  const [filter,setFilter]=useState('all');
  const [search,setSearch]=useState('');
  const [sort,setSort]=useState('priority');
  const [layout,setLayout]=useState('list');
  const [limit,setLimit]=useState(12);
  const stats=useMemo(()=>({
    gold:people.filter(p=>p.goldListener).length,
    all:people.filter(p=>p.allLinksAndAudio).length,
    elite:people.filter(p=>p.eliteJourney).length,
    calendar:people.filter(p=>p.flags?.calendar).length,
  }),[people]);

  useEffect(()=>setLimit(12),[filter,search,sort]);
  const matching=useMemo(()=>{
    const term=search.toLowerCase().trim();
    return people.filter(p=>matchesMilestoneFilter(p,filter) && (!term || [p.name,p.email,p.lastTemplate].some(v=>String(v||'').toLowerCase().includes(term))))
      .sort((a,b)=>compareEngagementPeople(a,b,sort));
  },[people,filter,search,sort]);

  return <section aria-label="Contact engagement journeys" className="cgj-journeys" style={{margin:'18px 0 20px',background:'radial-gradient(ellipse at 93% -25%,rgba(218,168,65,.10),transparent 48%),linear-gradient(140deg,#0e1c29,#0b1821)',padding:'clamp(14px,2vw,23px)',borderRadius:15,border:'1px solid rgba(218,189,119,.24)'}}>
    <style>{`
      @keyframes cgj-sheen{from{transform:translateX(-130%)}to{transform:translateX(170%)}}
      @keyframes cgj-entry{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      .cgj-journeys .cgj-lead{animation:cgj-entry .36s both;transition:box-shadow .24s,border-color .24s}
      .cgj-journeys .cgj-lead:hover{border-color:rgba(225,193,120,.63)!important;box-shadow:0 12px 28px rgba(0,0,0,.22)!important}
      .cgj-journeys .cgj-featured .cgj-shimmer{animation:cgj-sheen 9s ease-in-out infinite}
      .cgj-journeys .cgj-progress{transition:width .6s ease}
      .cgj-journeys button:focus-visible,.cgj-journeys input:focus-visible,.cgj-journeys select:focus-visible{outline:2px solid #edc979;outline-offset:3px}
      @media(max-width:650px){.cgj-journeys .cgj-lead>div{grid-template-columns:minmax(0,1fr)!important}.cgj-journeys .cgj-lead>div>div{grid-column:1/-1!important}}
      @media(prefers-reduced-motion:reduce){.cgj-journeys *{animation:none!important;transition:none!important}}
    `}</style>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center',marginBottom:16}}>
      <div>
        <div style={{fontSize:10,letterSpacing:2.2,color:colors.gold,fontWeight:800}}>THE ENGAGEMENT JOURNEY</div>
        <h3 style={{font:'normal clamp(21px,3vw,27px) Georgia,serif',margin:'5px 0',color:'#f4eee1'}}>Every interaction, in one glance</h3>
        <div style={{fontSize:11,color:colors.muted}}>Estimated playback · recorded website redirects · calendar opens · account-level follow-up</div>
      </div>
      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
        {[
          ['Gold listeners',stats.gold,colors.gold,Medal,'gold'],
          ['All links + audio',stats.all,'#e7ba70',Sparkles,'all_signals'],
          ['Elite journeys',stats.elite,'#ffe4a6',Crown,'elite'],
          ['Calendar opens',stats.calendar,colors.green,CalendarDays,'calendar'],
        ].map(([name,count,tone,Icon,key])=><button type="button" key={key} onClick={()=>setFilter(key)} title={'Filter '+name} style={{border:'1px solid '+(filter===key?tone:colors.line),borderRadius:8,background:'#162531',padding:'8px 10px',color:tone,cursor:'pointer',display:'flex',alignItems:'center',gap:7}}>
          <Icon size={15}/><span style={{fontWeight:820,fontSize:17,fontVariantNumeric:'tabular-nums'}}>{count}</span><span style={{fontSize:10,color:'#afc2c5'}}>{name}</span>
        </button>)}
      </div>
    </div>
    <div style={{display:'flex',gap:9,flexWrap:'wrap',alignItems:'center',marginBottom:15}}>
      <label style={{position:'relative',minWidth:170,flex:'1 1 205px',maxWidth:400}}>
        <Search size={15} style={{position:'absolute',top:11,left:11,color:'#99b1b7'}}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a contact or email…" aria-label="Search engagement contacts" style={{padding:'10px 12px 10px 33px',width:'100%',boxSizing:'border-box',background:'#0a1a24',border:'1px solid #355265',borderRadius:8,color:'#e4f4ed',fontSize:12}}/>
      </label>
      <label style={{fontSize:11,color:colors.muted,display:'flex',alignItems:'center',gap:6}}>Sort
        <select value={sort} onChange={e=>setSort(e.target.value)} style={{background:'#0a1a24',border:'1px solid #355265',borderRadius:7,color:'#e3f2ef',padding:'9px 10px',fontSize:11}}>
          <option value="priority">Hot leads first</option><option value="recent">Latest activity</option><option value="audio">Audio progress</option><option value="score">Highest score</option>
        </select>
      </label>
      <span style={{fontSize:11,color:colors.muted}}>{matching.length} contact{matching.length===1?'':'s'}</span>
      <div role="group" aria-label="Engagement list display" style={{display:'flex',border:'1px solid #4a6a63',borderRadius:8,overflow:'hidden'}}>
        {[['list','Full list'],['cards','Cards']].map(([value,label])=><button key={value} type="button" aria-pressed={layout===value} onClick={()=>setLayout(value)} style={{cursor:'pointer',padding:'9px 12px',background:layout===value?'#345341':'#132532',color:layout===value?'#f5d99c':'#a8c5bd',fontSize:11,border:0,fontWeight:layout===value?800:600}}>{label}</button>)}
      </div>
    </div>
    <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:10,marginBottom:9}}>
      {MILESTONE_FILTERS.map(f=><button key={f.key} type="button" onClick={()=>setFilter(f.key)} aria-pressed={filter===f.key}
        style={{flexShrink:0,padding:'8px 11px',fontSize:11,fontWeight:filter===f.key?780:550,border:'1px solid '+(filter===f.key?'#d8b46d':'#294551'),borderRadius:99,background:filter===f.key?'#3b301e':'#12242c',color:filter===f.key?'#f6dba1':'#acc2c1',cursor:'pointer'}}>{f.label}</button>)}
    </div>
    {layout==='list' ? <DebtGmailCompactRows people={matching} onOpen={onOpen} title="All emailed contacts and engagement milestones"/>
      : <>
        {matching.length===0 ? <div style={{border:'1px dashed #39545f',borderRadius:10,padding:30,textAlign:'center',color:colors.muted,fontSize:12}}>No contacts match these filters. Try a different milestone or date range.</div>
          : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(475px,100%),1fr))',gap:12}}>{matching.slice(0,limit).map(p=><EngagementJourneyCard key={p.id} person={p} onOpen={onOpen}/>)}</div>}
        {matching.length>limit && <div style={{textAlign:'center',marginTop:16}}><button onClick={()=>setLimit(l=>l+12)} style={{cursor:'pointer',border:'1px solid #53756d',borderRadius:8,padding:'10px 20px',color:colors.gold,background:'#132b30',fontSize:12,fontWeight:720}}>Show more ({matching.length-limit} remaining) <ChevronDown size={14} style={{display:'inline-block',verticalAlign:'middle'}}/></button></div>}
      </>}
    <div style={{display:'flex',alignItems:'flex-start',gap:8,marginTop:16,color:'#879ea8',fontSize:10,lineHeight:1.6}}>
      <ShieldCheck size={14} style={{flexShrink:0,marginTop:1}}/>
      Full audio means an ended event or at least 98% estimated playback. Green website checkmarks represent tracked link redirects, not verified page reading. Calendar means opened, not booked. No AI agent is launched by this report.
    </div>
  </section>;
}
