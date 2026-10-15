// Queue the customer before ending the staff calls. The conference may already
// be gone because the customer is listening on their own call leg.
export async function queueFronterCustomer({ body, entities, twilioFetch, findConferenceSid, holdUrl }) {
  const { conferenceName, leadId, agentCallSid } = body;
  const fronterSid = body.fronterCallSid || (conferenceName.startsWith('fronter_conf_') ? conferenceName.slice('fronter_conf_'.length) : '');
  const page = await entities.FronterHeadsUp.filter(
    leadId ? { leadId, status: 'active' } : { conferenceName, status: 'active' },
    { sort: '-created_date', limit: 1 }
  );
  const headsUp = page.items[0];
  let customerCallSid = body.customerCallSid || headsUp?.customerCallSid || '';
  if (!customerCallSid && fronterSid) {
    const children = await twilioFetch(`/Calls.json?ParentCallSid=${encodeURIComponent(fronterSid)}&Status=in-progress`);
    customerCallSid = children.calls?.[0]?.sid || '';
  }
  if (!customerCallSid) {
    const conferenceSid = await findConferenceSid(conferenceName);
    if (conferenceSid) {
      const { participants = [] } = await twilioFetch(`/Conferences/${conferenceSid}/Participants.json`);
      customerCallSid = participants.find(p => p.hold && p.call_sid !== fronterSid && p.call_sid !== agentCallSid)?.call_sid || '';
    }
  }
  if (!customerCallSid || customerCallSid === fronterSid || customerCallSid === agentCallSid) {
    const error = new Error('The customer call is no longer available to queue.');
    error.status = 409;
    throw error;
  }
  // A failed redirect must never disconnect the fronter or claim queue success.
  await twilioFetch(`/Calls/${customerCallSid}.json`, {
    method: 'POST', body: new URLSearchParams({ Url: holdUrl, Method: 'POST' }),
  });
  const queue = {
    conferenceName, customerCallSid, status: 'active',
    fronterUsername: body.fronterUsername || headsUp?.fronterUsername || '',
    leadId: leadId || headsUp?.leadId || '',
    leadName: body.leadName || headsUp?.leadName || '',
    leadPhone: body.leadPhone || headsUp?.leadPhone || '',
    leadEmail: body.leadEmail || headsUp?.leadEmail || '',
    lineKey: body.lineKey || headsUp?.lineKey || '',
  };
  if (headsUp) await entities.FronterHeadsUp.update(headsUp.id, queue);
  else await entities.FronterHeadsUp.create({ ...queue, createdAt: new Date().toISOString() });
  // Only end the two known staff legs, never infer that an unknown participant
  // is the agent. A previously completed staff call is safe to ignore.
  const staffSids = [...new Set([agentCallSid, fronterSid].filter(Boolean))];
  await Promise.all(staffSids.map(async sid => {
    try {
      await twilioFetch(`/Calls/${sid}.json`, {
        method: 'POST', body: new URLSearchParams({ Status: 'completed' }),
      });
    } catch (error) {
      if (error.status !== 404 && error.twilioCode !== 21220) throw error;
    }
  }));
  return { ok: true, conferenceName, customerCallSid };
}