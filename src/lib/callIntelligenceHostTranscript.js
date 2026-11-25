const speakerByHost = {
  bob: { bob: 'caller', user: 'agent', trainee: 'agent' },
  investor: { 0: 'agent', 1: 'caller', 2: 'transfer' },
};

// Existing hosts store finalized lines in append order. The same saved snapshot
// must always produce the same segment IDs, timing and transcript digest.
export function normalizeHostFinalTranscript(host, lines) {
  if (!Object.hasOwn(speakerByHost, host) || !Array.isArray(lines)) throw Error('invalid_host_final_transcript');
  const final = lines.filter(line => line && !line.interim && line.final !== false);
  if (!final.length || final.length > 400) throw Error('invalid_host_final_transcript');
  const times = final.map(line => typeof line.time === 'number' ? line.time : Date.parse(line.time));
  const origin = times.find(Number.isFinite) ?? 0;
  let previous = 0;
  return final.map((line, index) => {
    if (typeof line.text !== 'string' || !line.text.trim() || line.text.length > 3000) {
      throw Error('invalid_host_final_transcript');
    }
    const timestamp = Number.isFinite(times[index]) ? Math.round(times[index] - origin) : previous;
    const offset = Math.max(previous, timestamp);
    const role = host === 'bob' ? line.role : line.speaker;
    const speakers = speakerByHost[host];
    previous = offset;
    return { id: `segment-${index + 1}`, sequence: index + 1,
      speaker: Object.hasOwn(speakers, role) ? speakers[role] : 'unknown',
      start_ms: offset, end_ms: offset, text: line.text, final: true };
  });
}

export async function processFinalizedHostCall(request, { scope, callSessionId, transcriptVersion, transcript }) {
  const context = { scope, callSessionId, transcriptVersion, transcript };
  const job = await request({ ...context, action: 'complete' });
  if (job.superseded || !['queued', 'metering'].includes(job.status)) return job;
  return request({ ...context, action: 'process', jobId: job.job_id });
}

export async function hashHostFinalizedTranscript(transcript) {
  const bytes = new TextEncoder().encode(JSON.stringify(transcript));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
