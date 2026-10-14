/** Read both Twilio form callbacks and authenticated JSON function requests. */
export default async function twilioVoiceParams(req) {
  const params = new URLSearchParams(new URL(req.url).search);
  if (req.method === 'POST') {
    if ((req.headers.get('content-type') || '').includes('application/json')) {
      const body = await req.json();
      for (const [key, value] of Object.entries(body)) {
        if (value != null && !params.has(key)) params.set(key, String(value));
      }
    } else {
      const body = new URLSearchParams(await req.text());
      for (const [key, value] of body) if (!params.has(key)) params.set(key, value);
    }
  }
  return params;
}