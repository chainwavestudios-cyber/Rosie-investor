/**
 * fronterCall — Twilio call control for the fronter system.
 *
 * Actions:
 *   merge       — Convert a 1:1 fronter↔customer call into a conference,
 *                 dial the agent in, so the fronter can disconnect and leave
 *                 customer + agent connected.
 *   listen      — Admin joins an active conference muted (listen only).
 *   barge       — Admin joins an active conference unmuted (can speak).
 *   endListen   — Remove the admin's participant leg from the conference.
 *   getConference — Fetch conference status + participants by name.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { lineNumber, toE164, xmlEscape, twilioFetch, confTwiML, findConferenceSid, waitForConference } from '../../shared/twilioHelpers.ts';
import { queueFronterCustomer } from '../../shared/queueFronterCustomer.js';

const BASE_URL = 'https://rosieai-investorpage.base44.app';

async function getHoldAudioUrl(req: Request): Promise<string> {
  try {
    const base44 = createClientFromRequest(req).asServiceRole;
    const activeAudio = await base44.entities.FronterHoldAudio.filter({ isActive: true }, '-uploadedAt', 1);
    if (activeAudio?.[0]?.fileUri) {
      const signed = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: activeAudio[0].fileUri, expires_in: 3600 });
      return signed?.signed_url || '';
    }
  } catch {}
  return '';
}

// Twilio plays HoldUrl to a held participant (default is generic Twilio music)
function holdParams(holdAudioUrl: string): Record<string, string> {
  return holdAudioUrl ? { Hold: 'true', HoldUrl: holdAudioUrl, HoldMethod: 'GET' } : { Hold: 'true' };
}

// Fronter's browser call SID is encoded in the conference name (fronter_conf_<CallSid>)
function fronterSidFromConf(name: string): string {
  return (name || '').startsWith('fronter_conf_') ? name.slice('fronter_conf_'.length) : '';
}

// Move customer (child) into the conference FIRST, then the fronter (parent).
// Redirecting both at once via Promise.all races: if the fronter's redirect
// lands first, the <Dial> breaks and the customer's call is dropped before
// their redirect takes effect. Redirecting the customer first also ensures
// the conference's waitUrl is the custom hold audio (the first participant
// to join sets it), so holding the customer later plays the right audio.
async function moveIntoConference(fronterCallSid: string, confName: string, holdAudioUrl: string): Promise<string | null> {
  let customerCallSid: string | null = null;
  try {
    const childCalls = await twilioFetch(`/Calls.json?ParentCallSid=${fronterCallSid}&Status=in-progress`);
    customerCallSid = childCalls.calls?.[0]?.sid || null;
  } catch (e) { console.warn('Child calls lookup failed:', e.message); }

  // 1. Redirect the customer into the conference with the custom hold audio
  //    as waitUrl. This creates the conference and sets its wait music.
  if (customerCallSid) {
    try {
      await twilioFetch(`/Calls/${customerCallSid}.json`, {
        method: 'POST',
        body: new URLSearchParams({ Twiml: confTwiML(confName, false, holdAudioUrl) }),
      });
    } catch (e) { console.warn('Customer redirect failed:', e.message); }
  }

  // 2. Moving the customer ends the fronter's <Dial>; its action callback
  //    (voicemailWebhook) puts the fronter into the same conference.
  //    Fallback: if the fronter isn't in the conference after a few seconds, redirect them.
  if (customerCallSid) {
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 400));
      try {
        const confSid = await findConferenceSid(confName);
        if (confSid) {
          const parts = await twilioFetch(`/Conferences/${confSid}/Participants.json`);
          if ((parts.participants || []).some((p: any) => p.call_sid === fronterCallSid)) return customerCallSid;
        }
      } catch {}
    }
  }
  try {
    await twilioFetch(`/Calls/${fronterCallSid}.json`, {
      method: 'POST',
      body: new URLSearchParams({ Twiml: confTwiML(confName, false, '') }),
    });
  } catch (e) { console.warn('Fronter redirect failed:', e.message); }

  return customerCallSid;
}

export default async function(req) {
  try {
    // Parse body — JSON for app calls, form-encoded for Twilio callbacks
    const contentType = req.headers.get('content-type') || '';
    let body: any;
    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      const form = await req.formData();
      body = Object.fromEntries(form.entries());
    }
    const { action } = body;

    // ── AGENT STATUS CALLBACK: redirect customer from hold to conference ──
    //   When the agent answers (CallStatus=in-progress), pull the customer
    //   out of the hold+<Gather> TwiML and into the conference so they can
    //   talk to the agent.
    const url = new URL(req.url);
    const agentStatusCallback = url.searchParams.get('agentStatusCallback');
    if (agentStatusCallback === '1') {
      const cbCustomerCallSid = url.searchParams.get('customerCallSid') || '';
      const cbConfName = url.searchParams.get('conferenceName') || '';
      if (body.CallStatus === 'in-progress' && cbCustomerCallSid && cbConfName) {
        // No waitUrl — the agent is already in (or joining) the conference.
        // The customer should join silently and talk to the agent, no music.
        try {
          await twilioFetch(`/Calls/${cbCustomerCallSid}.json`, {
            method: 'POST',
            body: new URLSearchParams({ Twiml: confTwiML(cbConfName, false, '') }),
          });
        } catch {}
      }
      return Response.json({ ok: true });
    }

    // ── MERGE: put customer on hold (per-caller audio + appointment detection) ──
    //   Customer is redirected to the appointmentVoiceHandler which plays the
    //   hold audio on their own call leg (starts from the beginning for each
    //   person) while a <Gather> listens for "appointment". The agent is dialed
    //   into a conference; when the agent answers, a status callback redirects
    //   the customer from hold into the conference.
    //   If hold audio is configured, the customer hears it while the agent
    //   is being connected. The fronter's leg is NOT redirected into the
    //   conference (their <Dial> completes and the call ends naturally) so
    //   the customer is alone in the conference and hears the waitUrl audio.
    //   When the agent joins, the customer is no longer alone and the audio
    //   stops automatically — the merged call proceeds with customer + agent.
    if (action === 'merge') {
      const { fronterCallSid, agentPhone, lineKey, conferenceName, leadId, leadEmail } = body;
      if (!fronterCallSid && !conferenceName) return Response.json({ error: 'fronterCallSid or conferenceName required' }, { status: 400 });
      if (!agentPhone) return Response.json({ error: 'agentPhone required' }, { status: 400 });

      const fromNumber = lineNumber(lineKey);
      const confName = conferenceName || `fronter_conf_${fronterCallSid}`;
      const holdAudioUrl = await getHoldAudioUrl(req);

      // Find the customer's child call (the other leg of the fronter's call)
      const childCalls = await twilioFetch(`/Calls.json?ParentCallSid=${fronterCallSid}`);
      const customerCallSid = childCalls.calls?.[0]?.sid;

      // Redirect customer to the hold + appointment detection flow.
      // Each customer gets their own <Play> on their own call leg, so the
      // hold audio starts from the beginning for each person independently.
      if (customerCallSid) {
        const holdUrl = `${BASE_URL}/functions/appointmentVoiceHandler?step=hold&leadId=${encodeURIComponent(leadId || '')}`;
        try {
          await twilioFetch(`/Calls/${customerCallSid}.json`, {
            method: 'POST',
            body: new URLSearchParams({ Url: holdUrl }),
          });
        } catch {}
      }

      // Dial the agent into the conference with a status callback.
      // When the agent answers, the callback redirects the customer from
      // the hold <Gather> into the conference so they can talk.
      const statusCallbackUrl = `${BASE_URL}/functions/fronterCall?agentStatusCallback=1&customerCallSid=${encodeURIComponent(customerCallSid || '')}&conferenceName=${encodeURIComponent(confName)}`;
      await twilioFetch(`/Calls.json`, {
        method: 'POST',
        body: new URLSearchParams({
          To: toE164(agentPhone),
          From: fromNumber,
          Twiml: confTwiML(confName, false, ''),
          StatusCallback: statusCallbackUrl,
          StatusCallbackEvent: 'in-progress',
          StatusCallbackMethod: 'POST',
        }),
      });

      // Update FronterHeadsUp with customerCallSid + conferenceName
      if (customerCallSid && leadId) {
        try {
          const b44 = createClientFromRequest(req).asServiceRole;
          const headsUps = await b44.entities.FronterHeadsUp.filter({ leadId, status: 'active' });
          if (headsUps?.[0]) {
            await b44.entities.FronterHeadsUp.update(headsUps[0].id, { customerCallSid, conferenceName: confName });
          }
        } catch {}
      }

      return Response.json({ ok: true, conferenceName: confName });
    }

    // ── MERGE DIAL: put customer on hold, keep fronter in conference, dial agent ──
    //   Two-step warm merge: Step 1 — fronter talks to agent while customer is on hold.
    //   The fronter's browser leg stays in the conference so the call doesn't drop.
    if (action === 'mergeDial') {
      const { fronterCallSid, agentPhone, lineKey, conferenceName, leadId, leadEmail } = body;
      if (!fronterCallSid && !conferenceName) return Response.json({ error: 'fronterCallSid or conferenceName required' }, { status: 400 });
      if (!agentPhone) return Response.json({ error: 'agentPhone required' }, { status: 400 });

      const fromNumber = lineNumber(lineKey);
      const confName = conferenceName || `fronter_conf_${fronterCallSid}`;
      const holdAudioUrl = await getHoldAudioUrl(req);

      const existingConf = await findConferenceSid(confName);
      const fronterSid = fronterCallSid || fronterSidFromConf(confName);
      let customerCallSid = body.customerCallSid || '';

      if (!existingConf) {
        // Create conference: move customer + fronter into it together
        customerCallSid = await moveIntoConference(fronterSid, confName, holdAudioUrl) || '';

        if (customerCallSid && leadId) {
          try {
            const b44 = createClientFromRequest(req).asServiceRole;
            const headsUps = await b44.entities.FronterHeadsUp.filter({ leadId, status: 'active' });
            if (headsUps?.[0]) {
              await b44.entities.FronterHeadsUp.update(headsUps[0].id, { customerCallSid, conferenceName: confName });
            }
          } catch {}
        }
      }

      const confSid = await waitForConference(confName);
      if (!confSid) return Response.json({ error: 'Conference not found — the call may have ended' }, { status: 404 });
      // Give the customer leg a moment to join before holding it
      await new Promise(r => setTimeout(r, 800));

      // Redirect customer to appointmentVoiceHandler for per-caller hold audio
      // (starts from the beginning each time) + Polly-based appointment detection.
      // The customer leaves the conference; mergeConnect/noConnect bring them back.
      try {
        const participants = await twilioFetch(`/Conferences/${confSid}/Participants.json`);
        for (const p of participants.participants || []) {
          if (p.call_sid !== fronterSid && !p.hold) {
            customerCallSid = p.call_sid;
            const holdUrl = `${BASE_URL}/functions/appointmentVoiceHandler?step=hold&leadId=${encodeURIComponent(leadId || '')}`;
            await twilioFetch(`/Calls/${p.call_sid}.json`, {
              method: 'POST',
              body: new URLSearchParams({ Url: holdUrl }),
            });
            // Store customer call SID in FronterHeadsUp for mergeConnect/noConnect/grab
            if (leadId) {
              try {
                const b44 = createClientFromRequest(req).asServiceRole;
                const headsUps = await b44.entities.FronterHeadsUp.filter({ leadId, status: 'active' });
                if (headsUps?.[0]) {
                  await b44.entities.FronterHeadsUp.update(headsUps[0].id, { customerCallSid: p.call_sid, conferenceName: confName });
                }
              } catch {}
            }
          }
        }
      } catch (e) { console.warn('Redirect customer to hold failed:', e.message); }

      // Dial the agent into the conference. No machine detection — the fronter
      // listens and manually decides: merge, try next line, or no connect.
      console.log('mergeDial: dialing agent', toE164(agentPhone), 'from', fromNumber, 'conf', confName);
      const agentCall = await twilioFetch(`/Calls.json`, {
        method: 'POST',
        body: new URLSearchParams({
          To: toE164(agentPhone),
          From: fromNumber,
          Twiml: confTwiML(confName, false, ''),
        }),
      });

      return Response.json({ ok: true, conferenceName: confName, agentCallSid: agentCall?.sid || '', customerCallSid });
    }

    // ── MERGE CONNECT: unhold customer, remove fronter from conference ──
    //   Step 2 — bridge customer + agent, drop the fronter's browser leg.
    if (action === 'mergeConnect') {
      const { conferenceName } = body;
      if (!conferenceName) return Response.json({ error: 'conferenceName required' }, { status: 400 });

      const confSid = await findConferenceSid(conferenceName);
      if (!confSid) return Response.json({ error: 'Conference not found' }, { status: 404 });

      const fronterSid = body.fronterCallSid || fronterSidFromConf(conferenceName);
      const participants = await twilioFetch(`/Conferences/${confSid}/Participants.json`);
      // Unhold any held participants in the conference (legacy Hold API flow)
      for (const p of participants.participants || []) {
        if (p.hold) {
          try {
            await twilioFetch(`/Conferences/${confSid}/Participants/${p.call_sid}.json`, {
              method: 'POST',
              body: new URLSearchParams({ Hold: 'false' }),
            });
          } catch (e) { console.warn('Unhold failed:', e.message); }
        }
      }
      // Redirect customer from appointmentVoiceHandler back into the conference
      // (new flow — customer was redirected to hold, not held in the conference)
      try {
        const b44 = createClientFromRequest(req).asServiceRole;
        const headsUps = await b44.entities.FronterHeadsUp.filter({ conferenceName, status: 'active' });
        const customerCallSid = headsUps?.[0]?.customerCallSid;
        if (customerCallSid) {
          await twilioFetch(`/Calls/${customerCallSid}.json`, {
            method: 'POST',
            body: new URLSearchParams({ Twiml: confTwiML(conferenceName, false, '') }),
          });
        }
      } catch (e) { console.warn('Redirect customer from hold failed:', e.message); }
      // Remove fronter's browser leg from conference + explicitly hang up their call
      for (const p of participants.participants || []) {
        if (fronterSid && p.call_sid === fronterSid) {
          try {
            await twilioFetch(`/Conferences/${confSid}/Participants/${p.call_sid}.json`, {
              method: 'POST',
              body: new URLSearchParams({ Status: 'completed' }),
            });
          } catch (e) { console.warn('Remove fronter failed:', e.message); }
        }
      }
      // Explicitly hang up the fronter's browser call so the Twilio device disconnects immediately
      if (fronterSid) {
        try {
          await twilioFetch(`/Calls/${fronterSid}.json`, {
            method: 'POST',
            body: new URLSearchParams({ Status: 'completed' }),
          });
        } catch (e) { console.warn('Fronter call hangup failed:', e.message); }
      }

      return Response.json({ ok: true });
    }

    // ── NO CONNECT: remove fronter + agent from conference, keep customer on hold ──
    //   The fronter couldn't reach the agent. The fronter's browser leg and the
    //   agent's leg are removed from the conference; the customer stays on hold
    //   in the queue with hold music. The fronter is free to dial the next prospect.
    if (action === 'noConnect') {
      const { conferenceName, leadId } = body;
      if (!conferenceName) return Response.json({ error: 'conferenceName required' }, { status: 400 });
      const base44 = createClientFromRequest(req).asServiceRole;
      const holdUrl = `${BASE_URL}/functions/appointmentVoiceHandler?step=hold&leadId=${encodeURIComponent(leadId || '')}`;
      const result = await queueFronterCustomer({
        body, entities: base44.entities, twilioFetch, findConferenceSid, holdUrl,
      });
      return Response.json(result);
    }

    // ── GRAB QUEUED CALL: Chris joins the conference unmuted, customer is unholded ──
    //   After NO CONNECT, the customer is left on hold in the queue. Chris (or an
    //   admin) can grab the call: join the conference unmuted, unhold the customer,
    //   and update the lead's disposition from 'queued_no_connect' to 'transferred'.
    if (action === 'grabQueuedCall') {
      const { conferenceName, adminUsername, lineKey, leadId } = body;
      if (!conferenceName) return Response.json({ error: 'conferenceName required' }, { status: 400 });
      if (!adminUsername) return Response.json({ error: 'adminUsername required' }, { status: 400 });

      const fromNumber = lineNumber(lineKey);
      const adminIdentity = `client:${adminUsername.replace(/[^a-zA-Z0-9_]/g, '_')}`;

      let confSid: string | null = null;
      for (let i = 0; i < 10; i++) {
        confSid = await findConferenceSid(conferenceName);
        if (confSid) break;
        await new Promise(r => setTimeout(r, 500));
      }
      if (!confSid) return Response.json({ error: 'Conference not found — the customer may have hung up' }, { status: 404 });

      // Unhold any held participants in the conference (legacy Hold API flow)
      const participants = await twilioFetch(`/Conferences/${confSid}/Participants.json`);
      for (const p of participants.participants || []) {
        if (p.hold) {
          try {
            await twilioFetch(`/Conferences/${confSid}/Participants/${p.call_sid}.json`, {
              method: 'POST',
              body: new URLSearchParams({ Hold: 'false' }),
            });
          } catch (e) { console.warn('Unhold failed:', e.message); }
        }
      }
      // Redirect customer from appointmentVoiceHandler back into the conference
      // (new flow — customer was redirected to hold, not held in the conference)
      try {
        const b44 = createClientFromRequest(req).asServiceRole;
        const headsUps = await b44.entities.FronterHeadsUp.filter({ conferenceName, status: 'active' });
        const customerCallSid = headsUps?.[0]?.customerCallSid;
        if (customerCallSid) {
          await twilioFetch(`/Calls/${customerCallSid}.json`, {
            method: 'POST',
            body: new URLSearchParams({ Twiml: confTwiML(conferenceName, false, '') }),
          });
        }
      } catch (e) { console.warn('Redirect customer from hold failed:', e.message); }

      // Add Chris/admin to the conference unmuted
      await twilioFetch(`/Conferences/${confSid}/Participants.json`, {
        method: 'POST',
        body: new URLSearchParams({
          To: adminIdentity,
          From: fromNumber,
          Muted: 'false',
          Beep: 'false',
        }),
      });

      // Update the lead's disposition from 'queued_no_connect' to 'transferred'
      if (leadId) {
        try {
          const b44 = createClientFromRequest(req).asServiceRole;
          const lead = await b44.entities.FronterLead.get(leadId);
          if (lead && lead.lastCallResult === 'queued_no_connect') {
            const now = new Date().toISOString();
            await b44.entities.FronterLead.update(leadId, {
              status: 'transferred',
              lastCallResult: 'transferred',
              transferredAt: now,
              transferredTo: adminUsername,
            });
          }
          // Close the heads-up alert
          const headsUps = await b44.entities.FronterHeadsUp.filter({ leadId, status: 'active' });
          for (const hu of headsUps || []) {
            await b44.entities.FronterHeadsUp.update(hu.id, { status: 'closed' });
          }
        } catch (e) { console.warn('Lead update failed:', e.message); }
      }

      return Response.json({ ok: true });
    }

    // ── GET AGENT CALL STATUS: poll the agent's outbound call status + machine detection result ──
    if (action === 'getAgentCallStatus') {
      const { agentCallSid } = body;
      if (!agentCallSid) return Response.json({ error: 'agentCallSid required' }, { status: 400 });
      try {
        const call = await twilioFetch(`/Calls/${agentCallSid}.json`);
        return Response.json({ status: call.status, answeredBy: call.AnsweredBy || '' });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    // ── CANCEL AGENT CALL: cancel the agent's outbound call without touching the conference ──
    if (action === 'cancelAgentCall') {
      const { agentCallSid } = body;
      if (!agentCallSid) return Response.json({ error: 'agentCallSid required' }, { status: 400 });
      try {
        await twilioFetch(`/Calls/${agentCallSid}.json`, {
          method: 'POST',
          body: new URLSearchParams({ Status: 'completed' }),
        });
      } catch (e) { console.warn('Cancel agent call failed:', e.message); }
      return Response.json({ ok: true });
    }

    // ── HOLD: convert 1:1 call → conference, hold the customer ──
    if (action === 'hold') {
      const { fronterCallSid, lineKey } = body;
      if (!fronterCallSid) return Response.json({ error: 'fronterCallSid required' }, { status: 400 });

      const confName = `fronter_conf_${fronterCallSid}`;
      const holdAudioUrl = await getHoldAudioUrl(req);
      const existingConf = await findConferenceSid(confName);

      if (!existingConf) {
        // First hold — convert 1:1 call to conference (customer gets custom hold audio as waitUrl)
        await moveIntoConference(fronterCallSid, confName, holdAudioUrl);
      }

      const confSid = await waitForConference(confName);
      if (!confSid) return Response.json({ error: 'Conference not found — the call may have ended' }, { status: 404 });
      await new Promise(r => setTimeout(r, 800));

      let participants: any;
      try {
        participants = await twilioFetch(`/Conferences/${confSid}/Participants.json`);
      } catch (e) {
        return Response.json({ error: 'Failed to list conference participants: ' + e.message }, { status: 500 });
      }
      // Hold everyone except the fronter's browser leg
      for (const p of participants.participants || []) {
        if (p.call_sid !== fronterCallSid) {
          try {
            await twilioFetch(`/Conferences/${confSid}/Participants/${p.call_sid}.json`, {
              method: 'POST',
              body: new URLSearchParams(holdParams(holdAudioUrl)),
            });
          } catch (e) { console.warn('Hold participant failed:', e.message); }
        }
      }
      return Response.json({ ok: true, conferenceName: confName });
    }

    // ── UNHOLD: release the customer from hold ──
    if (action === 'unhold') {
      const { conferenceName, fronterCallSid } = body;
      const confName = conferenceName || (fronterCallSid ? `fronter_conf_${fronterCallSid}` : '');
      if (!confName) return Response.json({ error: 'conferenceName required' }, { status: 400 });

      const confSid = await findConferenceSid(confName);
      if (!confSid) return Response.json({ error: 'Conference not found' }, { status: 404 });

      const participants = await twilioFetch(`/Conferences/${confSid}/Participants.json`);
      for (const p of participants.participants || []) {
        if (p.hold) {
          await twilioFetch(`/Conferences/${confSid}/Participants/${p.call_sid}.json`, {
            method: 'POST',
            body: new URLSearchParams({ Hold: 'false' }),
          });
        }
      }
      return Response.json({ ok: true });
    }

    // ── TRANSFER: cold transfer customer to a new number, drop fronter ──
    if (action === 'transfer') {
      const { fronterCallSid, transferTo, lineKey, conferenceName } = body;
      if (!transferTo) return Response.json({ error: 'transferTo required' }, { status: 400 });

      const fromNumber = lineNumber(lineKey);
      const transferTwiML = `<Response><Dial callerId="${fromNumber}"><Number>${toE164(transferTo)}</Number></Dial></Response>`;

      if (conferenceName) {
        const confSid = await findConferenceSid(conferenceName);
        if (confSid) {
          const participants = await twilioFetch(`/Conferences/${confSid}/Participants.json`);
          const fSid = fronterCallSid || fronterSidFromConf(conferenceName);
          const customerPart = (participants.participants || []).find((p: any) => p.call_sid !== fSid);
          if (customerPart) {
            await twilioFetch(`/Calls/${customerPart.call_sid}.json`, {
              method: 'POST',
              body: new URLSearchParams({ Twiml: transferTwiML }),
            });
          }
        }
      } else if (fronterCallSid) {
        const childCalls = await twilioFetch(`/Calls.json?ParentCallSid=${fronterCallSid}`);
        const customerCallSid = childCalls.calls?.[0]?.sid;
        if (customerCallSid) {
          await twilioFetch(`/Calls/${customerCallSid}.json`, {
            method: 'POST',
            body: new URLSearchParams({ Twiml: transferTwiML }),
          });
        }
      }

      // Hang up the fronter's leg
      if (fronterCallSid) {
        try {
          await twilioFetch(`/Calls/${fronterCallSid}.json`, {
            method: 'POST',
            body: new URLSearchParams({ Status: 'completed' }),
          });
        } catch {}
      }
      return Response.json({ ok: true });
    }

    // ── LISTEN: admin joins conference muted ──
    if (action === 'listen' || action === 'barge') {
      const { conferenceName, adminUsername, lineKey } = body;
      if (!conferenceName) return Response.json({ error: 'conferenceName required' }, { status: 400 });
      if (!adminUsername) return Response.json({ error: 'adminUsername required' }, { status: 400 });

      const fromNumber = lineNumber(lineKey);
      const muted = action === 'listen';

      // Wait briefly for conference to exist, then add admin as participant
      let confSid: string | null = null;
      for (let i = 0; i < 10; i++) {
        confSid = await findConferenceSid(conferenceName);
        if (confSid) break;
        await new Promise(r => setTimeout(r, 500));
      }
      if (!confSid) return Response.json({ error: 'Conference not found' }, { status: 404 });

      const adminIdentity = `client:${adminUsername.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      await twilioFetch(`/Conferences/${confSid}/Participants.json`, {
        method: 'POST',
        body: new URLSearchParams({
          To: adminIdentity,
          From: fromNumber,
          Muted: String(muted),
          Beep: 'false',
        }),
      });

      return Response.json({ ok: true, muted });
    }

    // ── END LISTEN: remove admin from conference ──
    if (action === 'endListen') {
      const { conferenceName, adminUsername } = body;
      const confSid = await findConferenceSid(conferenceName);
      if (!confSid) return Response.json({ error: 'Conference not found' }, { status: 404 });

      const participants = await twilioFetch(`/Conferences/${confSid}/Participants.json`);
      const adminIdentity = `client:${adminUsername.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      const adminPart = (participants.participants || []).find((p: any) => p.to === adminIdentity);
      if (adminPart) {
        await twilioFetch(`/Conferences/${confSid}/Participants/${adminPart.callSid}.json`, {
          method: 'POST',
          body: new URLSearchParams({ Status: 'completed' }),
        });
      }
      return Response.json({ ok: true });
    }

    // ── TAKEOVER: admin joins unmuted, fronter is removed from conference ──
    //   If the customer is still on hold (<Gather> TwiML, conference doesn't
    //   exist yet), redirect them into the conference first, then add the admin.
    if (action === 'takeover') {
      const { conferenceName, adminUsername, lineKey } = body;
      if (!conferenceName) return Response.json({ error: 'conferenceName required' }, { status: 400 });
      if (!adminUsername) return Response.json({ error: 'adminUsername required' }, { status: 400 });

      const fromNumber = lineNumber(lineKey);
      const adminIdentity = `client:${adminUsername.replace(/[^a-zA-Z0-9_]/g, '_')}`;

      let confSid: string | null = null;
      for (let i = 0; i < 10; i++) {
        confSid = await findConferenceSid(conferenceName);
        if (confSid) break;
        await new Promise(r => setTimeout(r, 500));
      }

      // Conference doesn't exist — customer is still on hold (<Gather>).
      // Look up customerCallSid from FronterHeadsUp and redirect them
      // into the conference so the admin can join.
      if (!confSid) {
        try {
          const b44 = createClientFromRequest(req).asServiceRole;
          const headsUps = await b44.entities.FronterHeadsUp.filter({ conferenceName, status: 'active' });
          const customerCallSid = headsUps?.[0]?.customerCallSid;
          if (customerCallSid) {
            const holdAudioUrl = await getHoldAudioUrl(req);
            await twilioFetch(`/Calls/${customerCallSid}.json`, {
              method: 'POST',
              body: new URLSearchParams({ Twiml: confTwiML(conferenceName, false, holdAudioUrl) }),
            });
            // Wait for conference to be created
            for (let i = 0; i < 10; i++) {
              confSid = await findConferenceSid(conferenceName);
              if (confSid) break;
              await new Promise(r => setTimeout(r, 500));
            }
          }
        } catch {}
      }

      if (!confSid) return Response.json({ error: 'Conference not found' }, { status: 404 });

      // Add admin unmuted (barge in)
      await twilioFetch(`/Conferences/${confSid}/Participants.json`, {
        method: 'POST',
        body: new URLSearchParams({
          To: adminIdentity,
          From: fromNumber,
          Muted: 'false',
          Beep: 'false',
        }),
      });

      // Remove the fronter's browser leg (client: participant that isn't the admin)
      const participants = await twilioFetch(`/Conferences/${confSid}/Participants.json`);
      for (const p of participants.participants || []) {
        if (p.to?.startsWith('client:') && p.to !== adminIdentity) {
          try {
            await twilioFetch(`/Conferences/${confSid}/Participants/${p.call_sid}.json`, {
              method: 'POST',
              body: new URLSearchParams({ Status: 'completed' }),
            });
          } catch {}
        }
      }

      return Response.json({ ok: true });
    }

    // ── START RECORDING: record a live call via Twilio API ──
    if (action === 'startRecording') {
      const { callSid } = body;
      if (!callSid) return Response.json({ error: 'callSid required' }, { status: 400 });

      const callbackUrl = `https://rosieai-investorpage.base44.app/functions/fronterCall`;
      await twilioFetch(`/Calls/${callSid}/Recordings.json`, {
        method: 'POST',
        body: new URLSearchParams({
          RecordingStatusCallback: callbackUrl,
          RecordingStatusCallbackMethod: 'POST',
          RecordingChannels: 'dual',
        }),
      });
      return Response.json({ ok: true });
    }

    // ── RECORDING CALLBACK: Twilio sends recording URL when ready ──
    if (body.RecordingUrl || body.recordingUrl) {
      const recordingUrl = body.RecordingUrl || body.recordingUrl;
      const callSid = body.CallSid || body.callSid;
      if (recordingUrl && callSid) {
        const base44 = createClientFromRequest(req).asServiceRole;
        const transcripts = await base44.entities.FronterCallTranscript.filter({ callSid });
        if (transcripts?.[0]) {
          await base44.entities.FronterCallTranscript.update(transcripts[0].id, { recordingUrl });
        }
      }
      return Response.json({ ok: true });
    }

    // ── GET CONFERENCE: status + participants ──
    if (action === 'getConference') {
      const { conferenceName } = body;
      const confSid = await findConferenceSid(conferenceName);
      if (!confSid) return Response.json({ ok: true, participants: [] });
      const participants = await twilioFetch(`/Conferences/${confSid}/Participants.json`);
      return Response.json({
        ok: true,
        participants: (participants.participants || []).map((p: any) => ({
          callSid: p.call_sid,
          from: p.from,
          to: p.to,
          muted: p.muted,
          status: p.status,
        })),
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}