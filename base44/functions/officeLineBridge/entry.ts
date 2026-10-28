/**
 * Office Main Line Bridge — authenticated, owner-scoped two-leg conference.
 * Phases: call office -> call customer held/muted -> explicit merge -> hangup.
 * A signed session token binds the lead, operator, conference, and call SIDs;
 * the public browser never receives Twilio API credentials.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { twilioFetch, toE164, xmlEscape, ACCOUNT_SID, AUTH_TOKEN, findConferenceSid } from '../../shared/twilioHelpers.ts';
import { checkCallCutoff } from '../../shared/phoneTimeZone.ts';

const OFFICE = toE164(Deno.env.get('OFFICE_MAIN_LINE') || '+16193530919');
const FROM = toE164(Deno.env.get('TWILIO_FROM_NUMBER') || '');
const base64 = (data:string) => btoa(data).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const keyPromise = crypto.subtle.importKey('raw',new TextEncoder().encode(AUTH_TOKEN),'HMAC',{hash:'SHA-256'},false,['sign','verify']);
async function sign(data:any):Promise<string> {
  const p = base64(JSON.stringify(data));
  const digest = await crypto.subtle.sign('HMAC',await keyPromise,new TextEncoder().encode(p));
  return p+'.'+base64(String.fromCharCode(...new Uint8Array(digest)));
}
async function verify(token:string):Promise<any|null> {
  const [p,signature] = String(token||'').split('.');
  if (!p||!signature||p.length>3000) return null;
  try {
    const raw=atob(signature.replace(/-/g,'+').replace(/_/g,'/'));
    const digest=Uint8Array.from(raw,c=>c.charCodeAt(0));
    const valid=await crypto.subtle.verify('HMAC',await keyPromise,digest,new TextEncoder().encode(p));
    if(!valid)return null;
    const data=JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));
    if(data.v!==1||!data.createdAt||Date.now()-data.createdAt>2*HOUR||data.createdAt>Date.now()+60000)return null;
    return data;
  }catch{return null;}
}
async function statusOf(sid:string) {
  if(!/^CA[a-fA-F0-9]{32}$/.test(sid||''))return 'unknown';
  const r=await twilioFetch('/Calls/'+sid+'.json');
  return r.status||'unknown';
}
async function verifyUser(service:any,body:any) {
  if (!body.sessionUserId||!body.sessionToken)return null;
  const user=await service.entities.DebtCoachUser.get(body.sessionUserId).catch(()=>null);
  return user?.isActive&&!user.mustResetPassword&&user.sessionToken===body.sessionToken?user:null;
}
const respond=(data:any,status=200)=>Response.json(data,{status});
export default async function(req:Request):Promise<Response>{
  if(req.method!=='POST')return respond({error:'Method not allowed'},405);
  try {
    if(!ACCOUNT_SID||!AUTH_TOKEN||!/^\+[1-9]\d{7,14}$/.test(FROM))return respond({error:'Twilio outbound caller ID is not configured'},503);
    const body=await req.json();
    const service=createClientFromRequest(req).asServiceRole;
    const user=await verifyUser(service,body);
    if(!user)return respond({error:'Unauthorized'},401);
    const action=String(body.action||'');
    const lead=await service.entities.DebtLead.get(body.leadId).catch(()=>null);
    if(!lead||lead.deletedAt)return respond({error:'Contact not found'},404);
    if(user.role==='dialer'&&lead.debtCoachOwner!==user.username)return respond({error:'Not assigned to this contact'},403);
    if(!['start','status','contact','merge','end'].includes(action))return respond({error:'Unknown action'},400);
    if(action==='start'){
      // This is a single dedicated office line, not a generic tenant dialer.
      // Require elevated rights until individual per-user office lines exist.
      if(!['super_admin','admin'].includes(user.role)) return respond({error:'Office main line is restricted to administrators'},403);
      if(body.bridgeToken)return respond({error:'Office session already supplied'},400);
      if(!/^\+1\d{10}$/.test(OFFICE))return respond({error:'Office line must be configured'},503);
      const bridgeId='office_'+crypto.randomUUID().replace(/-/g,'');
      const xml='<Response><Dial><Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="true">'+xmlEscape(bridgeId)+'</Conference></Dial></Response>';
      const call=await twilioFetch('/Calls.json',{method:'POST',body:new URLSearchParams({
        From:FROM,To:OFFICE,Twiml:xml,Timeout:'28'
      })});
      const data={v:1,leadId:lead.id,userId:user.id,bridgeId,officeSid:call.sid,createdAt:Date.now(),clientSid:''};
      return respond({ok:true,bridgeToken:await sign(data),monitorToken:await sign({v:1,leadId:lead.id,userId:user.id,bridgeId,createdAt:data.createdAt,monitor:true}),
        bridgeId,officeStatus:call.status||'queued',officeNumber:OFFICE});
    }
    const data=await verify(String(body.bridgeToken||''));
    if(!data||data.userId!==user.id||data.leadId!==lead.id||!/^office_[a-f0-9]{32}$/.test(data.bridgeId||''))
      return respond({error:'Invalid or expired office session'},403);
    const officeStatus=await statusOf(data.officeSid);
    const conferenceSid=officeStatus==='in-progress'?await findConferenceSid(data.bridgeId):null;
    const clientStatus=data.clientSid?await statusOf(data.clientSid):'not_called';
    const clientAnswered=clientStatus==='in-progress';
    const participantPath=conferenceSid&&data.clientSid?'/Conferences/'+conferenceSid+'/Participants/'+data.clientSid+'.json':'';
    let participant:any=null;
    if(participantPath&&clientAnswered) participant=await twilioFetch(participantPath).catch(()=>null);
    const merged=clientAnswered&&!!participant;
    if(action==='status')return respond({ok:true,officeStatus,clientStatus,clientAnswered,merged,conferenceReady:!!conferenceSid,
      officeNumber:OFFICE,clientName:[lead.firstName,lead.lastName].filter(Boolean).join(' ')});
    if(action==='contact'){
      if(data.clientSid)return respond({error:'Customer already dialed. End the bridge before starting another customer call.'},409);
      if(officeStatus!=='in-progress'||!conferenceSid)return respond({error:'Connect and answer the office line first.'},409);
      const to=toE164(lead.phone||'');
      if(!/^\+[1-9]\d{7,14}$/.test(to))return respond({error:'Customer phone number is missing or invalid'},400);
      const cutoff=checkCallCutoff(to);
      if(cutoff.blocked)return respond({error:'Outbound customer calls are restricted to 8 AM–8 PM in their time zone.'},403);
      // The customer waits in their OWN unstarted conference. This is a hard
      // isolation boundary: no office participant can hear them before Merge.
      // An active office conference plus a muted customer in that same room
      // would still let the customer hear the office conversation.
      const waitRoom='office_wait_'+data.bridgeId.slice('office_'.length);
      const holdTwiML='<Response><Dial><Conference beep="false" startConferenceOnEnter="false" endConferenceOnExit="false">'+xmlEscape(waitRoom)+'</Conference></Dial></Response>';
      const call=await twilioFetch('/Calls.json',{method:'POST',body:new URLSearchParams({
        From:FROM,To:to,Twiml:holdTwiML,Timeout:'30'
      })});
      const next={...data,clientSid:call.sid,mergedRequested:false};
      return respond({ok:true,bridgeToken:await sign(next),officeStatus,clientStatus:call.status||'queued',clientAnswered:false,merged:false});
    }
    if(action==='merge'){
      if(officeStatus!=='in-progress'||!conferenceSid||!data.clientSid||!clientAnswered)return respond({error:'Both office and customer lines must be connected before merge.'},409);
      if(merged)return respond({ok:true,merged:true,bridgeToken:body.bridgeToken});
      if(data.mergedRequested)return respond({error:'Merge is already in progress. Check the office conference before retrying.'},409);
      // Only an explicit operator Merge moves the customer from the isolated
      // waiting conference into the active office conference.
      const joinTwiML='<Response><Dial><Conference beep="false" startConferenceOnEnter="false" endConferenceOnExit="false">'+xmlEscape(data.bridgeId)+'</Conference></Dial></Response>';
      await twilioFetch('/Calls/'+data.clientSid+'.json',{method:'POST',body:new URLSearchParams({Twiml:joinTwiML})});
      await service.entities.LeadHistory.create({leadId:lead.id,type:'call',
        content:'Office main-line conference merged with customer via Debt Call Coach',createdBy:user.username,twilioCallSid:data.clientSid}).catch(()=>{});
      return respond({ok:true,merged:true,bridgeToken:await sign({...data,mergedRequested:true})});
    }
    if(action==='end'){
      if(data.clientSid&&['queued','initiated','ringing','in-progress'].includes(clientStatus))
        await twilioFetch('/Calls/'+data.clientSid+'.json',{method:'POST',body:new URLSearchParams({Status:'completed'})}).catch(()=>{});
      if(['queued','initiated','ringing','in-progress'].includes(officeStatus))
        await twilioFetch('/Calls/'+data.officeSid+'.json',{method:'POST',body:new URLSearchParams({Status:'completed'})}).catch(()=>{});
      return respond({ok:true,ended:true});
    }
    return respond({error:'Unsupported'},400);
  }catch(e:any){console.error('[officeLineBridge]',e?.message);return respond({error:e?.message||'Office bridge failed'},500);}
}
