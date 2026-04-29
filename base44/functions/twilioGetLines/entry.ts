/**
 * twilioGetLines — returns configured Twilio outbound numbers
 * Frontend calls this to populate the "Call from" dropdown.
 */
Deno.serve(async () => {
  const lines = [
    { key: 'TWILIO_FROM_NUMBER',   label: 'Line 1' },
    { key: 'TWILIO_FROM_NUMBER_2', label: 'Line 2' },
    { key: 'TWILIO_FROM_NUMBER_3', label: 'Line 3' },
  ]
    .map(({ key, label }) => ({ label, number: Deno.env.get(key) || '' }))
    .filter(l => l.number);

  return Response.json({ lines });
});