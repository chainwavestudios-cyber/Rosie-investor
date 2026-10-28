/**
 * Scoped LiveKit audio-room admission for consented BOB training.
 * Audio is accessible ONLY to an authenticated trainee of the session and
 * organization managers the trainee explicitly allowed to monitor.
 * Manager publish permission ("coach talk-in") requires a second opt-in.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
const bad=(message:string,status=400)=>Response.json({error:message},{status});
const clean=(value:unknown,max=120)=>String(value??'').trim().slice(0,max);
const toB64=(s:Uint8Array)=>btoa(String.fromCharCode(...s)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function token(key:string,secret:string,identity:string,room:string,publish:boolean){
 const stamp=Math.floor(Date.now()/1000),e=new TextEncoder();
 const header=toB64(e.encode(JSON.stringify({alg:'HS256',typ:'JWT'})));
 const payload=toB64(e.encode(JSON.stringify({iss:key,sub:identity,nbf:stamp-5,iat:stamp,exp:stamp+900,
  video:{room,roomJoin:true,canPublish:publish,canSubscribe:true,canPublishData:false,
   canPublishSources:publish?['microphone']:[]}})));
 const value=header+'.'+payload;
 const hmac=await crypto.subtle.importKey('raw',e.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=toB64(new Uint8Array(await crypto.subtle.sign('HMAC',hmac,e.encode(value))));
 return value+'.'+signature;
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return bad('POST required.',405);
 try{
  const base44=createClientFromRequest(req),user=await base44.auth.me().catch(()=>null);
  const email=clean(user?.email,255).toLowerCase();if(!email)return bad('Authentication required.',401);
  const data=await req.json();
  const orgId=clean(data.organizationId,100),id=clean(data.presenceId,120),mode=data.mode;
  const db=base44.asServiceRole.entities;
  const [org,presence,members]=await Promise.all([
    db.BOBOrganization.get(orgId).catch(()=>null),db.BOBPresence.get(id).catch(()=>null),
    db.BOBMember.filter({organizationId:orgId,email})
  ]);
  const membership=(members||[]).find((m:any)=>m.status==='active');
  if(!org||!membership||!presence||presence.organizationId!==orgId)return bad('No access to this session.',403);
  if(org.allowLiveMonitoring!==true)return bad('This organization disabled live monitoring.',403);
  if(!presence.liveMonitorConsent || presence.status!=='live' ||
     Date.now()-new Date(presence.lastHeartbeat).getTime()>90000)
    return bad('The trainee has not consented to live monitoring or the call is no longer active.',403);
  let publish=false;
  if(mode==='trainee'){
    if(email!==presence.traineeEmail||clean(data.presenceToken,120)!==presence.sessionToken)
      return bad('Trainee session proof required.',403);
    publish=true;
  }else if(mode==='manager'){
    if(!['owner','admin','manager'].includes(membership.role))return bad('Manager permission required.',403);
    publish=!!presence.coachTalkConsent && data.talk===true;
  }else return bad('Invalid monitoring mode.');
  const url=Deno.env.get('LIVEKIT_URL')||'';
  const key=Deno.env.get('LIVEKIT_API_KEY')||'';
  const secret=Deno.env.get('LIVEKIT_API_SECRET')||'';
  if(!url||!key||!secret)return bad('Secure live monitoring media room is not configured.',503);
  const room='bob-'+orgId+'-'+id;
  const identity=(mode==='trainee'?'trainee':'manager')+'-'+crypto.randomUUID().slice(0,12);
  return Response.json({success:true,url,token:await token(key,secret,identity,room,publish),
   canPublish:publish,coachTalkAllowed:!!presence.coachTalkConsent});
 }catch(e){console.error('[BOB monitor] refused',e instanceof Error?e.message:'unexpected');return bad('Could not join secure training room.',500);}
});
