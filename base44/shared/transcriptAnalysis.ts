/**
 * transcriptAnalysis.ts — Shared helpers for reading a WHOLE call transcript.
 *
 * The AI analyzers used to hard-cap the transcript at a few thousand characters
 * (`.slice(0, 8000)`), which silently dropped everything after roughly the first
 * 25 minutes of a long call. These helpers format the entire transcript and split
 * it into chunks so every chunk is analyzed and the results are merged, so a
 * 90-minute call is covered end to end instead of just its opening.
 */

export interface TranscriptLine {
  speaker?: number | null;
  role?: string;
  text?: string;
  sentiment?: string;
  time?: string;
}

/** Characters per LLM call. ~300 chars of call = 1 minute, so 14k ≈ 45 min per chunk. */
export const CHUNK_CHARS = 14000;

/** Safety ceiling so a pathological transcript can't fan out unbounded calls. */
const MAX_CHUNKS = 12;

const SPEAKER_LABEL = (t: TranscriptLine, customerSpeakerId = 1, agentSpeakerId = 0): string => {
  if (typeof t.speaker === 'number' && t.speaker !== null) {
    return t.speaker === agentSpeakerId ? 'AGENT' : t.speaker === customerSpeakerId ? 'CUSTOMER' : 'UNKNOWN';
  }
  if (t.role) {
    const r = String(t.role).toLowerCase();
    if (r === 'user' || r === 'customer' || r === 'human') return 'CUSTOMER';
    if (r === 'assistant' || r === 'agent') return 'AGENT';
  }
  return 'UNKNOWN';
};

/** Format transcript lines as "[LABEL]: text" joined by newlines. */
export function formatTranscriptLines(
  transcript: TranscriptLine[],
  opts: { customerSpeakerId?: number; agentSpeakerId?: number } = {},
): string {
  return (transcript || [])
    .map((t) => `[${SPEAKER_LABEL(t, opts.customerSpeakerId, opts.agentSpeakerId)}]: ${t.text || ''}`)
    .join('\n');
}

/** Format lines with their original transcript line numbers, for analyzers that report indices. */
export function formatNumberedLines(transcript: TranscriptLine[], start = 0): string {
  return (transcript || [])
    .map((t, i) => `[LINE ${start + i}] [${SPEAKER_LABEL(t)}]: ${t.text || ''}`)
    .join('\n');
}

const limitGroups = <T>(groups: T[]): T[] => {
  if (groups.length <= MAX_CHUNKS) return groups;
  const head = Math.ceil(MAX_CHUNKS / 2);
  const tail = MAX_CHUNKS - head;
  return [...groups.slice(0, head), ...groups.slice(groups.length - tail)];
};

/** Split transcript text into chunks on line boundaries. */
export function chunkTranscript(text: string, maxChars: number = CHUNK_CHARS): string[] {
  if (!text || !text.trim()) return [];

  const chunks: string[] = [];
  let current: string[] = [];
  let size = 0;

  for (const line of text.split('\n')) {
    if (line.length > maxChars) {
      if (current.length) { chunks.push(current.join('\n')); current = []; size = 0; }
      for (let i = 0; i < line.length; i += maxChars) chunks.push(line.slice(i, i + maxChars));
      continue;
    }
    if (size + line.length + 1 > maxChars && current.length) {
      chunks.push(current.join('\n'));
      current = [];
      size = 0;
    }
    current.push(line);
    size += line.length + 1;
  }
  if (current.length) chunks.push(current.join('\n'));

  return limitGroups(chunks);
}

/** Group transcript lines into chunks, keeping each group's original start index. */
export function groupLines(
  transcript: TranscriptLine[],
  maxChars: number = CHUNK_CHARS,
): { start: number; lines: TranscriptLine[] }[] {
  const groups: { start: number; lines: TranscriptLine[] }[] = [];
  let current: TranscriptLine[] = [];
  let size = 0;
  let start = 0;

  (transcript || []).forEach((line, index) => {
    const len = String(line?.text || '').length + 16;
    if (size + len > maxChars && current.length) {
      groups.push({ start, lines: current });
      current = [];
      size = 0;
      start = index;
    }
    current.push(line);
    size += len;
  });
  if (current.length) groups.push({ start, lines: current });

  return limitGroups(groups);
}

/**
 * Run the analyzer over every chunk in parallel batches, preserving chunk order.
 * A failed chunk resolves to null so the rest of the call is still analyzed.
 */
export async function runChunks<Item, T>(
  items: Item[],
  analyze: (item: Item, index: number) => Promise<T>,
  batchSize = 4,
): Promise<(T | null)[]> {
  const results: (T | null)[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map((item, j) => analyze(item, i + j)));
    for (const s of settled) results.push(s.status === 'fulfilled' ? s.value : null);
  }
  return results;
}