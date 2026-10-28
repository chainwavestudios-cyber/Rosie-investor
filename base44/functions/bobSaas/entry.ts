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
const ADDON_IDS=['live_qa','live_coach'];
const selectedAddons=(v:unknown)=>{
 const a=Array.isArray(v)?v:[];
 return ADDON_IDS.filter(id=>a.includes(id));
};
const allow = ['active','trial'];
const fmtOrg = (o: any) => ({
  id:o.id, name:o.name, slug:o.slug, ownerEmail:o.ownerEmail, seatLimit:o.seatLimit,
  status:o.status, industry:o.industry, preferredVoice:o.preferredVoice,
  hasDeepgramKey:!!o.encryptedDeepgramKey, createdAt:o.createdAt, knowledgeSalt:o.knowledgeSalt||'',
  keyVerifier:o.keyVerifier||'', billingStatus:o.billingStatus||'trial',
  hasSubscription:!!o.stripeSubscriptionId,requestedAddons:(()=>{try{return selectedAddons(JSON.parse(o.requestedAddons||'[]'));}catch{return[]}})(),managerCanConfigure:!!o.managerCanConfigure,
  managerCanControlRecording:!!o.managerCanControlRecording,
  allowSessionRecording:!!o.allowSessionRecording,allowLiveMonitoring:!!o.allowLiveMonitoring
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
      message:str(data.message,2500),requestedAddons:JSON.stringify(selectedAddons(data.requestedAddons)),status:'new',createdAt:now() });
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

  // A manager may design flows only after the OWNER delegates that permission.
  // Operators without a tenant membership are never granted access to tenant data.
  const mayConfigure=()=>['owner','admin'].includes(member?.role) ||
    (member?.role==='manager' && !!org?.managerCanConfigure);
  const requireFlowAdmin=()=>{
    requireOrg();
    if(!mayConfigure())throw new Error('Your organization administrator has not delegated flow editing to your role.');
  };
  const mayControlRecording=()=>['owner','admin'].includes(member?.role) ||
    (member?.role==='manager' && !!org?.managerCanControlRecording);
  const requireManagement=()=>{
    requireOrg();
    if(!['owner','admin','manager'].includes(member?.role))throw new Error('Manager permission required.');
  };
  const audit=async (op:string, targetId='', description='')=>{
    // Metadata only. Never log keys, private knowledge or call content.
    await db.BOBAdminAudit.create({organizationId:org?.id||'',actorEmail:email,action:op,
      targetId:str(targetId,120),description:str(description,220),createdAt:now()})
      .catch(e=>console.warn('[BOB] nonblocking admin audit failure',e));
  };
  const requireSettingsAccess=()=>{
    if(!org||!(isPlatformOrg||['owner','admin'].includes(member?.role)))
       throw new Error('Organization settings permission required.');
  };
  if(action==='systemDiagnostics'){
    if(!isPlatformAdmin)return bad('Platform administrator access required.',403);
    const stripeSecret=Deno.env.get('STRIPE_SECRET_KEY')||'';
    const stripePrice=Deno.env.get('BOB_STRIPE_PRICE_PER_SEAT')||'';
    const webhook=Deno.env.get('BOB_STRIPE_WEBHOOK_SECRET')||'';
    const encryption=Deno.env.get('BOB_KEY_ENCRYPTION_SECRET')||'';
    const voice=Deno.env.get('DEEPGRAM2_API_KEY')||Deno.env.get('deepgram2')||'';
    const liveKitUrl=Deno.env.get('LIVEKIT_URL')||'';
    const liveKitKey=Deno.env.get('LIVEKIT_API_KEY')||'';
    const liveKitSecret=Deno.env.get('LIVEKIT_API_SECRET')||'';
    return Response.json({success:true,integrations:{
      stripeSecretConfigured:!!stripeSecret,
      stripeMode:stripeSecret.startsWith('sk_live_')?'live':stripeSecret?'test':'not_configured',
      stripePriceConfigured:/^price_[a-zA-Z0-9]+$/.test(stripePrice),
      stripeWebhookConfigured:webhook.startsWith('whsec_'),
      deepgramDefaultConfigured:!!voice,
      customerKeyEncryptionConfigured:encryption.length>=32,
      liveMonitorConfigured:!!liveKitUrl&&!!liveKitKey&&!!liveKitSecret
    },note:'Configuration flags are not security certification, a test charge, or a live voice smoke test.'});
  }
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
      billingStatus:'trial',requestedAddons:JSON.stringify(selectedAddons(data.requestedAddons)),
      managerCanConfigure:false,managerCanControlRecording:false,
      allowSessionRecording:false,allowLiveMonitoring:false,createdAt:now()});
    await db.BOBMember.create({organizationId:o.id,email:ownerEmail,displayName:'',role:'owner',status:'active',createdAt:now()});
    await db.BOBAdminAudit.create({organizationId:o.id,actorEmail:email,action:'organization.created',targetId:o.id,
       description:'Organization created; seat allocation '+seats,createdAt:now()}).catch(()=>{});
    if(isPlatformAdmin && ownerEmail!==email){
      try{await base44.asServiceRole.integrations.Core.SendEmail({
        to:ownerEmail,subject:'Your BOB Training organization is ready',
        body:'Your company '+name+' has been invited to BOB Training Intelligence.\n\nSign in using '+ownerEmail+
        ' at https://rosieai-investorpage.base44.app/bob/login\n\nYour admin access begins with your account email. Set up your private organization knowledge vault after you sign in.'
      });}catch(err){console.warn('[BOB] owner invite could not be sent',err);}
    }
    return Response.json({success:true,organization:fmtOrg(o)});
  }
  if (action==='requestAddons') {
    // Customer admin expresses commercial interest; this never grants entitlement.
    requireAdmin();
    const requested=selectedAddons(data.requestedAddons);
    await db.BOBOrganization.update(org.id,{requestedAddons:JSON.stringify(requested)});
    return Response.json({success:true,requestedAddons:requested,
       status:'interest_only',message:'BOB sales will review these product requests. Neither product is activated by this action.'});
  }
  if(action==='updateInquiry'){
    if(!isPlatformAdmin)return bad('Platform administrator access required.',403);
    const id=str(data.inquiryId,120),record=await db.BOBInquiry.get(id).catch(()=>null);
    if(!record)return bad('Commercial inquiry not found.',404);
    const status=['new','contacted','qualified','converted','closed'].includes(data.status)?data.status:null;
    if(!status)return bad('Invalid inquiry status.',400);
    await db.BOBInquiry.update(id,{status});
    await audit('inquiry.status',id,status);
    return Response.json({success:true});
  }
  if(action==='adminActivity'){
    if(!isPlatformAdmin && !member)return bad('No access to administration records.',403);
    if(!isPlatformAdmin && !['owner','admin'].includes(member?.role))
       return bad('Organization administrator permission required.',403);
    const records=isPlatformAdmin && data.global===true
      ?await db.BOBAdminAudit.list('-created_date',100)
      :await db.BOBAdminAudit.filter({organizationId:org.id},'-created_date',100);
    return Response.json({success:true,events:(records||[]).map((x:any)=>({
      id:x.id,organizationId:x.organizationId,actorEmail:x.actorEmail,action:x.action,
      targetId:x.targetId,description:x.description,createdAt:x.createdAt
    }))});
  }
  if(action==='resendMemberInvite'){
    requireAdmin();
    const target=await db.BOBMember.get(str(data.memberId,120)).catch(()=>null);
    if(!target || target.organizationId!==org.id)return bad('Member is outside this organization.',404);
    if(target.status!=='active')return bad('Only active members may receive an invitation.',403);
    await base44.asServiceRole.integrations.Core.SendEmail({
      to:target.email,subject:'Your BOB Training invitation · '+org.name,
      body:'You have been invited to '+org.name+' in BOB Training Intelligence.\n\n'+
        'Sign in at https://rosieai-investorpage.base44.app/bob/login with '+target.email+
        '.\n\nYour organization administrator shares the separate knowledge-unlock passphrase.'
    });
    await audit('member.invited',target.id,'Invitation resent');
    return Response.json({success:true});
  }
    if (action==='listInquiries') {
    if (!isPlatformAdmin) return bad('Platform access required.',403);
    const inquiries=await db.BOBInquiry.list('-created_date',100);
    return Response.json({success:true,inquiries});
  }
  if(action==='setRecordingPolicy'){
    requireOrg();
    if(!mayControlRecording())return bad('Recording policy can only be changed by an administrator or authorized manager.',403);
    if(typeof data.allowSessionRecording!=='boolean')return bad('Explicit recording policy value required.');
    await db.BOBOrganization.update(org.id,{allowSessionRecording:data.allowSessionRecording});
    await audit('privacy.recording',org.id,data.allowSessionRecording?'Enabled opt-in recording':'Disabled opt-in recording');
    return Response.json({success:true});
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
    // Privacy/roles policies are owned by customer administrators only.
    if(['owner','admin'].includes(member?.role)){
      for(const key of ['managerCanConfigure','managerCanControlRecording','allowSessionRecording','allowLiveMonitoring'])
        if(typeof data[key]==='boolean')fields[key]=data[key];
    }
    await db.BOBOrganization.update(org.id, fields);
    await audit('organization.updated',org.id, Object.keys(fields).join(', '));
    return Response.json({success:true});
  }
  if (action==='members') {
    requireAdmin();
    const members=await db.BOBMember.filter({organizationId:org.id});
    return Response.json({success:true,members:members.map((m:any)=>({id:m.id,email:m.email,displayName:m.displayName,role:m.role,status:m.status,createdAt:m.createdAt})),seatLimit:org.seatLimit});
  }
  if (action==='addMember') {
    requireAdmin();
    const newEmail=emailOf(data.email), role=['trainee','admin','manager'].includes(data.role)?data.role:'trainee';
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
    await audit('member.added','',newEmail+' as '+role);
    return Response.json({success:true,invitationStatus});
  }
  if (action==='removeMember') {
    requireAdmin();
    const target=await db.BOBMember.get(str(data.memberId,100)).catch(()=>null);
    if (!target || target.organizationId!==org.id) return bad('Member not found.',404);
    if (target.role==='owner') return bad('Organization owner cannot be removed.');
    await db.BOBMember.delete(target.id);
    await audit('member.removed',target.id,'Member seat released');
    return Response.json({success:true});
  }
  if (action==='updateMemberRole'){
    requireAdmin();
    const target=await db.BOBMember.get(str(data.memberId,120)).catch(()=>null);
    if(!target||target.organizationId!==org.id)return bad('Member not found in this organization.',404);
    if(target.role==='owner')return bad('The organization owner cannot be reassigned.',403);
    if(!['trainee','manager','admin'].includes(data.role))return bad('Invalid role.');
    await db.BOBMember.update(target.id,{role:data.role});
    await audit('member.role',target.id,'Role changed to '+data.role);
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
    requireFlowAdmin();
    if(!org.keyVerifier)return bad('Set up customer-owned encryption first.',409);
    const row=await db.BOBKnowledge.create({organizationId:org.id,encryptedPayload:encrypted(data.encryptedPayload),
        createdBy:email,createdAt:now()});
    return Response.json({success:true,id:row.id});
  }
  if(action==='deleteKnowledge'){
    requireFlowAdmin();
    const row=await db.BOBKnowledge.get(str(data.documentId,100)).catch(()=>null);
    if(!row||row.organizationId!==org.id)return bad('Not found.',404);
    await db.BOBKnowledge.delete(row.id);
    return Response.json({success:true});
  }
  // Encrypted scripts and full simulation workflows. Platform operators cannot read
  // their ciphertext through this endpoint without a customer membership.
  if(['listFlows','saveFlow','deleteFlow','listScripts','saveScript','deleteScript'].includes(action)){
    requireOrg();
    const flows=action.toLowerCase().includes('flow');
    const table=flows?db.BOBWorkflow:db.BOBScript;
    if(action==='listFlows'||action==='listScripts'){
      const rows=await table.filter({organizationId:org.id},'-created_date',150);
      return Response.json({success:true,items:(rows||[]).map((r:any)=>({
        id:r.id,encryptedPayload:r.encryptedPayload,createdAt:r.createdAt,updatedAt:r.updatedAt
      }))});
    }
    requireFlowAdmin();
    if(action==='saveFlow'||action==='saveScript'){
      if(!org.keyVerifier)return bad('Initialize your vault before editing workflow content.',409);
      const payload=encrypted(data.encryptedPayload),id=str(data.itemId,120);
      if(id){
        const old=await table.get(id).catch(()=>null);
        if(!old||old.organizationId!==org.id)return bad('Item not found.',404);
        await table.update(id,{encryptedPayload:payload,updatedAt:now()});
        return Response.json({success:true,id});
      }
      const row=await table.create({organizationId:org.id,encryptedPayload:payload,createdBy:email,createdAt:now(),updatedAt:now()});
      return Response.json({success:true,id:row.id});
    }
    const id=str(data.itemId,120);
    const old=await table.get(id).catch(()=>null);
    if(!old||old.organizationId!==org.id)return bad('Item not found.',404);
    await table.delete(id);
    return Response.json({success:true});
  }
  // Training presence is only metadata: we deliberately do not pretend it is an
  // audio stream. Actual media monitoring requires a separate opt-in relay.
  if(action==='presenceStart'){
    requireOrg();
    const sessionToken=crypto.randomUUID();
    const presence=await db.BOBPresence.create({organizationId:org.id,traineeEmail:email,status:'live',
      stage:str(data.stage,120),sessionToken,startedAt:now(),lastHeartbeat:now(),
      recordingEnabled:data.recordingEnabled===true && !!org.allowSessionRecording,
      liveMonitorConsent:data.liveMonitorConsent===true && !!org.allowLiveMonitoring,
      coachTalkConsent:data.coachTalkConsent===true && !!org.allowLiveMonitoring});
    return Response.json({success:true,sessionToken,presenceId:presence.id});
  }
  if(action==='presenceHeartbeat'||action==='presenceEnd'){
    requireOrg();
    const token=str(data.sessionToken,120);
    if(!token)return bad('Missing presence session token.');
    const matches=await db.BOBPresence.filter({organizationId:org.id,sessionToken:token});
    const presence=(matches||[]).find((r:any)=>r.traineeEmail===email);
    if(!presence)return bad('Training presence not found.',404);
    if(action==='presenceEnd'){
      await db.BOBPresence.update(presence.id,{status:'ended',endedAt:now(),lastHeartbeat:now()});
    }else{
      await db.BOBPresence.update(presence.id,{stage:str(data.stage,120),lastHeartbeat:now()});
    }
    return Response.json({success:true});
  }
  if(action==='liveSessions'){
    requireManagement();
    const rows=await db.BOBPresence.filter({organizationId:org.id},'-created_date',100);
    const cutoff=Date.now()-90000;
    return Response.json({success:true,sessions:(rows||[]).filter((r:any)=>r.status==='live'&&
      new Date(r.lastHeartbeat).getTime()>cutoff).map((r:any)=>({
      id:r.id,traineeEmail:r.traineeEmail,stage:r.stage,startedAt:r.startedAt,
      lastHeartbeat:r.lastHeartbeat,liveMonitorConsent:r.liveMonitorConsent,coachTalkConsent:r.coachTalkConsent,
      recordingEnabled:r.recordingEnabled
    }))});
  }
  // AI-assisted workflow design. Customer actively submits instructions for a
  // one-time LLM call. The model receives the draft in plaintext; never submit
  // this without explaining third-party processing in the customer UI.
  if(action==='designFlow'){
    requireFlowAdmin();
    const instructions=str(data.request,4000);
    if(instructions.length<20)return bad('Describe your call process in more detail.');
    const previous=data.currentFlow&&typeof data.currentFlow==='object'?
      JSON.stringify(data.currentFlow).slice(0,12000):'No existing draft.';
    const result=await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt:`You are BOB's expert sales-training workflow architect.
      Generate an actionable, realistic multi-stage call simulator based on the user's requirements.
      You can simulate incoming queue, AI receptionist/transfer, prospect discovery, objections,
      mock credit check, closer handoff, full closing process, follow-up and completion.
      Actions in the simulation are only mock: never imply a real credit bureau check, phone call,
      actual email, actual SMS, real CRM update or completed transaction.
      Return a concise explanation and a single flow with title, description, type (inbound, outbound,
      queue or follow_up), and 2-12 ordered stages. Each stage has type
      (incoming_queue, transfer_agent, discovery, objection, mock_credit, closer_handoff,
      closing, follow_up, completed), label, goal, instructions, introMessage, voice
      (flux-drew-en default), actions as an array of IDs:
      qualify, mock_credit, send_email, send_text, capture_data, confirm_debt, transfer,
      callback, completed.
      The first stage should be the realistic entry point. Configure transitions via ordered stages.
      Include requirements for manager/trainee responsibilities in stage instructions, but not
      fabricated customer data or real financial decisions.
      Existing draft: ${previous}
      Request: ${instructions}`,
      response_json_schema:{type:'object',properties:{
        explanation:{type:'string'},
        flow:{type:'object',properties:{
          title:{type:'string'},description:{type:'string'},type:{type:'string'},
          stages:{type:'array',items:{type:'object',properties:{
            type:{type:'string'},label:{type:'string'},goal:{type:'string'},
            instructions:{type:'string'},introMessage:{type:'string'},voice:{type:'string'},
            actions:{type:'array',items:{type:'string'}}
          }}}
        }}
      },required:['explanation','flow']}
    });
    const raw=result&&typeof result==='object'?result:{};
    const flow=raw.flow||{};
    const allowedTypes=['incoming_queue','transfer_agent','discovery','objection','mock_credit','closer_handoff','closing','follow_up','completed'];
    const allowedActions=['qualify','mock_credit','send_email','send_text','capture_data','confirm_debt','transfer','callback','completed'];
    return Response.json({success:true,explanation:str(raw.explanation,1300),flow:{
      title:str(flow.title,120),description:str(flow.description,1500),
      type:['inbound','outbound','queue','follow_up'].includes(flow.type)?flow.type:'inbound',
      stages:(Array.isArray(flow.stages)?flow.stages:[]).slice(0,15).map((stage:any)=>({
        id:crypto.randomUUID().slice(0,12),
        type:allowedTypes.includes(stage.type)?stage.type:'discovery',
        label:str(stage.label,100),goal:str(stage.goal,1000),
        instructions:str(stage.instructions,3500),introMessage:str(stage.introMessage,700),
        voice:/^(flux|aura)-[a-z]+-en$/.test(stage.voice)?stage.voice:'flux-drew-en',
        scriptId:'',actions:(Array.isArray(stage.actions)?stage.actions:[]).filter((a:string)=>allowedActions.includes(a)).slice(0,12)
      }))
    }});
  }
  // Recording files are encrypted with the same non-exportable customer browser
  // key BEFORE private upload. A signed URL contains encrypted bytes only.
  if(action==='recordingSaved'){
    requireOrg();
    if(!org.allowSessionRecording)return bad('Organization recording policy is disabled.',403);
    const uri=str(data.fileUri,500),callId=str(data.callId,100);
    if(!uri||!callId||!str(data.encryptedIv,100))return bad('Recording metadata missing.');
    // The client uploads ciphertext. This metadata never contains a decryption key.
    const presenceRows=await db.BOBPresence.filter({organizationId:org.id,sessionToken:str(data.presenceToken,120)});
    const consented=(presenceRows||[]).some((r:any)=>r.traineeEmail===email&&r.recordingEnabled===true);
    if(!consented)return bad('Recording consent was not recorded for this session.',403);
    await db.BOBRecording.create({organizationId:org.id,traineeEmail:email,callId,fileUri:uri,
      encryptedIv:str(data.encryptedIv,100),sizeBytes:Math.max(0,Number(data.sizeBytes)||0),
      durationSeconds:Math.max(0,Number(data.durationSeconds)||0),createdAt:now(),status:'ready'});
    return Response.json({success:true});
  }
  if(action==='recordings'){
    requireManagement();
    const rows=await db.BOBRecording.filter({organizationId:org.id},'-created_date',100);
    return Response.json({success:true,recordings:rows.map((r:any)=>({
      id:r.id,traineeEmail:r.traineeEmail,callId:r.callId,createdAt:r.createdAt,
      durationSeconds:r.durationSeconds,sizeBytes:r.sizeBytes,status:r.status
    }))});
  }
  if(action==='recordingPlayback'){
    requireManagement();
    const row=await db.BOBRecording.get(str(data.recordingId,120)).catch(()=>null);
    if(!row||row.organizationId!==org.id)return bad('Recording not found.',404);
    const result=await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri:row.fileUri,expires_in:180
    });
    return Response.json({success:true,encryptedUrl:result.signed_url,iv:row.encryptedIv});
  }
  // Add-on content is a DIFFERENT datastore than BOB's training KB.
  // Within the add-on datastore, every query is strictly scoped to the org
  // and the requested product. No public or unauthenticated access.
  if(['addonKnowledge','addAddonKnowledge','deleteAddonKnowledge'].includes(action)){
    requireOrg();
    if(!['owner','admin'].includes(member?.role)&&!mayConfigure())
      return bad('Organization training administrator permission required.',403);
    const product=str(data.product,30);
    if(!ADDON_IDS.includes(product))return bad('Unknown commercial product.',400);
    if(action==='addonKnowledge'){
      const rows=await db.BOBAddonKnowledge.filter({organizationId:org.id,product},'-created_date',150);
      return Response.json({success:true,documents:(rows||[]).map((d:any)=>({
        id:d.id,encryptedPayload:d.encryptedPayload,createdAt:d.createdAt
      }))});
    }
    if(!org.keyVerifier)return bad('Initialize your customer-owned encryption vault first.',409);
    if(action==='addAddonKnowledge'){
      const created=await db.BOBAddonKnowledge.create({
        organizationId:org.id,product,encryptedPayload:encrypted(data.encryptedPayload),
        createdBy:email,createdAt:now()
      });
      return Response.json({success:true,id:created.id});
    }
    const record=await db.BOBAddonKnowledge.get(str(data.documentId,120)).catch(()=>null);
    if(!record||record.organizationId!==org.id||record.product!==product)return bad('Document not found in this organization and product.',404);
    await db.BOBAddonKnowledge.delete(record.id);
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
    const allowed=['owner','admin','manager'].includes(member?.role)?rows:rows.filter((r:any)=>r.traineeEmail===email);
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
    if(!['owner','admin','manager'].includes(member?.role) && record.traineeEmail!==email)return bad('Not permitted.',403);
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
    if(!['owner','admin','manager'].includes(member?.role) && record.traineeEmail!==email)return bad('Not permitted.',403);
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
