/**
 * Legacy Gmail Tracking
 * Separate, read-only analytics for the Gmail campaign/legacy records that
 * intentionally do not belong in the Debt Call Coach Gmail command center.
 */
import {useCallback,useEffect,useMemo,useState} from 'react';
import {base44} from '@/api/base44Client';
import {useDebtCoachAuth} from '@/lib/DebtCoachAuthContext';
import {
  Archive,ArrowUpRight,CalendarDays,CheckCircle2,Clock3,Eye,
  FileWarning,Link2,Mail,RefreshCcw,Search,Users, XCircle
} from 'lucide-react';
import './DebtLegacyEmailTracking.css';

const date=v=>v&&!Number.isNaN(new Date(v).getTime())
  ?new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})
  :'—';
const percent=(a,b)=>b?Math.round(a/b*100)+'%':'—';
const pretty=v=>String(v||'').trim();
const sourceLabel=v=>v==='Legacy Gmail Log'?'Historical Gmail log':'Gmail campaign';
const filters=[['all','All sends'],['opened','Opened*'],['clicked','Clicked'],['untracked','Missing send record']];
const ranges=[7,30,90,180,365];

function Stat({Icon,label,value,small}) {
  return <div className="dlg-stat"><div className="dlg-stat-label"><span>{label}</span><Icon size={15}/></div>
    <strong>{value??'—'}</strong><small>{small}</small></div>;
}
function TinyFlag({children,kind='neutral'}) {return <span className={'dlg-flag dlg-'+kind}>{children}</span>;}

