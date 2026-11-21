/**
 * Rosie Core Agent Generation Engine v1.
 * Core-signed, staging-only blueprint registry and atomic identity allocator.
 * Registration is NOT runtime provisioning or activation.
 */
const TEAMS=new Set(['alpha','bravo','charlie','delta','echo','foxtrot']);
const TEMPLATES=new Set(['engineer','integrations','platform','ai','security','qa','support','custom']);
const CAPS=new Set(['code_read','code_write','tests','database_read','deploy_staging','connectors','messaging','ticket_read','ticket_write']);
const MODES=new Set(['draft','register']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateBlueprint(x){
 if(!x||typeof x!=='object'||Array.isArray(x))return 'invalid_blueprint';
 const keys=new Set(['org_id','request_id','mode','display_name','role','team','captain_id','mission','capabilities','model','monthly_budget_usd','nonce']);
 if(Object.keys(x).some(k=>!keys.has(k)))return 'unsupported_blueprint_field';
 if(x.org_id!=='rosie-core-internal'||!UUID.test(x.request_id||'')||!UUID.test(x.nonce||''))return 'invalid_identity_or_nonce';
 if(!MODES.has(x.mode))return 'invalid_generation_mode';
 if(typeof x.display_name!=='string'||x.display_name.trim().length<3||x.display_name.length>90)return 'invalid_display_name';
 if(!TEMPLATES.has(x.role)||!TEAMS.has(x.team))return 'invalid_team_or_role';
 if(typeof x.captain_id!=='string'||!/^A[0-9]{2,4}$/.test(x.captain_id))return 'invalid_captain';
 if(typeof x.mission!=='string'||x.mission.trim().length<15||x.mission.length>2000)return 'invalid_mission';
 if(!Array.isArray(x.capabilities)||x.capabilities.length>8||new Set(x.capabilities).size!==x.capabilities.length||x.capabilities.some(c=>!CAPS.has(c)))return 'invalid_capabilities';
 if(x.model!==undefined&&(typeof x.model!=='string'||!/^[-a-zA-Z0-9_.]{2,70}$/.test(x.model)))return 'invalid_model';
 if(x.monthly_budget_usd!==undefined&&(!Number.isInteger(x.monthly_budget_usd)||x.monthly_budget_usd<0||x.monthly_budget_usd>1000))return 'invalid_budget';
 // Code writes and deploys can be requested in a blueprint but NEVER granted by the generator.
 return null;
}
function planBlueprint(x){
 return {contract:'rosie.core.agent_factory.v1',display_name:x.display_name.trim(),
  team:x.team,role:x.role,captain_id:x.captain_id,mission:x.mission.trim(),
  requested_capabilities:x.capabilities,granted_capabilities:[],
  model:x.model||'core_default',monthly_budget_usd:x.monthly_budget_usd??0,
  provisioning_state:'pending',execution_authorized:false,
  message_runtime_attested:false,qa_attested:false};
}
async function generateAgent(sql,x){
 const error=validateBlueprint(x);if(error)return {error,status:400};
 const plan=planBlueprint(x);
 return sql.begin(async t=>{
  await t`SET LOCAL statement_timeout='5000ms'`;
  // Serializes concurrent calls across gateway instances; the allocation never reuses IDs.
  await t`SELECT pg_advisory_xact_lock(192021,241100)`;
  const prior=await t`SELECT request_id,agent_id,blueprint,mode
    FROM core_agents.agent_generation_requests WHERE request_id=${x.request_id}`;
  if(prior.length){
   if(JSON.stringify(prior[0].blueprint)!==JSON.stringify(plan)||prior[0].mode!==x.mode)
    return {error:'request_id_conflict',status:409};
   return {accepted:true,idempotent:true,request_id:x.request_id,
    agent_id:prior[0].agent_id,plan:prior[0].blueprint};
  }
  const captain=await t`SELECT agent_id,desired_state FROM core_agents.identities
    WHERE org_id=${x.org_id} AND agent_id=${x.captain_id}`;
  if(captain.length!==1||captain[0].desired_state==='revoked')return {error:'captain_not_registered',status:409};
  const count=await t`SELECT count(*)::int AS n FROM core_agents.agent_team_assignments
    WHERE team_key=${x.team} AND assignment_state IN ('reserved','assigned')`;
  if(count[0].n>=4)return {error:'team_capacity_four_reached',status:409};
  let agentId=null;
  if(x.mode==='register'){
   const latest=await t`SELECT coalesce(max(substring(agent_id FROM 2)::integer),18)::int AS n
     FROM core_agents.identities WHERE org_id=${x.org_id}`;
   const seq=Math.max(18,latest[0].n)+1;
   if(seq>9999)return {error:'identity_namespace_exhausted',status:409};
   agentId='A'+String(seq).padStart(2,'0');
   await t`INSERT INTO core_agents.identities
    (org_id,agent_id,display_name,role,inbox,desired_state,runtime_state)
    VALUES (${x.org_id},${agentId},${plan.display_name},${plan.role},
    ${'core://agents/'+agentId+'/inbox'},'provisioning','unverified')`;
   await t`INSERT INTO core_agents.agent_team_assignments
    (org_id,agent_id,team_key,captain_id,assignment_state)
    VALUES (${x.org_id},${agentId},${x.team},${x.captain_id},'reserved')`;
  }
  await t`INSERT INTO core_agents.agent_generation_requests
   (request_id,org_id,agent_id,mode,team_key,blueprint,state)
   VALUES(${x.request_id},${x.org_id},${agentId},${x.mode},
    ${x.team},${t.json(plan)},${x.mode==='draft'?'draft':'registered'})`;
  return {accepted:true,idempotent:false,request_id:x.request_id,
    agent_id:agentId,plan,status:x.mode==='register'?'registered_not_provisioned':'draft'};
 });
}
export {validateBlueprint,planBlueprint,generateAgent,TEAMS,TEMPLATES};
