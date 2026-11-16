/**
 * Fail-closed, side-effect-free authorization policy for the ORIGINAL Investor
 * Debt Call Coach / Commercial BOB experimental inference route.
 *
 * The legacy liveAssistantAI endpoint does not import this policy.
 * This policy does NOT establish a Rosie Core tenant link or approve a KB.
 */
const SEAT_ROLES=new Set(['super_admin','admin','super_manager','manager','dialer']);
const MANAGER_ROLES=new Set(['super_admin','admin','super_manager','manager']);
const MODES=new Set(['qa','coach']);
const CLIENT_AUTHORITY_FIELDS=['kbEntries','kbName','_ctx','organization_id','organizationId','tenantId','priceId','costUsd','stripeCustomerId','model','approvedKb'];
const fail=(status,code)=>({ok:false,status,code});
export function validateInvestorPilotPayload(body){
  if(!body || typeof body!=='object' || Array.isArray(body))return fail(400,'PILOT_INVALID_REQUEST');
  if(!MODES.has(body.mode))return fail(400,'PILOT_INVALID_MODE');
  if(CLIENT_AUTHORITY_FIELDS.some(key=>Object.prototype.hasOwnProperty.call(body,key)))
    return fail(400,'PILOT_CLIENT_AUTHORITY_FORBIDDEN');
  if(typeof body.sessionUserId!=='string' || !body.sessionUserId.trim() ||
     typeof body.sessionToken!=='string' || !body.sessionToken ||
     typeof body.leadId!=='string' || !body.leadId.trim())
    return fail(401,'PILOT_SESSION_OR_LEAD_REQUIRED');
  if(body.mode==='qa' && (typeof body.question!=='string' || !body.question.trim() || body.question.length>1200))
    return fail(400,'PILOT_QUESTION_INVALID');
  if(body.transcript !== undefined && (!Array.isArray(body.transcript) || body.transcript.length>30))
    return fail(400,'PILOT_TRANSCRIPT_INVALID');
  if(body.transcript?.some(line=>!line || typeof line.text!=='string' || line.text.length>1500 ||
     ![0,1,2].includes(line.speaker)))
    return fail(400,'PILOT_TRANSCRIPT_INVALID');
  return {ok:true,status:200,code:'PILOT_SHAPE_OK'};
}
export function authorizeInvestorPilotSession({user,sessionToken,mode}={}){
  if(!user || user.isActive!==true || user.mustResetPassword===true || !SEAT_ROLES.has(user.role) ||
     typeof sessionToken!=='string' || !sessionToken || typeof user.sessionToken!=='string' ||
     user.sessionToken!==sessionToken)
    return fail(401,'PILOT_UNAUTHORIZED');
  let settings={};
  try {settings=JSON.parse(user.aiSettingsJson||'{}')}catch{return fail(403,'PILOT_DISABLED')}
  if(settings?.sharedConversationV1!==true)return fail(403,'PILOT_DISABLED');
  if(settings.liveAIEnabled===false || (mode==='qa' && settings.liveQA===false) ||
     (mode==='coach' && settings.liveCoach===false))return fail(403,'PILOT_FEATURE_DENIED');
  if(!MANAGER_ROLES.has(user.role)){
    let permissions={};
    try{permissions=JSON.parse(user.permissions||'{}')}catch{return fail(403,'PILOT_FEATURE_DENIED')}
    if(permissions.liveAIAssistant!==true || (mode==='qa' && permissions.liveQA!==true) ||
       (mode==='coach' && permissions.liveCoach!==true))return fail(403,'PILOT_FEATURE_DENIED');
  }
  return {ok:true,status:200,code:'PILOT_SESSION_AUTHORIZED'};
}
export function authorizeInvestorPilotLead({user,lead}={}){
  if(!user || !lead?.id || lead.deletedAt)return fail(403,'PILOT_LEAD_DENIED');
  // No broad manager bypass: the still-unverified Core tenant link must not
  // be replaced with a shared, app-wide administrative read privilege.
  if(!lead.debtCoachOwner || String(lead.debtCoachOwner).toLowerCase() !== String(user.username||'').toLowerCase())
    return fail(403,'PILOT_LEAD_DENIED');
  return {ok:true,status:200,code:'PILOT_LEAD_AUTHORIZED'};
}
export function requireInvestorPilotAuthority({tenantLink,kbApproval,meteringAuthority}={}){
  // Only **server-fetched** independent records may be passed by a future
  // trusted gateway. Browser claims must never populate these arguments.
  if(tenantLink?.verification_status!=='verified' || tenantLink?.source!=='rosie_core')
    return fail(409,'PILOT_TENANT_LINK_PENDING');
  if(kbApproval?.status!=='approved' || kbApproval?.source!=='server_verified' ||
     !kbApproval?.version)return fail(409,'PILOT_APPROVED_KB_PENDING');
  if(meteringAuthority?.status!=='verified' || meteringAuthority?.source!=='rosie_core' ||
     !meteringAuthority?.ledger_id)return fail(409,'PILOT_METERING_PENDING');
  return {ok:true,status:200,code:'PILOT_AUTHORITY_READY'};
}
