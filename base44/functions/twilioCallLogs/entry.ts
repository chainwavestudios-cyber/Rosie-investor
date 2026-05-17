const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN');
const twilioBase = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`;
const twilioAuth = 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

Deno.serve(async (req) => {
  try {
    const { startDate, endDate, direction } = await req.json();
    // startDate / endDate = 'YYYY-MM-DD'

    const params = new URLSearchParams({ PageSize: '500' });
    if (startDate) params.set('StartTime>', startDate + 'T00:00:00Z');
    if (endDate)   params.set('StartTime<', endDate   + 'T23:59:59Z');
    if (direction) params.set('Direction', direction); // 'outbound-api' | 'inbound'

    const res = await fetch(`${twilioBase}/Calls.json?${params.toString()}`, {
      headers: { Authorization: twilioAuth },
    });
    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: res.status });
    }
    const data = await res.json();

    const calls = (data.calls || []).map(c => ({
      sid:        c.sid,
      from:       c.from,
      to:         c.to,
      status:     c.status,          // queued, initiated, ringing, in-progress, completed, busy, no-answer, canceled, failed
      direction:  c.direction,       // inbound, outbound-api, outbound-dial
      duration:   parseInt(c.duration || '0', 10),
      startTime:  c.start_time,
      endTime:    c.end_time,
      answeredBy: c.answered_by,
    }));

    return Response.json({ calls, total: calls.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});