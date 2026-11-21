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
 if(x.model!==undefined&&!['core_default','gpt-6-luna'].includes(x.model))return 'invalid_model';
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
   if(prior[0].mode!==x.mode || !(await t`SELECT 1 FROM core_agents.agent_generation_requests WHERE request_id=${x.request_id} AND blueprint=${t.json(plan)}::jsonb`).length)
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
   // A never-cycling Neon sequence prevents accidental re-use after revocation
   // or deletion. Missing sequence is a hard error rather than an unsafe fallback.
   const allocated=await t`SELECT nextval('core_agents.agent_identity_seq')::int AS n`;
   const seq=allocated[0].n;
   if(seq>9999)return {error:'identity_namespace_exhausted',status:409};
   agentId='A'+String(seq).padStart(2,'0');
   await t`INSERT INTO core_agents.identities
    (org_id,agent_id,display_name,role,inbox,desired_state,runtime_state)
    VALUES (${x.org_id},${agentId},${plan.display_name},${plan.role},
    ${'agent.'+agentId.toLowerCase()},'provisioning','unverified')`;
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
/**
 * Read-only status contract. Core signs requests; unauthenticated browsers
 * never get direct database access or a copy of the shared gateway credential.
 */
function validateFactoryStatus(x){
 if(!x||typeof x!=='object'||Array.isArray(x))return 'invalid_status_request';
 if(Object.keys(x).some(k=>!['org_id','nonce','action','agent_id'].includes(k))||
    x.org_id!=='rosie-core-internal'||!UUID.test(x.nonce||'')||
    x.action!=='status'||(x.agent_id!==undefined&&!/^A[0-9]{2,4}$/.test(x.agent_id)))
  return 'invalid_status_request';
 return null;
}
async function inspectFactory(sql,x){
 const bad=validateFactoryStatus(x);
 if(bad)return {error:bad,status:400};
 const [counts,teams,recent]=await Promise.all([
  sql`SELECT
    (SELECT count(*)::int FROM core_agents.identities) AS registered_identities,
    (SELECT count(*)::int FROM core_agents.agent_generation_requests
       WHERE mode='register') AS generated_registrations,
    (SELECT count(*)::int FROM core_agents.agent_generation_requests
       WHERE mode='draft') AS drafts,
    (SELECT count(*)::int FROM core_agents.identities
       WHERE desired_state='ready' AND runtime_state='available') AS runnable_identities`,
  sql`SELECT team_key,count(*)::int AS reserved_slots
    FROM core_agents.agent_team_assignments
    WHERE assignment_state IN ('reserved','assigned')
    GROUP BY team_key ORDER BY team_key`,
  x.agent_id?sql`SELECT g.agent_id,g.request_id,g.mode,g.state,g.team_key,
      i.desired_state,i.runtime_state
      FROM core_agents.agent_generation_requests g JOIN core_agents.identities i
       ON i.org_id=g.org_id AND i.agent_id=g.agent_id
      WHERE g.agent_id=${x.agent_id} AND g.org_id='rosie-core-internal'
      LIMIT 1`:sql`SELECT g.agent_id,g.request_id,g.mode,g.state,g.team_key,
      i.desired_state,i.runtime_state
      FROM core_agents.agent_generation_requests g JOIN core_agents.identities i
       ON i.org_id=g.org_id AND i.agent_id=g.agent_id
      WHERE g.org_id='rosie-core-internal' AND g.agent_id IS NOT NULL
      ORDER BY g.created_at DESC LIMIT 24`
 ]);
 return {ok:true,contract:'rosie.core.agent_factory.status.v1',
  ...counts[0],teams,recent,execution_enabled:false};
}

export {validateBlueprint,planBlueprint,generateAgent,validateFactoryStatus,inspectFactory,TEAMS,TEMPLATES};
