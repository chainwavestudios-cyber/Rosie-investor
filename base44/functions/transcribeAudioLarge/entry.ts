/**
 * transcribeAudioLarge — Transcribes audio files up to 50MB+ using Deepgram's batch API.
 * Used by BobKBTraining when files exceed the 25MB TranscribeAudio integration limit.
 * Takes a public audio_url (from UploadPublicFile) and returns { transcript }.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const audioUrl = body?.audio_url;
    if (!audioUrl) return Response.json({ error: 'audio_url required' }, { status: 400 });

    const dgKey = secrets.get('DEEPGRAM_API_KEY') || secrets.get('deepgram2');
    if (!dgKey) return Response.json({ error: 'Deepgram API key not configured' }, { status: 500 });

    const dgRes = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${dgKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: audioUrl }),
    });

    if (!dgRes.ok) {
      const errText = await dgRes.text();
      return Response.json({ error: `Deepgram error (${dgRes.status}): ${errText}` }, { status: 500 });
    }

    const data = await dgRes.json();
    const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    return Response.json({ transcript });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}