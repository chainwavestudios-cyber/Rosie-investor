/**
 * Debt Call Coach Email Engagement — campaign-specific, read-only analytics.
 *
 * Only authenticated active Debt Call Coach admins can view. Data provenance:
 * EmailCampaignJob and EmailCampaignRecipient, with per-send tracking events
 * and EmailMessage delivery outcomes. Deliberately excludes Fronter, investor
 * email and unrelated providers. Legacy Gmail remains in its own report.
 *
 * This endpoint NEVER starts/sends/edits a campaign. In particular do not reuse
 * the CampaignMonitor component here: its automatic queue tick is destructive.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const PAGE = 100;
const SEARCH_CAP = 15000;
const str = (value: any, n = 240) => String(value ?? '').trim().slice(0,n);
const num = (value: any) => Number.isFinite(Number(value)) ? Number(value) : 0;
const items = (page:any):any[] => Array.isArray(page) ? page : (page?.items ?? page?.entities ?? []);
const response = (body:any, status=200) => Response.json(body,{status});
const time = (a:any) => new Date(a||0).getTime() || 0;
const safePath = (v:any) => { try { const url=new URL(String(v)); if(!/^https?:$/.test(url.protocol)) return ''; return url.host + url.pathname.slice(0,90); } catch { return ''; } };
const parseClicked = (raw:any) => { try { const data=JSON.parse(String(raw||'[]')); return Array.isArray(data)?data.slice(0,100).map((entry:any)=>({ link:safePath(entry?.url || entry?.href || entry), at:entry?.at||entry?.trackedAt||null })).filter((x:any)=>x.link):[]; } catch { return []; } };

async function authorize(base44:any, body:any){
 const sessionUserId=str(body?.sessionUserId,100);
 const sessionToken=str(body?.sessionToken,1000);
 if(!sessionUserId||!sessionToken)return false;
 const user=await base44.asServiceRole.entities.DebtCoachUser.get(sessionUserId).catch(()=>null);
 return !!user?.isActive && user.sessionToken===sessionToken && ['admin','super_admin'].includes(user.role);
}
function publicCampaign(c:any){
 return {
  id:c.id, name:c.name||'Untitled campaign', status:c.status||'draft',
  templateName:c.templateName||'', templateId:c.templateId||'',subject:c.subject||'',
  senderEmail:c.senderEmail||'',senderName:c.senderName||'', listName:c.listName||'',
  sourceFile:c.sourceFile||'', createdBy:c.createdBy||'',notes:c.notes||'',
  createdAt:c.created_date||'', updatedAt:c.updated_date||'',
  importedCount:num(c.importedCount),eligibleCount:num(c.eligibleCount),
  excludedCount:num(c.excludedCount),contactCreatedCount:num(c.contactCreatedCount),
  contactUpdatedCount:num(c.contactUpdatedCount), sentCount:num(c.sentCount),
  failedCount:num(c.failedCount), skippedCount:num(c.skippedCount),
  openCount:num(c.openCount),clickCount:num(c.clickCount),
  unsubscribedCount:num(c.unsubscribedCount),
  batchSize:num(c.batchSize),dailyLimit:num(c.dailyLimit),
  intervalSeconds:num(c.intervalSeconds),intervalMaxSeconds:num(c.intervalMaxSeconds),
  windowStart:c.windowStart||'',windowEnd:c.windowEnd||'',timezone:c.timezone||'',
  approvedAt:c.approvedAt||'',approvedBy:c.approvedBy||'',
  startedAt:c.startedAt||'',lastRunAt:c.lastRunAt||'',nextSendAt:c.nextSendAt||'',
  completedAt:c.completedAt||'',lastQueueName:c.lastQueueName||'',
  queuesJson:c.queuesJson||'[]'
 };
}
function publicRecipient(r:any){
 return {
   id:r.id, campaignId:r.campaignId,
   name:[r.firstName||'',r.lastName||''].join(' ').trim()||r.email||'Recipient',
   email:r.email||'',phone:r.phone||'',status:r.status||'pending',
   leadId:r.leadId||'',cardMatched:!!r.cardMatched,
   subject:r.subject||'',sendId:r.sendId||'',messageId:r.messageId||'',
   sentAt:r.sentAt||'',openedAt:r.openedAt||'',openCount:num(r.openCount),
   clickedAt:r.clickedAt||'',clickCount:parseClicked(r.clickedUrlsJson).length,
   qualifyVisitAt:r.qualifyVisitAt||'',unsubscribedAt:r.unsubscribedAt||'',
   reason:r.reason||'',error:r.error||'',links:parseClicked(r.clickedUrlsJson)
 };
}
function matches(r:any,q:string){
 const fields=[r.name,r.email,r.phone,r.subject,r.sendId,r.status,r.error,r.reason];
 return fields.some((x:any)=>String(x||'').toLowerCase().includes(q));
}
export default async function(req:Request):Promise<Response>{
 try{
  if(req.method!=='POST')return response({error:'POST required'},405);
  const body=await req.json().catch(()=>({}));
  const base44=createClientFromRequest(req);
  if(!await authorize(base44,body))return response({error:'Debt Call Coach administrator authentication required.'},403);
  const db=base44.asServiceRole.entities;
  const mode=str(body.mode,35)||'list';
  const cursor=str(body.cursor,2000);
  if(mode==='list'){
    const page=await db.EmailCampaignJob.filter({},{
       sort:'-created_date',limit:PAGE,...(cursor?{cursor}:{})
    });
    const records=items(page).map(publicCampaign);
    return response({
       mode:'list',campaigns:records, nextCursor:page?.next_cursor||null,
       hasMore:!!(page?.has_more || page?.next_cursor),
       generatedAt:new Date().toISOString()
    });
  }

  const campaignId=str(body.campaignId,100);
  if(!campaignId)return response({error:'A campaign ID is required'},400);
  const raw=await db.EmailCampaignJob.get(campaignId).catch(()=>null);
  if(!raw)return response({error:'Campaign not found.'},404);

  if(mode==='detail'){
    const safeCount=async(filter:any)=>db.EmailCampaignRecipient.count({campaignId,...filter}).catch(()=>null);
    const [total,pending,sent,failed,skipped,uniqueOpened,uniqueClicked,uniqueVisited,unsubscribed]=await Promise.all([
      safeCount({}),safeCount({status:'pending'}),safeCount({status:'sent'}),safeCount({status:'failed'}),
      safeCount({status:'skipped'}),safeCount({openedAt:{$ne:null}}),
      safeCount({clickedAt:{$ne:null}}),safeCount({qualifyVisitAt:{$ne:null}}),
      safeCount({unsubscribedAt:{$ne:null}})
    ]);
    return response({
      mode, campaign:publicCampaign(raw),
      breakdown:{total,pending,sent,failed,skipped,uniqueOpened,uniqueClicked,uniqueVisited,unsubscribed},
      note:'Counts are sourced from the campaign and recipient records. Recorded open/click events do not establish a human read.',
      generatedAt:new Date().toISOString()
    });
  }

  if(mode==='recipients'){
    const status=['pending','sent','failed','skipped'].includes(body.status)?String(body.status):'all';
    const q=str(body.search,180).toLowerCase();
    const pageSize= Math.min(150,Math.max(20,num(body.limit)||75));
    const baseFilter:any={campaignId,...(status!=='all'?{status}:{})};
    if(!q){
      const page=await db.EmailCampaignRecipient.filter(baseFilter,{
        sort:'-created_date',limit:pageSize,...(cursor?{cursor}:{})
      });
      return response({
        mode,recipients:items(page).map(publicRecipient),
        nextCursor:page?.next_cursor||null,hasMore:!!(page?.has_more||page?.next_cursor),
        searchLimited:false,generatedAt:new Date().toISOString()
      });
    }
    // Base44's RLS-compatible filter API does not guarantee full-text search,
    // so perform a bounded, deterministic server-side scan for this campaign.
    let scanCursor:string|null=null;
    let scanned=0;
    const found:any[]=[];
    let exhausted=false;
    const offset=Math.min(10000,Math.max(0,num(body.offset)||0));
    while(scanned<SEARCH_CAP && found.length<offset+pageSize+1){
      const page=await db.EmailCampaignRecipient.filter(baseFilter,{
        sort:'-created_date',limit:200,...(scanCursor?{cursor:scanCursor}:{})
      });
      const rows=items(page);
      scanned+=rows.length;
      for(const r of rows){
        const safe=publicRecipient(r);
        if(matches(safe,q))found.push(safe);
      }
      scanCursor=page?.next_cursor||null;
      if(!scanCursor||!rows.length){exhausted=true;break;}
    }
    return response({
      mode, recipients:found.slice(offset,offset+pageSize),
      nextOffset:offset+pageSize<found.length ? offset+pageSize : null,
      hasMore:offset+pageSize<found.length || !exhausted,
      searchLimited:scanned>=SEARCH_CAP&&!exhausted,
      scanned,generatedAt:new Date().toISOString()
    });
  }

  if(mode==='recipientDetail'){
    const recipientId=str(body.recipientId,100);
    if(!recipientId)return response({error:'Recipient ID required'},400);
    const rawRecipient=await db.EmailCampaignRecipient.get(recipientId).catch(()=>null);
    if(!rawRecipient || String(rawRecipient.campaignId)!==campaignId)
      return response({error:'Recipient not found for this campaign'},404);
    const recipient=publicRecipient(rawRecipient);
    const sendId=str(rawRecipient.sendId,150);
    let events:any[]=[];
    let message:any=null;
    if(sendId){
      const [eventPage,messagePage]=await Promise.all([
        db.EmailTrackingEvent.filter({sendId},{sort:'-trackedAt',limit:150}).catch(()=>null),
        db.EmailMessage.filter({sendId},{limit:10}).catch(()=>null)
      ]);
      events=items(eventPage).filter((e:any)=> !recipient.leadId || !e.leadId || String(e.leadId)===String(recipient.leadId))
        .map((e:any)=>({id:e.id,type:e.eventType,at:e.trackedAt||e.created_date,
          link:e.eventType==='click'?safePath(e.url):'',quality:/googleimageproxy|ggpht|proofpoint|barracuda|mimecast|crawler|spider|headless|linkpreview/i.test(String(e.userAgent||''))?'automated_or_proxy_possible':'unverified'}));
      const found=items(messagePage).find((m:any)=>m.sendId===sendId&&m.source==='campaign');
      if(found)message={
        status:found.status||'',repliedAt:found.repliedAt||'',bouncedAt:found.bouncedAt||'',
        bounceReason:found.bounceReason||'',unsubscribedAt:found.unsubscribedAt||'',
        openedAt:found.openedAt||'',clickedAt:found.clickedAt||''
      };
    }
    return response({mode,recipient,message,events,generatedAt:new Date().toISOString()});
  }

  return response({error:'Unknown report action.'},400);
 }catch(e:any){
    console.error('[debtEmailCampaignView]',e instanceof Error?e.message:'Unexpected report error');
    return response({error:'Could not load the campaign report.'},500);
 }
}
