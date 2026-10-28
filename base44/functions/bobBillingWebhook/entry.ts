/**
 * Verified Stripe event intake for BOB billing. Uses raw webhook payload and
 * Stripe-Signature HMAC SHA-256, independent of customer browser redirects.
 * Event IDs are saved for idempotency; org seats come from paid subscription.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
const reply=(body:any,status=200)=>Response.json(body,{status});
const sigHex=(buf:ArrayBuffer)=>Array.from(new Uint8Array(buf)).map(c=>c.toString(16).padStart(2,'0')).join('');
function constantTime(a:string,b:string){
  if(a.length!==b.length)return false;
  let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;
}
async function signed(payload:string,header:string,secret:string){
  const parts=header.split(',').map(t=>t.trim().split('='));
  const timestamp=parts.find(([key])=>key==='t')?.[1];
  const signatures=parts.filter(([key])=>key==='v1').map(a=>a[1]);
  if(!timestamp||!/^\d+$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300)return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const calculated=sigHex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+payload)));
  return signatures.some(v=>constantTime(calculated,v));
}
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return reply({error:'POST required.'},405);
  const secret=Deno.env.get('BOB_STRIPE_WEBHOOK_SECRET')||'';
  if(!secret)return reply({error:'Webhook signing secret not configured.'},503);
  const body=await req.text(),header=req.headers.get('stripe-signature')||'';
  if(!await signed(body,header,secret))return reply({error:'Invalid Stripe signature.'},400);
  const event=JSON.parse(body);
  const db=createClientFromRequest(req).asServiceRole.entities;
  if(!event?.id || !event?.type)return reply({error:'Invalid event.'},400);
  if((await db.BOBBillingEvent.filter({eventId:event.id})).length>0)return reply({received:true,alreadyProcessed:true});
  const obj=event.data?.object||{};
  let org:any=null,subscription:any=null;
  try{
    if(event.type==='checkout.session.completed'&&obj.mode==='subscription'&&obj.payment_status!=='unpaid'){
      const organizationId=obj.client_reference_id||obj.metadata?.organizationId;
      if(organizationId)org=await db.BOBOrganization.get(organizationId).catch(()=>null);
      if(org){
        subscription=obj.subscription;
        // Never grant new paid access until the matching subscription has an
        // active/trialing status verified directly with Stripe.
        const key=Deno.env.get('STRIPE_SECRET_KEY')||'';
        const response=await fetch('https://api.stripe.com/v1/subscriptions/'+encodeURIComponent(subscription),
          {headers:{Authorization:'Bearer '+key}});
        const sub=await response.json();
        if(!response.ok)throw new Error('Stripe subscription verification failed.');
        const price=Deno.env.get('BOB_STRIPE_PRICE_PER_SEAT')||'';
        const paid=Array.isArray(sub.items?.data)?sub.items.data.find((line:any)=>line.price?.id===price):null;
        if(!paid)throw new Error('Webhook subscription price mismatch.');
        const seats=Math.max(1,Math.min(100000,Number(paid.quantity)||1));
        const members=await db.BOBMember.filter({organizationId:org.id});
        if(seats<members.filter((m:any)=>m.status==='active').length)throw new Error('Paid seats below assigned member count.');
        await db.BOBOrganization.update(org.id,{
          stripeCustomerId:obj.customer,stripeSubscriptionId:sub.id,billingPriceId:price,
          seatLimit:seats,billingStatus:sub.status,
          status:['active','trialing'].includes(sub.status)?'active':'suspended'
        });
      }
    }else if(event.type==='customer.subscription.updated'||event.type==='customer.subscription.deleted'){
      const ids=await db.BOBOrganization.filter({stripeSubscriptionId:obj.id});
      org=ids?.[0];
      if(org){
        const subscribed=['active','trialing'].includes(obj.status);
        const configuredPrice=Deno.env.get('BOB_STRIPE_PRICE_PER_SEAT')||'';
        const item=obj.items?.data?.find((line:any)=>line.price?.id===configuredPrice);
        const seats=Math.max(1,Math.min(100000,Number(item?.quantity)||Number(org.seatLimit)||1));
        const members=await db.BOBMember.filter({organizationId:org.id});
        if(seats< members.filter((m:any)=>m.status==='active').length)
          throw new Error('Subscription update has fewer seats than current assigned trainees.');
        await db.BOBOrganization.update(org.id,{
          billingStatus:obj.status||'cancelled',
          status:subscribed?'active':'suspended',seatLimit:seats
        });
      }
    }else if(event.type==='invoice.payment_failed'||event.type==='invoice.paid'){
      const ids=obj.subscription?await db.BOBOrganization.filter({stripeSubscriptionId:obj.subscription}):[];
      org=ids?.[0];
      if(org&&event.type==='invoice.payment_failed')
        await db.BOBOrganization.update(org.id,{billingStatus:'past_due'});
      else if(org&&event.type==='invoice.paid')
        await db.BOBOrganization.update(org.id,{billingStatus:'active',status:'active'});
    }
    await db.BOBBillingEvent.create({eventId:event.id,eventType:event.type,organizationId:org?.id||'',
      processedAt:new Date().toISOString()});
    return reply({received:true});
  }catch(e){
    console.error('[BOB Stripe webhook] Processing failed',event.type,event.id,e instanceof Error?e.message:'unexpected');
    // Do not acknowledge a failed event; Stripe will retry.
    return reply({error:'Could not reconcile event.'},500);
  }
});
