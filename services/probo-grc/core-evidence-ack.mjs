/** Signed acknowledgement of bridge persistence, NOT Probo GRC import. */
import { createHmac, timingSafeEqual } from 'node:crypto';
const HEX=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const STATUSES=new Set(['accepted','duplicate']);
function canonical(x) {
 return ['rosie.grc.ack.v1',x.receipt_id,x.event_id,x.request_digest,x.status,x.stage,x.timestamp].join('\n');
}
function mac(key,body) { return createHmac('sha256',key).update(body).digest('hex'); }
export function signBridgeAck(result,{key,requestDigest,timestamp=Date.now()}) {
 if(typeof key!=='string'||key.length<32) throw Error('ack_key_required');
 if(!result||!ID.test(result.receipt_id)||!ID.test(result.event_id)||!STATUSES.has(result.status)||
   !HEX.test(requestDigest)||!Number.isSafeInteger(timestamp)) throw Error('invalid_ack_input');
 const body={contract:'rosie.grc.ack.v1',stage:'bridge_persisted',status:result.status,
   receipt_id:result.receipt_id,event_id:result.event_id,request_digest:requestDigest,timestamp};
 return {...body,signature:mac(key,canonical(body))};
}
export function verifyBridgeAck(ack,{key,expectedDigest,expectedEventId,now=Date.now()}) {
 if(!ack||typeof ack!=='object'||Array.isArray(ack)) throw Error('invalid_ack');
 const fields=['contract','stage','status','receipt_id','event_id','request_digest','timestamp','signature'];
 if(Object.keys(ack).length!==fields.length||fields.some(k=>!(k in ack))) throw Error('invalid_ack_fields');
 if(ack.contract!=='rosie.grc.ack.v1'||ack.stage!=='bridge_persisted'||!STATUSES.has(ack.status)||
   !ID.test(ack.receipt_id)||!ID.test(ack.event_id)||!Number.isSafeInteger(ack.timestamp)||
   !HEX.test(ack.request_digest)||!HEX.test(ack.signature)) throw Error('invalid_ack_claims');
 if(Math.abs(now-ack.timestamp)>300000) throw Error('stale_ack');
 if(ack.event_id!==expectedEventId||ack.request_digest!==expectedDigest) throw Error('ack_context_mismatch');
 if(typeof key!=='string'||key.length<32) throw Error('ack_key_required');
 const expected=mac(key,canonical(ack));
 if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(ack.signature,'hex')))throw Error('invalid_ack_signature');
 return Object.freeze({stage:ack.stage,status:ack.status,receipt_id:ack.receipt_id,event_id:ack.event_id});
}
