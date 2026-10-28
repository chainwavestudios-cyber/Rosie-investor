/**
 * BOB SaaS tenant gateway. All organization, membership, KB, configuration and
 * session operations run server-side, scoped to a verified Base44 identity.
 * No commercial tenant should access the legacy global Debt Call Coach entities.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });
const str = (value: unknown, max = 1000) => String(value ?? '').trim().slice(0, max);
const emailOf = (value: unknown) => str(value, 255).toLowerCase();
const bool = (v: unknown) => v === true;
const now = () => new Date().toISOString();
const allow = ['active','trial'];
const fmtOrg = (o: any) => ({
  id:o.id, name:o.name, slug:o.slug, ownerEmail:o.ownerEmail, seatLimit:o.seatLimit,
  status:o.status, industry:o.industry, preferredVoice:o.preferredVoice,
  hasDeepgramKey:!!o.encryptedDeepgramKey, createdAt:o.createdAt
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
  const adminEmails = (Deno.env.get('BOB_PLATFORM_ADMIN_EMAILS')||'').toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);
  const isPlatformAdmin = adminEmails.includes(email) || user.role === 'admin';
  const allMembers = await db.BOBMember.filter({ email });
  const memberships = (allMembers||[]).filter((m:any)=>m.status==='active');
  const selectedOrgId = str(data.organizationId,80);
  const member = memberships.find((m:any)=>m.organizationId===selectedOrgId);
  const isPlatformOrg = isPlatformAdmin && selectedOrgId;
  const org = selectedOrgId ? await db.BOBOrganization.get(selectedOrgId).catch(()=>null) : null;
  const requireOrg = () => {
    if (!org || !(member || isPlatformOrg)) throw new Error('Organization not available to this account.');
    if (!allow.includes(org.status) && !isPlatformAdmin) throw new Error('Organization is not active.');
  };
  const requireAdmin = () => {
    requireOrg();
    if (!isPlatformAdmin && member?.role!=='owner' && member?.role!=='admin') throw new Error('Organization administrator permission required.');
  };

  if (action === 'context') {
    const accessible = await Promise.all(memberships.map(async (m:any) => {
      const o=await db.BOBOrganization.get(m.organizationId).catch(()=>null);
      return o?{...fmtOrg(o),myRole:m.role}:null;
    }));
    const orgs = isPlatformAdmin ? (await db.BOBOrganization.list('-created_date',250)).map((o:any)=>({...fmtOrg(o),myRole:'platform'})) : accessible.filter(Boolean);
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
      industry:str(data.industry,80)||'General sales',preferredVoice:'flux-cliff-en',createdAt:now()});
    await db.BOBMember.create({organizationId:o.id,email:ownerEmail,displayName:'',role:'owner',status:'active',createdAt:now()});
    return Response.json({success:true,organization:fmtOrg(o)});
  }
  if (action==='listInquiries') {
    if (!isPlatformAdmin) return bad('Platform access required.',403);
    const inquiries=await db.BOBInquiry.list('-created_date',100);
    return Response.json({success:true,inquiries});
  }
  if (action==='setOrg') {
    requireAdmin();
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
    return Response.json({success:true});
  }
  if (action==='removeMember') {
    requireAdmin();
    const target=await db.BOBMember.get(str(data.memberId,100)).catch(()=>null);
    if (!target || target.organizationId!==org.id) return bad('Member not found.',404);
    if (target.role==='owner') return bad('Organization owner cannot be removed.');
    await db.BOBMember.delete(target.id);
    return Response.json({success:true});
  }
  if (action==='knowledge') {
    requireOrg();
    const docs=await db.BOBKnowledge.filter({organizationId:org.id},'-created_date',250);
    return Response.json({success:true,documents:docs});
  }
  if (action==='addKnowledge') {
    requireAdmin();
    const title=str(data.title,150), content=str(data.content,25000);
    if (!title || content.length<10) return bad('Give this knowledge entry a title and at least 10 characters of training content.');
    const record=await db.BOBKnowledge.create({organizationId:org.id,title,content,category:str(data.category,60)||'Sales playbook',
      createdBy:email,createdAt:now()});
    return Response.json({success:true,document:record});
  }
  if (action==='deleteKnowledge') {
    requireAdmin();
    const record=await db.BOBKnowledge.get(str(data.documentId,100)).catch(()=>null);
    if (!record||record.organizationId!==org.id) return bad('Not found.',404);
    await db.BOBKnowledge.delete(record.id);
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
    const secret=Deno.env.get('BOB_KEY_ENCRYPTION_SECRET')||'';
    const raw=org.encryptedDeepgramKey
      ? (secret.length>=32 ? await decrypt(org.encryptedDeepgramKey,secret):'')
      : (Deno.env.get('DEEPGRAM2_API_KEY')||Deno.env.get('deepgram2')||'');
    if (!raw) return bad('No Deepgram key available. Your organization admin must configure a key.',503);
    const res=await fetch('https://api.deepgram.com/v1/auth/grant',{
      method:'POST',headers:{Authorization:'Token '+raw,'Content-Type':'application/json'},
      body:JSON.stringify({time_to_live_in_seconds:600})
    });
    if (!res.ok) return bad('Deepgram denied a temporary training credential. Check the configured key.',502);
    const granted=await res.json();
    if (!granted.key) return bad('Deepgram did not issue a temporary credential.',502);
    return Response.json({success:true,key:granted.key,expiresInSeconds:600});
  }
  if (action==='sessions') {
    requireOrg();
    const records=await db.BOBTrainingSession.filter({organizationId:org.id},'-created_date',100);
    return Response.json({success:true,sessions:isPlatformAdmin||['owner','admin'].includes(member?.role)
      ?records:records.filter((s:any)=>s.traineeEmail===email)});
  }
  if (action==='saveSession') {
    requireOrg();
    const transcript=Array.isArray(data.transcript)?data.transcript.slice(-250).map((t:any)=>({
      role: t.role==='bob'?'bob':'trainee',text:str(t.text,800),time:str(t.time,40)
    })):[];
    const saved=await db.BOBTrainingSession.create({
      organizationId:org.id,traineeEmail:email,scenario:str(data.scenario,150),mode:['inbound','outbound'].includes(data.mode)?data.mode:'outbound',
      persona:str(data.persona,100),difficulty:Math.min(10,Math.max(1,Number(data.difficulty)||5)),
      voiceModel:str(data.voiceModel,80),durationSeconds:Math.max(0,Math.min(43200,Number(data.durationSeconds)||0)),
      transcriptJson:JSON.stringify(transcript).slice(0,50000),notes:str(data.notes,2500),createdAt:now()
    });
    return Response.json({success:true,id:saved.id});
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
