/**
 * BOB SaaS tenant gateway. All organization, membership, KB, configuration and
 * session operations run server-side, scoped to a verified Base44 identity.
 * No commercial tenant should access the legacy global Debt Call Coach entities.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });
const str = (value: unknown, max = 1000) => String(value ?? '').trim().slice(0, max);
const emailOf = (value: unknown) => str(value, 255).toLowerCase();
const encrypted = (v:unknown) => {
  const payload=str(v,90000),parsed=JSON.parse(payload);
  if(payload.length>85000 || parsed.v!==1 || !/^[A-Za-z0-9+/=]{16,32}$/.test(parsed.iv) ||
     !/^[A-Za-z0-9+/=]+$/.test(parsed.ct))throw new Error('Expected encrypted AES-GCM payload.');
  return payload;
};
const now = () => new Date().toISOString();
const allow = ['active','trial'];
const fmtOrg = (o: any) => ({
  id:o.id, name:o.name, slug:o.slug, ownerEmail:o.ownerEmail, seatLimit:o.seatLimit,
  status:o.status, industry:o.industry, preferredVoice:o.preferredVoice,
  hasDeepgramKey:!!o.encryptedDeepgramKey, createdAt:o.createdAt, knowledgeSalt:o.knowledgeSalt||'',
  keyVerifier:o.keyVerifier||'', billingStatus:o.billingStatus||'trial',
  hasSubscription:!!o.stripeSubscriptionId
});
const secureGateway = async (req: Request) => {
  const base44 = createClientFromRequest(req);
  const data = await req.json().catch(() => ({}));
  const action = str(data.action, 50);
  const db = base44.asServiceRole.entities;
  // The only unauthenticated operation; never returns any existing inquiry data.
  if (action === 'inquire') {
    const name = str(data.contactName,120), email = emailOf(data.email);
    if (str(data.website,100)) return Response.json({ success: true }); // honeypot
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) return bad('Enter a name and valid email.');
    await db.BOBInquiry.create({ contactName:name,email,company:str(data.company,150),
      seatEstimate:Math.max(1,Math.min(10000,Number(data.seatEstimate)||1)),
      message:str(data.message,2500),status:'new',createdAt:now() });
    return Response.json({ success:true });
  }

  const user = await base44.auth.me().catch(() => null);
  const email = emailOf(user?.email);
  if (!user || !email) return bad('Sign in to the BOB Training Portal.',401);
  if(user.email_verified===false || user.emailVerified===false)return bad('Verify your email to continue.',403);
  const adminEmails = (Deno.env.get('BOB_PLATFORM_ADMIN_EMAILS')||'').toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);
  const isPlatformAdmin = adminEmails.includes(email) || user.role === 'admin';
  const allMembers = await db.BOBMember.filter({ email });
  const memberships = (allMembers||[]).filter((m:any)=>m.status==='active');
  const selectedOrgId = str(data.organizationId,80);
  const member = memberships.find((m:any)=>m.organizationId===selectedOrgId);
  const isPlatformOrg = isPlatformAdmin && selectedOrgId;
  const org = selectedOrgId ? await db.BOBOrganization.get(selectedOrgId).catch(()=>null) : null;
  const requireOrg = () => {
    if (!org || !member) throw new Error('Private organization content requires a verified assigned member.');
    if (!allow.includes(org.status) && !isPlatformAdmin) throw new Error('Organization is not active.');
  };
  const requireAdmin = () => {
    requireOrg();
    if (member?.role!=='owner' && member?.role!=='admin') throw new Error('Organization administrator permission required.');
  };

  const requireSettingsAccess=()=>{
    if(!org||!(isPlatformOrg||['owner','admin'].includes(member?.role)))
       throw new Error('Organization settings permission required.');
  };
  if (action === 'context') {
    const accessible = await Promise.all(memberships.map(async (m:any) => {
      const o=await db.BOBOrganization.get(m.organizationId).catch(()=>null);
      return o?{...fmtOrg(o),myRole:m.role}:null;
    }));
    const orgs = isPlatformAdmin
      ? (await db.BOBOrganization.list('-created_date',250)).map((o:any)=>{
          const own=memberships.find((m:any)=>m.organizationId===o.id);
          if(own)return {...fmtOrg(o),myRole:own.role};
          const {knowledgeSalt,keyVerifier,...operatorMetadata}=fmtOrg(o);
          return {...operatorMetadata,myRole:'platform'};
        })
      : accessible.filter(Boolean);
    return Response.json({ success:true, user:{email,name:user.full_name||user.name||email},
      isPlatformAdmin, organizations:orgs });
  }
  if (action==='createOrg') {
    if (!isPlatformAdmin && memberships.length>0) return bad('Contact sales to open an additional organization.',403);
    const name=str(data.name,120);
    if (name.length<2) return bad('Organization name is required.');
    const seats=isPlatformAdmin?Math.max(1,Math.min(100000,Number(data.seatLimit)||5)):3;
    const ownerEmail=isPlatformAdmin?emailOf(data.ownerEmail)||email:email;
    const o=await db.BOBOrganization.create({name,slug:name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)+'-'+crypto.randomUUID().slice(0,7),
      ownerEmail,seatLimit:seats,status:isPlatformAdmin?'active':'trial',
      industry:str(data.industry,80)||'General sales',preferredVoice:'flux-cliff-en',
      knowledgeSalt:btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))),
      billingStatus:'trial',createdAt:now()});
    await db.BOBMember.create({organizationId:o.id,email:ownerEmail,displayName:'',role:'owner',status:'active',createdAt:now()});
    return Response.json({success:true,organization:fmtOrg(o)});
  }
  if (action==='listInquiries') {
    if (!isPlatformAdmin) return bad('Platform access required.',403);
    const inquiries=await db.BOBInquiry.list('-created_date',100);
    return Response.json({success:true,inquiries});
  }
  if (action==='setOrg') {
    requireSettingsAccess();
    const fields:any={};
    if (typeof data.name==='string' && str(data.name,120).length>=2) fields.name=str(data.name,120);
    if (typeof data.industry==='string') fields.industry=str(data.industry,80);
    if (typeof data.preferredVoice==='string' && /^flux-[a-z]+-en$/.test(data.preferredVoice)) fields.preferredVoice=data.preferredVoice;
    if (isPlatformAdmin && data.seatLimit!==undefined) {
      fields.seatLimit=Math.max(1,Math.min(100000,Number(data.seatLimit)||1));
      const members=await db.BOBMember.filter({organizationId:org.id});
      if ((members||[]).filter((m:any)=>m.status==='active').length>fields.seatLimit) return bad('Seat limit cannot be below active members.');
    }
    if (isPlatformAdmin && ['active','trial','suspended'].includes(data.status)) fields.status=data.status;
    await db.BOBOrganization.update(org.id, fields);
    return Response.json({success:true});
  }
  if (action==='members') {
    requireAdmin();
    const members=await db.BOBMember.filter({organizationId:org.id});
    return Response.json({success:true,members:members.map((m:any)=>({id:m.id,email:m.email,displayName:m.displayName,role:m.role,status:m.status,createdAt:m.createdAt})),seatLimit:org.seatLimit});
  }
  if (action==='addMember') {
    requireAdmin();
    const newEmail=emailOf(data.email), role=['trainee','admin'].includes(data.role)?data.role:'trainee';
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) return bad('Valid trainee email required.');
    const members=await db.BOBMember.filter({organizationId:org.id});
    if (members.some((m:any)=>m.email===newEmail)) return bad('This email is already on the organization.');
    if (members.filter((m:any)=>m.status==='active').length>=Number(org.seatLimit)) return bad('All seats are assigned. Increase the seat allocation first.');
    await db.BOBMember.create({organizationId:org.id,email:newEmail,role,status:'active',displayName:str(data.displayName,100),createdAt:now()});
    let invitationStatus='failed';
    try{
      await base44.asServiceRole.integrations.Core.SendEmail({
        to:newEmail,subject:`BOB Training invitation · ${org.name}`,
        body:`Your company ${org.name} has assigned you a BOB training seat.\nVisit https://rosieai-investorpage.base44.app/bob/login and sign in with ${newEmail}.\nYour organization admin will share a separate knowledge unlock passphrase securely. BOB support cannot recover it.`
      });
      invitationStatus='sent';
    }catch(e){console.warn('[BOB] Invitation failed',e);}
    return Response.json({success:true,invitationStatus});
  }
  if (action==='removeMember') {
    requireAdmin();
    const target=await db.BOBMember.get(str(data.memberId,100)).catch(()=>null);
    if (!target || target.organizationId!==org.id) return bad('Member not found.',404);
    if (target.role==='owner') return bad('Organization owner cannot be removed.');
    await db.BOBMember.delete(target.id);
    return Response.json({success:true});
  }
  if(action==='ensureEncryptionSalt'){
    requireAdmin();
    if(org.knowledgeSalt)return Response.json({success:true,salt:org.knowledgeSalt});
    const salt=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    await db.BOBOrganization.update(org.id,{knowledgeSalt:salt});
    return Response.json({success:true,salt});
  }
  if(action==='initializeEncryption'){
    requireAdmin();
    if(org.keyVerifier)return bad('Encryption already initialized. No platform reset is possible.',409);
    if(!org.knowledgeSalt)return bad('Initialize a vault salt first.',409);
    await db.BOBOrganization.update(org.id,{keyVerifier:encrypted(data.verifier)});
    return Response.json({success:true});
  }
  if(action==='knowledge'){
    requireOrg();
    const rows=await db.BOBKnowledge.filter({organizationId:org.id},'-created_date',250);
    return Response.json({success:true,documents:rows.map((d:any)=>({
       id:d.id,createdAt:d.createdAt,encryptedPayload:d.encryptedPayload||''
    }))});
  }
  if(action==='addKnowledge'){
    requireAdmin();
    if(!org.keyVerifier)return bad('Set up customer-owned encryption first.',409);
    const row=await db.BOBKnowledge.create({organizationId:org.id,encryptedPayload:encrypted(data.encryptedPayload),
        createdBy:email,createdAt:now()});
    return Response.json({success:true,id:row.id});
  }
  if(action==='deleteKnowledge'){
    requireAdmin();
    const row=await db.BOBKnowledge.get(str(data.documentId,100)).catch(()=>null);
    if(!row||row.organizationId!==org.id)return bad('Not found.',404);
    await db.BOBKnowledge.delete(row.id);
    return Response.json({success:true});
  }
  if (action==='setDeepgramKey') {
    requireAdmin();
    const key=str(data.key,500);
    if (key && key.length<15) return bad('This does not look like a valid Deepgram API key.');
    const secret=Deno.env.get('BOB_KEY_ENCRYPTION_SECRET')||'';
    if (key && secret.length<32) return bad('BOB_KEY_ENCRYPTION_SECRET must be configured securely on the server before saving organization keys.',503);
    const encryptedDeepgramKey=key?await encrypt(key,secret):'';
    await db.BOBOrganization.update(org.id,{encryptedDeepgramKey});
    return Response.json({success:true});
  }
  if (action==='voiceGrant') {
    requireOrg();
    if(org.status==='trial' && now().slice(0,10) > new Date(new Date(org.createdAt).getTime()+14*86400000).toISOString().slice(0,10))
      return bad('Your 14-day BOB trial has ended. Contact sales to activate training seats.',403);
    const secret=Deno.env.get('BOB_KEY_ENCRYPTION_SECRET')||'';
    const raw=org.encryptedDeepgramKey
      ? (secret.length>=32 ? await decrypt(org.encryptedDeepgramKey,secret):'')
      : (Deno.env.get('DEEPGRAM2_API_KEY')||Deno.env.get('deepgram2')||'');
    if (!raw) return bad('No Deepgram key available. Your organization admin must configure a key.',503);
    // Trial usage protection: count requests, not only saved calls, so an early hangup
    // or uncompleted transcript cannot bypass the trial allocation.
    const cutoff=Date.now()-24*3600*1000;
    const grants=await db.BOBVoiceGrant.filter({organizationId:org.id});
    const usedToday=(grants||[]).filter((g:any)=>new Date(g.issuedAt).getTime()>cutoff).length;
    const maxDaily=org.status==='trial'?12:2000;
    if(usedToday>=maxDaily) return bad(org.status==='trial'
      ?'Trial voice session limit reached for today. Contact BOB sales to activate a team plan.'
      :'Daily voice session allocation reached; contact your BOB administrator.',429);
    const res=await fetch('https://api.deepgram.com/v1/auth/grant',{
      method:'POST',headers:{Authorization:'Token '+raw,'Content-Type':'application/json'},
      body:JSON.stringify({time_to_live_in_seconds:600})
    });
    if (!res.ok) return bad('Deepgram denied a temporary training credential. Check the configured key.',502);
    const granted=await res.json();
    if (!granted.key) return bad('Deepgram did not issue a temporary credential.',502);
    await db.BOBVoiceGrant.create({organizationId:org.id,traineeEmail:email,issuedAt:now()});
    return Response.json({success:true,key:granted.key,expiresInSeconds:600});
  }
  if(action==='sessions'){
    requireOrg();
    const rows=await db.BOBTrainingSession.filter({organizationId:org.id},'-created_date',100);
    const allowed=['owner','admin'].includes(member?.role)?rows:rows.filter((r:any)=>r.traineeEmail===email);
    return Response.json({success:true,sessions:allowed.map((r:any)=>({
      id:r.id,traineeEmail:r.traineeEmail,scenario:r.scenario,mode:r.mode,
      persona:r.persona,difficulty:r.difficulty,voiceModel:r.voiceModel,
      durationSeconds:r.durationSeconds,createdAt:r.createdAt,
      encryptedPayload:r.encryptedPayload||'',encryptedReview:r.encryptedReview||'',score:r.score
    }))});
  }
  if(action==='saveSession'){
    requireOrg();
    if(!org.keyVerifier)return bad('Initialize encrypted storage first.',409);
    const record=await db.BOBTrainingSession.create({
      organizationId:org.id,traineeEmail:email,scenario:'Encrypted private training',
      mode:'private',persona:'encrypted',difficulty:0,voiceModel:'private',
      durationSeconds:Math.max(0,Math.min(43200,Number(data.durationSeconds)||0)),
      encryptedPayload:encrypted(data.encryptedPayload),createdAt:now()
    });
    return Response.json({success:true,id:record.id});
  }
  if(action==='reviewSession'){
    requireOrg();
    const record=await db.BOBTrainingSession.get(str(data.sessionId,100)).catch(()=>null);
    if(!record||record.organizationId!==org.id)return bad('Session not found.',404);
    if(!['owner','admin'].includes(member?.role) && record.traineeEmail!==email)return bad('Not permitted.',403);
    if(record.encryptedReview)return bad('Review already exists.',409);
    // Plaintext decrypted in browser, processed transiently by model, never persisted here.
    const rows=Array.isArray(data.transcript)?data.transcript.slice(-250).map((t:any)=>({
      role:t.role==='bob'?'bob':'trainee',text:str(t.text,800)
    })):[];
    if(rows.length<4)return bad('Not enough dialogue for coaching.',400);
    const dialogue=rows.map((t:any)=>`${t.role==='bob'?'CUSTOMER':'TRAINEE'}: ${t.text}`).join('\n').slice(0,24000);
    const response=await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt:`You are a sales training coach. Analyze ONLY the trainee's performance in this fictional simulation.
Scenario: ${str(record.scenario,150)}.
Give scores from 0 to 20 for discovery, listening, clarity, objections, nextSteps, plus a summary
and 3 specific recommendations. Do not invent statements or unsupported promises.
DIALOGUE:
${dialogue}`,
      response_json_schema:{type:'object',properties:{
        discovery:{type:'number'},listening:{type:'number'},clarity:{type:'number'},
        objections:{type:'number'},nextSteps:{type:'number'},summary:{type:'string'},
        tips:{type:'array',items:{type:'string'}}
      },required:['discovery','listening','clarity','objections','nextSteps','summary','tips']}
    });
    const raw=typeof response==='object'&&response?response:{};
    const review:any={};
    for(const key of ['discovery','listening','clarity','objections','nextSteps'])
      review[key]=Math.max(0,Math.min(20,Math.round(Number(raw[key])||0)));
    review.score=['discovery','listening','clarity','objections','nextSteps'].reduce((n,k)=>n+review[k],0);
    review.summary=str(raw.summary,600);
    review.tips=Array.isArray(raw.tips)?raw.tips.slice(0,4).map((t:any)=>str(t,300)):[];
    return Response.json({success:true,review});
  }
  if(action==='saveReview'){
    requireOrg();
    const record=await db.BOBTrainingSession.get(str(data.sessionId,100)).catch(()=>null);
    if(!record||record.organizationId!==org.id)return bad('Session not found.',404);
    if(!['owner','admin'].includes(member?.role) && record.traineeEmail!==email)return bad('Not permitted.',403);
    if(record.encryptedReview)return bad('Review already saved.',409);
    await db.BOBTrainingSession.update(record.id,{encryptedReview:encrypted(data.encryptedReview),reviewedAt:now()});
    return Response.json({success:true});
  }
  return bad('Unsupported BOB action.',404);
};

const enc = new TextEncoder();
async function aesKey(secret:string) {
  const digest=await crypto.subtle.digest('SHA-256',enc.encode(secret));
  return crypto.subtle.importKey('raw',digest,'AES-GCM',false,['encrypt','decrypt']);
}
const toB64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const fromB64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function encrypt(value:string,secret:string){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await aesKey(secret),enc.encode(value));
  return toB64(iv)+'.'+toB64(new Uint8Array(encrypted));
}
async function decrypt(payload:string,secret:string){
  const [iv,encrypted]=payload.split('.');
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(iv)},await aesKey(secret),fromB64(encrypted));
  return new TextDecoder().decode(plain);
}

Deno.serve(async (req:Request)=>{
  if(req.method!=='POST')return bad('Method not allowed.',405);
  try {return await secureGateway(req);}
  catch(e){console.error('[BOB SaaS]',e);return bad(e instanceof Error?e.message:'Unexpected error.',403);}
});