export default function DebtLegacyEmailTracking() {
  const {isAdmin,sessionUserId,sessionToken}=useDebtCoachAuth();
  const [days,setDays]=useState(30);
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [campaign,setCampaign]=useState('all');
  const [selectedId,setSelectedId]=useState('');

  const refresh=useCallback(async(silent=false)=>{
    if(!isAdmin||!sessionUserId||!sessionToken)return;
    if(!silent)setRefreshing(true);
    try{
      const res=await base44.functions.invoke('sendDebtEmail',{
        action:'legacyGmailReport',days,sessionUserId,sessionToken
      });
      const report=res?.data||res||{};
      if(report.error)throw Error(report.error);
      setData(report);setError('');
    }catch(e){setError(e?.response?.data?.error||e?.message||'Could not load historical Gmail tracking.');}
    finally{setLoading(false);setRefreshing(false);}
  },[days,isAdmin,sessionUserId,sessionToken]);

  useEffect(()=>{
    setLoading(true);
    refresh(false);
    const interval=setInterval(()=>{if(document.visibilityState==='visible')refresh(true);},30000);
    return ()=>clearInterval(interval);
  },[refresh]);

  const all=useMemo(()=>data?.timeline||[],[data]);
  const campaigns=useMemo(()=>data?.campaigns||[],[data]);
  const shown=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return all.filter(row=>{
      if(campaign!=='all'&&row.campaign!==campaign)return false;
      if(filter==='opened'&&!row.opens)return false;
      if(filter==='clicked'&&!row.clicks)return false;
      if(filter==='untracked'&&row.hasGmailMessage)return false;
      return !q||[
        row.name,row.email,row.subject,row.templateName,row.campaign,row.sendId
      ].some(x=>pretty(x).toLowerCase().includes(q));
    });
  },[all,campaign,filter,search]);
  const selected=shown.find(r=>r.id===selectedId)||shown[0]||null;

  if(!isAdmin)return <div className="dlg-error">Legacy Gmail analytics require Debt Call Coach administrator access.</div>;
  const counts=data?.summary||{};
  return <section className="dlg-root" aria-label="Legacy Gmail tracking analytics">
    <header className="dlg-header">
      <div><div className="dlg-overline">Debt Call Coach · Historical Gmail</div>
        <h2><Archive size={22}/> Legacy Email Tracking</h2>
        <p>Separate analytics for earlier Gmail campaigns and historical Gmail follow-ups. The current Engagement Command Center remains untouched.</p>
      </div>
      <div className="dlg-head-actions">
        <div className="dlg-ranges" role="group" aria-label="Historical report range">
          {ranges.map(d=><button key={d} type="button" aria-pressed={days===d} onClick={()=>setDays(d)}>{d}d</button>)}
        </div>
        <button className="dlg-refresh" onClick={()=>refresh()} disabled={refreshing}><RefreshCcw size={14}/>{refreshing?'Refreshing…':'Refresh'}</button>
      </div>
    </header>
    {error&&<div className="dlg-error" role="alert"><XCircle size={16}/> {error}</div>}
    {data?.truncated&&Object.values(data.truncated).some(Boolean)&&<div className="dlg-warning" role="status">
      Some legacy sources reached their historical query limit. Shorten the date range before treating the totals as complete.
    </div>}
    <div className="dlg-metrics">
      <Stat Icon={Mail} label="Gmail sends" value={loading?'…':counts.sent??0}
        small="Distinct emails after matching send IDs"/>
      <Stat Icon={Eye} label="Opened*" value={loading?'…':counts.opened??0}
        small={percent(counts.opened,counts.sent)+' of recorded sends'}/>
      <Stat Icon={Link2} label="Link clicks" value={loading?'…':counts.clicked??0}
        small={percent(counts.clicked,counts.sent)+' of recorded sends'}/>
      <Stat Icon={Users} label="Recipients" value={loading?'…':counts.uniqueRecipients??0}
        small="Distinct email addresses"/>
      <Stat Icon={FileWarning} label="Older send-only rows" value={loading?'…':counts.sendRecordMissing??0}
        small="No corresponding newer Gmail message record"/>
    </div>
    <div className="dlg-note"><CheckCircle2 size={14}/><span>
      Gmail records only. Old opens and tracked redirects remain visible when recorded. Opens can be automated, and clicks do not prove that a person visited. There is no retroactive tracking for emails sent without a tracking pixel or redirect.
    </span></div>
    <div className="dlg-charts">
      <section className="dlg-section">
        <div className="dlg-section-head"><h3><CalendarDays size={15}/> Campaign performance</h3>
          <span>{campaigns.length} tracked groups</span></div>
        <div className="dlg-campaign-table-wrap">
          <table className="dlg-table"><thead><tr><th>Gmail campaign</th><th>Sent</th><th>Opened*</th><th>Clicked</th><th>Open rate*</th></tr></thead>
          <tbody>
            {campaigns.map(row=><tr key={row.name}>
              <td><button className="dlg-campaign-link" onClick={()=>setCampaign(c=>c===row.name?'all':row.name)} title="Filter the send list to this campaign">{row.name}<ArrowUpRight size={12}/></button></td>
              <td>{row.sent}</td><td>{row.opened}</td><td>{row.clicked}</td><td>{percent(row.opened,row.sent)}</td>
            </tr>)}
            {!campaigns.length&&<tr><td colSpan={5} className="dlg-blank">No legacy Gmail sends in this period.</td></tr>}
          </tbody></table>
        </div>
      </section>
      <section className="dlg-section">
        <div className="dlg-section-head"><h3><Clock3 size={15}/> Latest recorded activity</h3><span>{counts.openEvents||0} open requests · {counts.clickEvents||0} click requests</span></div>
        <div className="dlg-event-scroll">
          {(data?.events||[]).slice(0,28).map(e=><div className="dlg-event" key={e.id}>
            {e.type==='click'?<Link2 size={14}/>:<Eye size={14}/>}
            <div><strong>{e.name||e.email||'Recipient'}</strong><span>{e.type==='click'?'Link clicked'+(e.host?' · '+e.host:''):'Open pixel requested'}
              {e.quality==='proxy_or_relay'?' · automated/relay possible':''}</span></div>
            <time>{date(e.at)}</time>
          </div>)}
          {!data?.events?.length&&<div className="dlg-blank">No historical tracking events for these sends.</div>}
        </div>
      </section>
    </div>
    <div className="dlg-toolbar">
      <label className="dlg-search"><Search size={15}/><input placeholder="Search contact, email, campaign, subject or send ID…" aria-label="Search legacy emails" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <select aria-label="Filter by campaign" value={campaign} onChange={e=>setCampaign(e.target.value)}>
        <option value="all">All campaigns</option>{campaigns.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
      </select>
    </div>
    <div className="dlg-filterline" role="group" aria-label="Filter legacy send status">
      {filters.map(([value,label])=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}
    </div>
    <div className="dlg-workspace">
      <section className="dlg-section dlg-roster"><div className="dlg-section-head"><h3>Individual Gmail sends</h3><span>{shown.length} shown</span></div>
        <div className="dlg-roster-scroll">
          {loading&&!data?<div className="dlg-blank">Loading historical records…</div>:shown.map(row=><button
            key={row.id} aria-pressed={selected?.id===row.id} className="dlg-roster-row" onClick={()=>setSelectedId(row.id)}>
            <span className="dlg-roster-name">{row.name||row.email||'Unknown recipient'}<span>{date(row.sentAt)}</span></span>
            <span className="dlg-roster-subject">{row.subject||row.templateName||row.campaign}</span>
            <span className="dlg-roster-flags">
              {row.opens>0&&<TinyFlag kind="opened"><Eye size={11}/> {row.opens}</TinyFlag>}
              {row.clicks>0&&<TinyFlag kind="clicked"><Link2 size={11}/> {row.clicks}</TinyFlag>}
              {!row.hasGmailMessage&&<TinyFlag kind="missing">Older record</TinyFlag>}
            </span>
          </button>)}
          {!loading&&!shown.length&&<div className="dlg-blank">No sends match this search or filter.</div>}
        </div>
      </section>
      <section className="dlg-section dlg-detail" aria-label="Legacy email details">
        {!selected?<div className="dlg-blank">Choose an email on the left to see its historical tracking.</div>:<>
          <div className="dlg-detail-hero"><div className="dlg-overline">Historical send record</div>
            <h3>{selected.name||selected.email||'Recipient'}</h3>
            <p>{selected.email}</p>
            <div className="dlg-pills">
              <TinyFlag>{sourceLabel(selected.source)}</TinyFlag>
              {selected.hasGmailMessage?<TinyFlag kind="opened">Gmail message saved</TinyFlag>:<TinyFlag kind="missing">Older send record only</TinyFlag>}
            </div>
          </div>
          <div className="dlg-detail-grid">
            <div><span>Campaign</span><strong>{selected.campaign}</strong></div>
            <div><span>Template</span><strong>{selected.templateName}</strong></div>
            <div><span>Sent</span><strong>{date(selected.sentAt)}</strong></div>
            <div><span>Current status</span><strong>{selected.status||'sent'}</strong></div>
          </div>
          <div className="dlg-subject"><span>Subject</span><strong>{selected.subject||'Not saved on older record'}</strong></div>
          <div className="dlg-mini-metrics">
            <div><Eye size={17}/><strong>{selected.opens}</strong><span>Recorded opens*</span></div>
            <div><Link2 size={17}/><strong>{selected.clicks}</strong><span>Recorded clicks</span></div>
          </div>
          <div className="dlg-section-head dlg-event-title"><h3>Tracking timeline</h3><span>{selected.events.length} raw events</span></div>
          {selected.events.length?<div className="dlg-detail-events">
            {selected.events.map((e,i)=><div key={e.id||i} className="dlg-event">
              {e.type==='click'?<Link2 size={14}/>:<Eye size={14}/>}
              <div><strong>{e.type==='click'?'Tracked link redirect':'Open pixel'}</strong>
                <span>{e.host||''}{e.quality==='proxy_or_relay'?' · automated or relay request':''}</span>
              </div><time>{date(e.at)}</time>
            </div>)}
          </div>:<div className="dlg-blank">No raw tracking events for this send in the selected date window. Historical open/click flags may still be present on older records.</div>}
          {selected.leadId&&<div className="dlg-send-ref">Contact reference: {selected.leadId}</div>}
          {selected.sendId&&<div className="dlg-send-ref">Send ID: {selected.sendId}</div>}
        </>}
      </section>
    </div>
    <p className="dlg-footer">*An open means an email image was requested, not a confirmed human read. This page is read-only and does not change campaign sends, customer records or the modern Engagement Command Center.</p>
  </section>;
}
