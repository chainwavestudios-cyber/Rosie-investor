/**
 * twilioGetLines — returns configured Twilio outbound numbers
 * Frontend calls this to populate the "Call from" dropdown.
 */
Deno.serve(async () => {
  const lines = [
    { key: 'TWILIO_FROM_NUMBER',   label: 'Admin',  agent: 'admin' },
    { key: 'TWILIO_FROM_NUMBER_2', label: 'Steph',  agent: 'steph' },
    { key: 'TWILIO_FROM_NUMBER_3', label: 'Line 3', agent: 'line3' },
  ]
    .map(({ key, label, agent }) => ({ label, agent, number: Deno.env.get(key) || '' }))
    .filter(l => l.number);

  return Response.json({ lines });
});