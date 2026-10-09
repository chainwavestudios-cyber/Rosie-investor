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
const ACCOUNT_SID   = Deno.env.get('TWILIO_ACCOUNT_SID')  || '';
const AUTH_TOKEN    = Deno.env.get('TWILIO_AUTH_TOKEN')   || '';
const twilioBase    = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}`;
const twilioAuth    = 'Basic ' + btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);

function lineNumber(lineKey: string): string {
  return Deno.env.get(lineKey) || Deno.env.get('TWILIO_FROM_NUMBER') || '';
}

async function twilioFetch(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(`${twilioBase}${path}`, {
    ...opts,
    headers: {
      Authorization: twilioAuth,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(opts.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Twilio error ${res.status}`);
  return data;
}

function confTwiML(name: string, muted = false): string {
  return `<Response><Dial><Conference name="${name}" muted="${muted}" beep="false" startConferenceOnEnter="true" endConferenceOnExit="false">${name}</Conference></Dial></Response>`;
}

async function findConferenceSid(name: string): Promise<string | null> {
  const data = await twilioFetch(`/Conferences.json?FriendlyName=${encodeURIComponent(name)}&Status=in-progress`);
  return data.conferences?.[0]?.sid || null;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { action } = body;

    // ── MERGE: convert 1:1 call → conference, dial agent in ──
    if (action === 'merge') {
      const { fronterCallSid, agentPhone, lineKey, conferenceName } = body;
      if (!fronterCallSid && !conferenceName) return Response.json({ error: 'fronterCallSid or conferenceName required' }, { status: 400 });
      if (!agentPhone) return Response.json({ error: 'agentPhone required' }, { status: 400 });

      const fromNumber = lineNumber(lineKey);
      // Reuse an existing conference (e.g. created by hold) or create a new one
      const confName = conferenceName || `fronter_conf_${fronterCallSid}`;
      const existingConf = await findConferenceSid(confName);

      if (!existingConf) {
        // Find the customer's child call (the other leg of the fronter's call)
        const childCalls = await twilioFetch(`/Calls.json?ParentCallSid=${fronterCallSid}`);
        const customerCallSid = childCalls.calls?.[0]?.sid;

        // Redirect fronter's leg into the conference
        await twilioFetch(`/Calls/${fronterCallSid}.json`, {
          method: 'POST',
          body: new URLSearchParams({ Twiml: confTwiML(confName) }),
        });

        // Redirect customer's leg into the conference (if found)
        if (customerCallSid) {
          try {
            await twilioFetch(`/Calls/${customerCallSid}.json`, {
              method: 'POST',
              body: new URLSearchParams({ Twiml: confTwiML(confName) }),
            });
          } catch {}
        }
      }

      // Dial the agent into the conference
      await twilioFetch(`/Calls.json`, {
        method: 'POST',
        body: new URLSearchParams({
          To: agentPhone,
          From: fromNumber,
          Twiml: confTwiML(confName),
        }),
      });

      return Response.json({ ok: true, conferenceName: confName });
    }

    // ── HOLD: convert 1:1 call → conference, hold the customer ──
    if (action === 'hold') {
      const { fronterCallSid, lineKey } = body;
      if (!fronterCallSid) return Response.json({ error: 'fronterCallSid required' }, { status: 400 });

      const confName = `fronter_conf_${fronterCallSid}`;
      const existingConf = await findConferenceSid(confName);

      if (!existingConf) {
        // First hold — convert 1:1 call to conference
        const childCalls = await twilioFetch(`/Calls.json?ParentCallSid=${fronterCallSid}`);
        const customerCallSid = childCalls.calls?.[0]?.sid;

        await twilioFetch(`/Calls/${fronterCallSid}.json`, {
          method: 'POST',
          body: new URLSearchParams({ Twiml: confTwiML(confName) }),
        });
        if (customerCallSid) {
          try {
            await twilioFetch(`/Calls/${customerCallSid}.json`, {
              method: 'POST',
              body: new URLSearchParams({ Twiml: confTwiML(confName) }),
            });
          } catch {}
        }
      }

      // Wait for conference to exist, then hold the customer's participant
      let confSid: string | null = null;
      for (let i = 0; i < 10; i++) {
        confSid = await findConferenceSid(confName);
        if (confSid) break;
        await new Promise(r => setTimeout(r, 500));
      }
      if (!confSid) return Response.json({ error: 'Conference not found' }, { status: 404 });

      const participants = await twilioFetch(`/Conferences/${confSid}/Participants.json`);
      // Hold all non-client participants (the customer, not the fronter browser leg)
      for (const p of participants.participants || []) {
        if (!p.to?.startsWith('client:')) {
          await twilioFetch(`/Conferences/${confSid}/Participants/${p.callSid}.json`, {
            method: 'POST',
            body: new URLSearchParams({ Hold: 'true' }),
          });
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
          await twilioFetch(`/Conferences/${confSid}/Participants/${p.callSid}.json`, {
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
      const transferTwiML = `<Response><Dial callerId="${fromNumber}"><Number>${transferTo}</Number></Dial></Response>`;

      if (conferenceName) {
        const confSid = await findConferenceSid(conferenceName);
        if (confSid) {
          const participants = await twilioFetch(`/Conferences/${confSid}/Participants.json`);
          const customerPart = (participants.participants || []).find((p: any) => !p.to?.startsWith('client:'));
          if (customerPart) {
            await twilioFetch(`/Calls/${customerPart.callSid}.json`, {
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

    // ── GET CONFERENCE: status + participants ──
    if (action === 'getConference') {
      const { conferenceName } = body;
      const confSid = await findConferenceSid(conferenceName);
      if (!confSid) return Response.json({ ok: true, participants: [] });
      const participants = await twilioFetch(`/Conferences/${confSid}/Participants.json`);
      return Response.json({
        ok: true,
        participants: (participants.participants || []).map((p: any) => ({
          callSid: p.callSid,
          from: p.from,
          to: p.to,
          muted: p.muted,
          status: p.status,
        })),
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});