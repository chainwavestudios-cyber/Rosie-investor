/**
 * Idempotent fall-through from Alex's TWO unanswered advisor phones into
 * Debt Call Coach. The prospect remains alive in the recorded Twilio queue.
 * This function does not dial anyone, redirect the customer, or book a callback.
 */
const rows = (page) => Array.isArray(page) ? page : (page?.items || page?.entities || []);
export async function preserveUnansweredAiCaller(service, leadId, conf, alert) {
  if (!leadId) return { ok:false,reason:'missing_lead_id' };
  const now = new Date().toISOString();
  const lead = await service.entities.FronterLead.get(leadId).catch(()=>null);
  if (!lead) return { ok:false,reason:'missing_fronter_lead' };

  let debtId = lead.migratedDebtLeadId || alert?.migratedDebtLeadId || '';
  let newProspect = false;
  if (!debtId) {
    const existing = await service.entities.DebtLead.filter(
      {sourceFronterLeadId:leadId}, {limit:1}
    ).catch(()=>null);
    debtId = rows(existing)[0]?.id || '';
  }
  if (!debtId) {
    const name = [lead.firstName,lead.lastName].filter(Boolean).join(' ').trim() || 'AI caller';
    const notes = [
      'Alex outbound AI agent: warm handoff attempted; both advisor numbers were unavailable.',
      'Caller remains on the recorded transfer queue, awaiting manual pickup or follow-up.',
      'Source Fronter lead: '+leadId,
      'AI queue created: '+now,
      lead.notes || '',
    ].filter(Boolean).join('\n\n');
    const contact = {
      firstName:lead.firstName||'',lastName:lead.lastName||'',phone:lead.phone||'',
      email:lead.email||'',address:lead.address||'',city:lead.city||'',state:lead.state||'',
      zip:lead.zipCode||'',debtAmount:Number(lead.debtAmount)||undefined,
      status:'new',cardType:'prospect',isProspect:true,prospectTaggedAt:now,
      prospectTaggedBy:'ai_agent',isHotLead:true,hotLeadTaggedAt:now,
      hotLeadTaggedBy:'ai_agent',migratedFromFronter:true,migratedAt:now,
      migratedBy:'ai_agent',sourceFronterLeadId:leadId,notes,
      lastCallAt:now,
    };
    for (const key of Object.keys(contact)) if(contact[key]===undefined) delete contact[key];
    const created = await service.entities.DebtLead.create(contact);
    debtId = created?.id || '';
    newProspect = !!debtId;
  }
  await service.entities.FronterLead.update(leadId,{
    status:'migrated',
    migratedAt:lead.migratedAt||now,migratedDebtLeadId:debtId,
    callStatus:'recording_queue',lastCallResult:'queued_no_connect',
    assignedQueue:'AI - Chris personal recording queue',
  });

  if(alert?.id){
    await service.entities.FronterHeadsUp.update(alert.id,{
      routeState:'recording_queue',advisorAttempt:2,
      migratedDebtLeadId:debtId,
    });
  }

  // The routeState and migratedDebtLeadId are the persistent popup keys.
  // Record ONE notification on first migration, never one per webhook retry.
  if(newProspect){
    const fullName=[lead.firstName,lead.lastName].filter(Boolean).join(' ').trim()||'New caller';
    const debt=Number(lead.debtAmount)>0
      ? Number(lead.debtAmount).toLocaleString('en-US')+' dollars reported debt'
      :'debt amount not yet confirmed';
    await service.entities.AppNotification.create({
      title:'Alex AI · Chris missed both handoff attempts',
      body:fullName+' ('+debt+') is in the recorded queue. Prospect card was created in Debt Call Coach.',
      type:'transfer',source:'Alex AI outbound',
      linkPath:'/debt-call-coach?tab=hotleads',read:false,
    }).catch(()=>{});
  }
  return {ok:!!debtId,debtLeadId:debtId,queued:true};
}
