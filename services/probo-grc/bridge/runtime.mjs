/** Isolated Core->Probo staging evidence-inbox runtime.
 * This is a staging bridge receiver. It does not claim Probo GRC ingestion.
 * TLS must terminate at trusted ingress; restrict inbound networking in hosting.
 */
import { Pool } from 'pg';
import { postgresEvidenceAdapter } from '../postgres-evidence-adapter.mjs';
import { createEvidenceReceiver } from '../core-evidence-receiver.mjs';
function required(name) {
 const x=process.env[name];if(!x||!x.trim())throw Error('required_configuration_missing:'+name);return x;
}
function identifier(name) {
 const x=required(name);
 if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(x))throw Error('invalid_configuration:'+name);
 return x;
}
if (process.env.CORE_BRIDGE_ENABLED!=='true'||process.env.NODE_ENV!=='staging')
 throw Error('staging_bridge_not_explicitly_enabled');
const key=required('CORE_BRIDGE_SOURCE_HMAC_KEY');
const ackKey=required('CORE_BRIDGE_ACK_HMAC_KEY');
if(key.length<32||ackKey.length<32||key===ackKey)throw Error('insecure_bridge_keys');
const source=identifier('CORE_BRIDGE_SOURCE_ID');
const sourceOrg=identifier('CORE_BRIDGE_SOURCE_ORG');
const proboOrg=identifier('CORE_BRIDGE_PROBO_ORG');
const appKey=required('CORE_BRIDGE_SOURCE_APP_KEY');
if(!['core','bob'].includes(appKey))throw Error('unsupported_app_key');
const databaseUrl=required('CORE_BRIDGE_DATABASE_URL');
const parsed=new URL(databaseUrl);
if(!['postgres:','postgresql:'].includes(parsed.protocol)||parsed.hostname==='localhost')
 throw Error('invalid_database_url');
const pool=new Pool({connectionString:databaseUrl,ssl:{rejectUnauthorized:true},max:3,
 connectionTimeoutMillis:5000,idleTimeoutMillis:10000,statement_timeout:10000});
await pool.query('SELECT 1 FROM rosie_grc_bridge.evidence_inbox LIMIT 1');
const config={adapter:postgresEvidenceAdapter(pool),ackKey,
 sources:{[source]:{enabled:true,key,app_key:appKey,source_org_id:sourceOrg,
 probo_org_id:proboOrg,approvedSourceOrganizations:[sourceOrg]}}};
const server=createEvidenceReceiver(config);
const port=Number(process.env.PORT||8080);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('invalid_port');
server.listen(port,'0.0.0.0');
process.on('SIGTERM',()=>server.close(()=>pool.end()));
