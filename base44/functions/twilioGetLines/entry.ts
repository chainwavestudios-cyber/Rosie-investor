/**
 * twilioGetLines — returns configured Twilio outbound numbers
 * Frontend calls this to populate the "Call from" dropdown.
 */
Deno.serve(async () => {
  const lines = [
    { key: 'TWILIO_FROM_NUMBER',   label: 'Line 1', agent: 'line1' },
    { key: 'TWILIO_FROM_NUMBER_2', label: 'Line 2', agent: 'line2' },
    { key: 'TWILIO_FROM_NUMBER_3', label: 'Line 3', agent: 'line3' },
    { key: 'TWILIO_FROM_NUMBER_4', label: 'Line 4', agent: 'line4' },
    { key: 'TWILIO_FROM_NUMBER_5', label: 'Line 5', agent: 'line5' },
    { key: 'TWILIO_FROM_NUMBER_6', label: 'Line 6', agent: 'line6' },
  ]
    .map(({ key, label, agent }) => ({ key, label, agent, number: Deno.env.get(key) || '' }))
    .filter(l => l.number && /^\+\d{10,}$/.test(l.number));

  return Response.json({ lines });
});