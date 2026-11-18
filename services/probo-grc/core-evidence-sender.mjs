/** Core-side single delivery attempt. Caller must own durable outbox, retry and dead-letter.
 * A verified ACK proves bridge inbox persistence only, NOT Probo GRC ingestion.
 */
import { randomUUID } from 'node:crypto';
import { makeSignedEnvelope } from './core-evidence-gateway.mjs';
import { verifyBridgeAck } from './core-evidence-ack.mjs';
export async function deliverEvidenceOnce({
  event,endpoint,source,key,ackKey,send=fetch,now=Date.now(),timeoutMs=8000
}) {
 if(typeof endpoint!=='string')throw Error('invalid_endpoint');
 let u;try {u=new URL(endpoint);}catch {throw Error('invalid_endpoint');}
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/v1/evidence')
   throw Error('insecure_or_unapproved_endpoint');
 if(typeof send!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)throw Error('invalid_delivery_options');
 const envelope=makeSignedEnvelope({event,source,key,timestamp:now,nonce:randomUUID()});
 const abort=new AbortController();
 const timer=setTimeout(()=>abort.abort(),timeoutMs);
 try {
   const response=await send(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify(envelope),redirect:'error',signal:abort.signal});
   if(!response||response.status!==202)throw Error('bridge_delivery_not_accepted');
   // Response size is capped by API convention; no untrusted Probo content is processed.
   const text=await response.text();
   if(text.length>8192)throw Error('ack_too_large');
   let ack;try {ack=JSON.parse(text);}catch {throw Error('malformed_ack');}
   return verifyBridgeAck(ack,{key:ackKey,expectedDigest:envelope.digest,
       expectedEventId:event.source_event_id,now:Date.now()});
 }finally {clearTimeout(timer);}
}
