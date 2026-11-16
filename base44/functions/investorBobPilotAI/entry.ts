import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  validateInvestorPilotPayload, authorizeInvestorPilotSession,
  authorizeInvestorPilotLead, requireInvestorPilotAuthority,
} from '../../shared/investorPilotAccess.mjs';

/**
 * Original Investor + Commercial BOB experimental inference gateway.
 * THIS IS A FAIL-CLOSED STAGING SCAFFOLD, NOT A LIVE PAID PROVIDER ROUTE.
 *
 * Legacy liveAssistantAI is unchanged. No tenant-to-Core link, approved
 * Investor KB/version, or authoritative metering record has been verified;
 * no LLM invocation is allowed until those are independently implemented.
 * Never trust client-sent role, organization, KB or usage/charge metadata.
 */
Deno.serve(async (req: Request): Promise<Response> => {
  const deny=(status: number, code: string)=>Response.json({
    error:code,
    blocked:true,
    message:'Investor BOB pilot is not yet approved for AI inference. No AI request was sent.',
  },{status});
  if(req.method!=='POST')return deny(405,'PILOT_METHOD_NOT_ALLOWED');
  let body: any;
  try {body=await req.json()}catch{return deny(400,'PILOT_INVALID_JSON')}
  const shape=validateInvestorPilotPayload(body);
  if(!shape.ok)return deny(shape.status,shape.code);
  let base44: any;
  try {base44=createClientFromRequest(req)}catch{return deny(503,'PILOT_PLATFORM_UNAVAILABLE')}
  let user: any;
  try {user=await base44.asServiceRole.entities.DebtCoachUser.get(body.sessionUserId)}
  catch{return deny(401,'PILOT_UNAUTHORIZED')}
  const session=authorizeInvestorPilotSession({user,sessionToken:body.sessionToken,mode:body.mode});
  if(!session.ok)return deny(session.status,session.code);
  let lead: any;
  try {lead=await base44.asServiceRole.entities.DebtLead.get(body.leadId)}
  catch{return deny(403,'PILOT_LEAD_DENIED')}
  const leadAccess=authorizeInvestorPilotLead({user,lead});
  if(!leadAccess.ok)return deny(leadAccess.status,leadAccess.code);

  // No authoritative Core tenancy / approved Investor knowledge / Core
  // usage-ledger bindings exist in this original app's verified sources.
  // DO NOT replace this with client-supplied organization_id, kbEntries or _ctx.
  const authority=requireInvestorPilotAuthority();
  if(!authority.ok)return deny(authority.status,authority.code);

  // Deliberately unavailable: a separate, security-reviewed integration
  // must fetch independently verified Core authority, signed KB, reserve
  // ledger usage and dispatch provider calls. Never fall back to legacy AI.
  return deny(503,'PILOT_PROVIDER_NOT_ENABLED');
});
