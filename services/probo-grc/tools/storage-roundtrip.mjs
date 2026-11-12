#!/usr/bin/env node
/**
 * Synthetic private S3 acceptance helper.
 * Operator obtains two short-lived presigned URLs from Neon, then executes this
 * helper from a trusted environment. Neither URL nor object contents are logged.
 * Performs PUT+GET+hash match; cleanup remains an explicitly separate action.
 */
import {createHash,randomBytes} from 'node:crypto';
const put=process.env.PROBO_TEST_PRESIGNED_PUT;
const get=process.env.PROBO_TEST_PRESIGNED_GET;
if (!put || !get) { console.error('Missing presigned PUT/GET environment variables. No storage operation performed.');process.exit(2); }
const payload=Buffer.from('rosie-probo-synthetic-v1:'+randomBytes(32).toString('hex'),'utf8');
const digest=b=>createHash('sha256').update(b).digest('hex');
const parse=url=>{const parsed=new URL(url);if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.aws.neon.tech'))throw Error('Only Neon HTTPS presigned URLs accepted');return url};
async function main(){
 const up=await fetch(parse(put),{method:'PUT',headers:{'Content-Type':'text/plain'},body:payload,signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!up.ok)throw Error('UPLOAD_FAILED_'+up.status);
 const down=await fetch(parse(get),{method:'GET',signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!down.ok)throw Error('DOWNLOAD_FAILED_'+down.status);
 const bytes=Buffer.from(await down.arrayBuffer());
 if(digest(bytes)!==digest(payload))throw Error('INTEGRITY_MISMATCH');
 console.log(JSON.stringify({status:'synthetic_put_get_verified',bytes:bytes.length,sha256:digest(bytes),note:'Does not verify Probo application integration, ACL rejection, retention, or cleanup. Do not log presigned URLs.'}));
}
main().catch(e=>{console.error('Acceptance check failed:',e.message);process.exitCode=1});
