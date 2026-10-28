/**
 * Commercial BOB subscription checkout and customer billing portal.
 * The price is set exclusively by BOB_STRIPE_PRICE_PER_SEAT (server secret).
 * Only a verified member with owner/admin role can initiate Stripe payments.
 * The browser cannot set the price amount or billing customer.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
const respond=(data:any,status=200)=>Response.json(data,{status});
const fail=(error:string,status=400)=>respond({error},status);
const safe=(v:unknown,n=200)=>String(v??'').trim().slice(0,n);
const stripe=async(key:string,path:string,params:Record<string,string|number|undefined>)=>{
  const body=new URLSearchParams();
  for(const [k,v] of Object.entries(params))if(v!==undefined)body.set(k,String(v));
  const result=await fetch('https://api.stripe.com/v1/'+path,{method:'POST',
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/x-www-form-urlencoded'},body});
  const data=await result.json();
  if(!result.ok)throw new Error('Stripe: '+(data?.error?.message||'Unexpected checkout error.'));
  return data;
};
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return fail('POST required.',405);
  try{
    const base44=createClientFromRequest(req);
    const user=await base44.auth.me().catch(()=>null);
    if(!user?.email)return fail('Sign in to BOB before managing billing.',401);
    const data=await req.json();
    const action=safe(data.action,45),organizationId=safe(data.organizationId,100),email=safe(user.email,255).toLowerCase();
    const db=base44.asServiceRole.entities;
    const org=await db.BOBOrganization.get(organizationId).catch(()=>null);
    const members=await db.BOBMember.filter({organizationId,email});
    const member=(members||[]).find((m:any)=>m.status==='active'&&['owner','admin'].includes(m.role));
    if(!org||!member)return fail('An organization owner or admin must manage billing.',403);
    const key=Deno.env.get('STRIPE_SECRET_KEY')||'';
    const price=Deno.env.get('BOB_STRIPE_PRICE_PER_SEAT')||'';
    if(action==='billingInfo')return respond({
      configured:!!key&&!!price,billingStatus:org.billingStatus||'trial',hasCustomer:!!org.stripeCustomerId,
      subscribed:!!org.stripeSubscriptionId,seatLimit:org.seatLimit,
      mode:key.startsWith('sk_live_')?'live':key?'test':'unconfigured'
    });
    if(!key)return fail('Stripe is not yet configured for BOB.',503);
    if(action==='checkout'){
      if(!/^price_[A-Za-z0-9]+$/.test(price))return fail('BOB seat pricing is being finalized. Contact sales for activation.',503);
      if(org.stripeSubscriptionId&&['active','trialing','past_due'].includes(org.billingStatus))
        return fail('This organization already has a subscription. Use Manage Billing.',409);
      const seats=Math.max(1,Math.min(100000,Number(org.seatLimit)||1));
      const params:Record<string,string|number|undefined>={
        mode:'subscription','line_items[0][price]':price,'line_items[0][quantity]':seats,
        'success_url':'https://rosieai-investorpage.base44.app/bob/portal?checkout=complete',
        'cancel_url':'https://rosieai-investorpage.base44.app/bob/portal?checkout=cancelled',
        'client_reference_id':organizationId,'metadata[organizationId]':organizationId,
        'subscription_data[metadata][organizationId]':organizationId,
        'subscription_data[metadata][ownerEmail]':org.ownerEmail,
        'allow_promotion_codes':'true'
      };
      if(org.stripeCustomerId)params['customer']=org.stripeCustomerId;
      else params['customer_email']=email;
      const session=await stripe(key,'checkout/sessions',params);
      if(!session?.url||!/^https:\/\/checkout\.stripe\.com\//.test(session.url))
        return fail('Stripe did not return a secure checkout link.',502);
      return respond({url:session.url,mode:key.startsWith('sk_live_')?'live':'test'});
    }
    if(action==='portal'){
      if(!org.stripeCustomerId)return fail('No Stripe billing customer linked to this organization yet.',409);
      const result=await stripe(key,'billing_portal/sessions',{
        customer:org.stripeCustomerId,return_url:'https://rosieai-investorpage.base44.app/bob/portal'
      });
      if(!result.url||!/^https:\/\/billing\.stripe\.com\//.test(result.url))
        return fail('No Stripe customer billing portal URL returned.',502);
      return respond({url:result.url});
    }
    return fail('Unknown action.',404);
  }catch(e){console.error('[BOB Billing]',e instanceof Error?e.message:'unexpected');return fail(e instanceof Error?e.message:'Billing failed.',500);}
});
