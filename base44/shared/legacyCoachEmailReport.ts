/**
 * Legacy Gmail analytics for the Email Campaign Manager.
 *
 * A separate read-only dataset from Debt Call Coach's modern command center:
 * - EmailCampaignJob + EmailCampaignRecipient (Gmail campaign queue)
 * - EmailMessage with campaign source (universal Gmail sender)
 * - Gmail-only EmailLog for old send history / cross-check, never add overlaps
 * - EmailTrackingEvent joined by sendId (actual recorded opens and clicks)
 *
 * Never read SMTPfast webhook data, Mailjet, investor sends or Fronter email.
 * No edits/backfills to past records; missing pixel/redirect cannot be invented.
 */
const MAX=5000;
const PAGE=200;
const rows=(response:any):any[]=>Array.isArray(response)?response:response?.items||[];
const str=(value:any)=>String(value??'').trim();
const ms=(value:any)=>new Date(value||0).getTime()||0;
const num=(value:any)=>Math.max(0,Number(value)||0);
const bot=(ua:any)=>/ggpht\.com|googleimageproxy|googlebot|bingbot|crawler|spider|headless|linkpreview|proofpoint|barracuda|mimecast|safe.?links|urlscan|base44-backend/i.test(str(ua).toLowerCase());

async function all(entity:any,filter:any,sort:string) {
  const out:any[]=[]; let cursor:string|null=null;
  while(out.length<MAX){
    const args:any={sort,limit:Math.min(PAGE,MAX-out.length)};
    if(cursor)args.cursor=cursor;
    const response=await entity.filter(filter,args);
    const current=rows(response);
    out.push(...current);
    cursor=Array.isArray(response)?null:response?.next_cursor||null;
    if(!cursor||!current.length)break;
  }
  return {items:out,truncated:out.length>=MAX};
}
function normalizeEmail(email:any){return str(email).toLowerCase();}
function cleanUrl(value:any) {
  try{const u=new URL(str(value));return /^https?:$/.test(u.protocol)?u.hostname.replace(/^www\./,''):'';}catch{return '';}
}
export default async function legacyCoachEmailReport(base44:any, body:any):Promise<Response> {
  try{
    const id=str(body.sessionUserId),token=str(body.sessionToken);
    if(!id||!token)return Response.json({error:'Authorization required'}, {status:401});
    const user=await base44.asServiceRole.entities.DebtCoachUser.get(id).catch(()=>null);
    if(!user?.isActive||user.mustResetPassword||user.sessionToken!==token||!['admin','super_admin'].includes(user.role))
      return Response.json({error:'Legacy analytics are restricted to Debt Call Coach administrators'}, {status:403});

    const days=[7,30,90,180,365].includes(Number(body.days))?Number(body.days):30;
    const since=new Date(Date.now()-days*86400000).toISOString();
    const svc=base44.asServiceRole.entities;
    const [jobPage,recipientPage,messagePage,logPage,eventPage]=await Promise.all([
      all(svc.EmailCampaignJob,{},'-created_date'),
      all(svc.EmailCampaignRecipient,{sentAt:{$gte:since}},'-sentAt'),
      all(svc.EmailMessage,{created_date:{$gte:since},source:'campaign'},'-created_date'),
      all(svc.EmailLog,{sentAt:{$gte:since}},'-sentAt'),
      all(svc.EmailTrackingEvent,{trackedAt:{$gte:since}},'-trackedAt'),
    ]);

    // Only campaigns created in this app's Gmail campaign manager qualify.
    // Other sending systems do not create EmailCampaignJob rows.
    const jobs=new Map(jobPage.items.map((j:any)=>[str(j.id),j]));
    const recipients=recipientPage.items.filter((r:any)=>
      jobs.has(str(r.campaignId))&&r.status==='sent'&&!!r.sentAt);
    const campaignMessages=messagePage.items.filter((m:any)=>
      m.source==='campaign'&&m.contactKind==='lead'&&m.status==='sent'&&!!m.sentAt&&!m.unsentAt);
    const bySend=new Map(campaignMessages.map((m:any)=>[str(m.sendId),m]));
    const byMessageId=new Map(campaignMessages.filter((m:any)=>m.messageId).map((m:any)=>[str(m.messageId),m]));
    const gmailLogs=logPage.items.filter((l:any)=>str(l.fromEmail).toLowerCase()==='gmail');
    const logBySend=new Map(gmailLogs.filter((l:any)=>l.sendId).map((l:any)=>[str(l.sendId),l]));
    const logByMessage=new Map(gmailLogs.filter((l:any)=>l.messageId).map((l:any)=>[str(l.messageId),l]));
    const eventsBySend=new Map<string,any[]>();
    for(const e of eventPage.items) {
      const send=str(e.sendId);
      if(!send)continue;
      const list=eventsBySend.get(send)||[];
      list.push(e);
      eventsBySend.set(send,list);
    }

    const used=new Set<string>();
    const timeline:any[]=[];
    function add(candidate:any) {
      const id=str(candidate.sendId) || (candidate.messageId?'gmail:'+str(candidate.messageId):'row:'+str(candidate.id));
      if(used.has(id))return;
      used.add(id);
      const evs=eventsBySend.get(str(candidate.sendId))||[];
      const openEvents=evs.filter(e=>e.eventType==='open');
      const clickEvents=evs.filter(e=>e.eventType==='click');
      // One send remains one row even if EmailMessage, EmailLog and recipient
      // each have their own copy of the open/click counters.
      const recordedOpens=Math.max(openEvents.length,num(candidate.openCount),candidate.openedAt?1:0);
      const recordedClicks=Math.max(clickEvents.length,num(candidate.clickCount),candidate.clickedAt?1:0);
      const sentAt=candidate.sentAt||'';
      if(!sentAt||ms(sentAt)<ms(since))return;
      timeline.push({
        id,sendId:str(candidate.sendId),leadId:str(candidate.leadId||candidate.contactId),
        name:str(candidate.name||candidate.contactName)||'Unnamed recipient',
        email:str(candidate.email||candidate.contactEmail),
        phone:str(candidate.phone),
        subject:str(candidate.subject),templateName:str(candidate.templateName)||'Unlabeled template',
        campaign:str(candidate.campaign)||'Legacy Gmail',source:candidate.source,
        provider:'gmail',sentAt,status:str(candidate.status)||'sent',
        hasGmailMessage:!!candidate.hasGmailMessage,
        hasSendId:!!candidate.sendId,
        opens:recordedOpens,clicks:recordedClicks,
        firstOpenAt:candidate.openedAt||openEvents[openEvents.length-1]?.trackedAt||null,
        firstClickAt:candidate.clickedAt||clickEvents[clickEvents.length-1]?.trackedAt||null,
        proxyOpens:openEvents.filter(e=>bot(e.userAgent)).length,
        // These are real pixel/redirect requests, but not human-read proof.
        events:evs.map(e=>({id:e.id,type:e.eventType,at:e.trackedAt,host:cleanUrl(e.url),
          quality:bot(e.userAgent)?'proxy_or_relay':'unverified'})),
      });
    }

    // The recipient queue is the source of truth for 1 row per campaign send.
    // This intentionally includes older rows with no EmailMessage (their
    // send/status may exist even if the newer send record is absent).
    for(const r of recipients) {
      const j=jobs.get(str(r.campaignId));
      const m=bySend.get(str(r.sendId))||byMessageId.get(str(r.messageId));
      const log=logBySend.get(str(r.sendId))||logByMessage.get(str(r.messageId));
      add({
        id:r.id,sendId:r.sendId,messageId:r.messageId||m?.messageId,
        leadId:r.leadId||m?.contactId,
        name:[r.firstName,r.lastName].filter(Boolean).join(' ')||m?.contactName,
        email:r.email||m?.contactEmail,phone:r.phone,
        subject:r.subject||m?.subject||log?.subject,
        templateName:m?.templateName||j?.templateName||log?.templateName,
        campaign:j?.name||r.campaignName||'Gmail campaign',
        sentAt:r.sentAt||m?.sentAt,status:r.status,
        source:'Gmail Campaign',hasGmailMessage:!!m,
        openCount:Math.max(num(r.openCount),num(m?.openCount)),
        clickCount:Math.max(num(m?.clickCount),r.clickedAt?1:0),
        openedAt:r.openedAt||m?.openedAt||log?.openedAt,
        clickedAt:r.clickedAt||m?.clickedAt||log?.clickedAt
      });
    }

    // Should a legacy Gmail campaign message survive but its recipient row
    // be missing, include only when it carries an explicit campaign provenance.
    for(const m of campaignMessages) {
      add({ ...m,id:m.id,leadId:m.contactId,name:m.contactName,email:m.contactEmail,
        campaign:'Gmail campaign · send record',source:'Gmail Campaign',
        hasGmailMessage:true,openedAt:m.openedAt,clickedAt:m.clickedAt });
    }

    // Gmail-only historical logs that do NOT overlap with campaign/new Gmail
    // sends stay in a separate provenance group, never added to campaign totals.
    const allMessageIds=new Set(messagePage.items.filter((m:any)=>m.messageId).map((m:any)=>str(m.messageId)));
    const campaignSendIds=new Set([...recipients.map((r:any)=>str(r.sendId)),...campaignMessages.map((m:any)=>str(m.sendId))]);
    for(const log of gmailLogs) {
      if((log.sendId&&campaignSendIds.has(str(log.sendId)))||
         (log.messageId&&allMessageIds.has(str(log.messageId))))continue;
      add({
        id:log.id,sendId:log.sendId,messageId:log.messageId,
        leadId:log.leadId,name:log.toName,email:log.toEmail,
        subject:log.subject,templateName:log.templateName,
        campaign:'Legacy Gmail follow-up',source:'Legacy Gmail Log',
        sentAt:log.sentAt,status:log.status,
        hasGmailMessage:false,openedAt:log.openedAt,clickedAt:log.clickedAt
      });
    }

    timeline.sort((a,b)=>ms(b.sentAt)-ms(a.sentAt));
    const byCampaign=new Map<string,any>();
    const recentEvents:any[]=[];
    for(const r of timeline) {
      const bucket=byCampaign.get(r.campaign)||{name:r.campaign,sent:0,opened:0,clicked:0,sendRecordMissing:0,lastSentAt:null};
      bucket.sent++;
      if(r.opens)bucket.opened++;
      if(r.clicks)bucket.clicked++;
      if(!r.hasGmailMessage)bucket.sendRecordMissing++;
      if(ms(r.sentAt)>ms(bucket.lastSentAt))bucket.lastSentAt=r.sentAt;
      byCampaign.set(r.campaign,bucket);
      for(const e of r.events)recentEvents.push({
        ...e,sendId:r.sendId,leadId:r.leadId,name:r.name,email:r.email,campaign:r.campaign
      });
    }
    recentEvents.sort((a,b)=>ms(b.at)-ms(a.at));
    return Response.json({
      scope:'legacy_gmail_only', days,generatedAt:new Date().toISOString(),
      sourceNote:'Gmail campaign recipients and Gmail-only legacy send logs. Excludes all other providers and the modern Debt Call Coach command center.',
      truncated:{jobs:jobPage.truncated,recipients:recipientPage.truncated,
        messages:messagePage.truncated,logs:logPage.truncated,events:eventPage.truncated},
      summary:{
        sent:timeline.length,
        opened:timeline.filter(x=>x.opens>0).length,
        clicked:timeline.filter(x=>x.clicks>0).length,
        trackedMessageRows:timeline.filter(x=>x.hasGmailMessage).length,
        sendRecordMissing:timeline.filter(x=>!x.hasGmailMessage).length,
        uniqueRecipients:new Set(timeline.map(x=>normalizeEmail(x.email)).filter(Boolean)).size,
        openEvents:recentEvents.filter(x=>x.type==='open').length,
        clickEvents:recentEvents.filter(x=>x.type==='click').length,
      },
      campaigns:[...byCampaign.values()].sort((a,b)=>b.sent-a.sent),
      timeline,events:recentEvents.slice(0,250)
    });
  } catch(e:any){
    console.error('[legacyCoachEmailReport]',e?.message||String(e));
    return Response.json({error:'Could not load legacy Gmail reporting'}, {status:500});
  }
}
