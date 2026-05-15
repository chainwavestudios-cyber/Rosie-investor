/**
 * kbExtractFile — Smart KB population
 * Do the heavy lifting once at upload → pre-written answers at query time
 *
 * Pass 1: Exhaustive Q&A (100-150 entries for 60-page doc)
 * Pass 2: Atomic facts — numbers, names, dates, table rows, fine print
 * Pass 3: Raw text chunks stored for full-text search fallback
 * All entries get keyword tags for fast zero-AI lookup
 */
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

async function callClaude(userContent: any, system: string, maxTokens = 8000): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Claude error');
  return data?.content?.[0]?.text || '';
}

function parseJSON(text: string): any[] {
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); }
  catch {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return [];
  }
}

function makeKeywords(question: string, answer: string, category: string): string {
  const stop = new Set(['the','and','for','that','this','with','from','are','was','were','have','been','will','would','could','should','what','when','where','how','why','who','can','does','did','its','our','their','your','they','them','these','those','than','then','also','some','any','all','each','both','into','about','which','its']);
  const text  = `${question} ${answer}`.toLowerCase();
  const words = text.match(/\b[a-z]{3,}\b/g) || [];
  const freq: Record<string,number> = {};
  for (const w of words) { if (!stop.has(w)) freq[w] = (freq[w]||0)+1; }
  const nums = text.match(/\$[\d,.]+[mkb]?|\d+\.?\d*%|\d{4,}/g) || [];
  const kws = [
    ...Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([w])=>w),
    ...nums.slice(0,6), category,
  ].filter(Boolean);
  return [...new Set(kws)].join(',');
}

const SYS1 = `You are building a comprehensive investor sales knowledge base.
Extract EVERY useful piece of information. Cover ALL: financials, projections, team bios,
legal structure, market size, product details, competitive advantages, risks, timelines,
processes, FAQs, specific numbers, percentages, dates, requirements, and anything a salesperson needs.
Rules:
- EXHAUSTIVE — a 60-page doc should produce 100-150+ entries
- Each entry covers ONE specific fact or topic
- Answers complete and self-contained (2-5 sentences)
- Do NOT bundle unrelated facts
- Include: every team member, every metric, every legal detail, every timeline step, every risk
Categories: financials|product|team|market|legal|process|risk|faq|company
Return ONLY valid JSON array, no markdown: [{"question":"...","answer":"...","category":"..."}]`;

const SYS2 = `You are extracting ATOMIC FACTS — things a thorough Pass 1 may have bundled or missed.
Focus ONLY on:
- Every specific dollar amount, percentage, multiple, ratio
- Every person's name, title, background
- Every date, deadline, milestone
- Every legal term, structure, requirement
- Every risk factor and mitigation stated
- Every competitor comparison
- Every table row as its own entry
- Numbers buried in paragraphs
- Fine print and footnotes
One fact = one entry. Answers SHORT and PRECISE (1-3 sentences).
Return ONLY valid JSON array: [{"question":"...","answer":"...","category":"financials|product|team|market|legal|process|risk|faq|company"}]`;

Deno.serve(async (req) => {
  try {
    const { fileName, fileType, base64, kbName } = await req.json();
    if (!base64) return Response.json({ error: 'Missing file data' }, { status: 400 });

    let qaEntries:    any[] = [];
    let chunkEntries: any[] = [];

    if (fileType === 'application/pdf') {
      const doc = [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }];

      // Pass 1 — exhaustive Q&A
      console.log('[kbExtractFile] Pass 1 — exhaustive Q&A...');
      const p1text = await callClaude(
        [...doc, { type: 'text', text: 'Extract ALL useful Q&A pairs from this entire document. Cover every fact, figure, name, date, process, and detail. JSON array only:' }],
        SYS1, 8000
      );
      const pass1 = parseJSON(p1text);
      console.log(`[kbExtractFile] Pass 1: ${pass1.length} entries`);

      // Pass 2 — atomic facts
      console.log('[kbExtractFile] Pass 2 — atomic facts...');
      const p2text = await callClaude(
        [...doc, { type: 'text', text: 'Focus on specific numbers, names, dates, legal terms, table data, risks, fine print. Extract each as its own entry. JSON array only:' }],
        SYS2, 8000
      );
      const pass2raw  = parseJSON(p2text);
      const existingQs = new Set(pass1.map((e: any) => e.question?.toLowerCase().trim().slice(0,60)));
      const pass2      = pass2raw.filter((e: any) => {
        const key = e.question?.toLowerCase().trim().slice(0,60);
        return key && !existingQs.has(key);
      });
      console.log(`[kbExtractFile] Pass 2: ${pass2.length} new entries`);
      qaEntries = [...pass1, ...pass2];

      // Pass 3 — extract raw text then chunk it
      console.log('[kbExtractFile] Pass 3 — raw text chunks...');
      const rawText = await callClaude(
        [...doc, { type: 'text', text: 'Extract the complete raw text of this document preserving all content. Text only, no commentary:' }],
        'You are a precise document text extractor. Output complete raw text, no summarization.',
        8000
      );
      const words = rawText.split(/\s+/).filter(Boolean);
      const CW = 600, OW = 100;
      for (let i = 0, idx = 0; i < words.length; i += CW - OW, idx++) {
        const chunk = words.slice(i, i + CW).join(' ');
        if (chunk.trim().length < 80) continue;
        chunkEntries.push({
          question: `[CHUNK ${idx+1}] ${fileName}`,
          answer:   chunk,
          category: 'raw_chunk',
          source:   fileName,
          keywords: chunk.toLowerCase().match(/\b[a-z]{4,}\b/g)?.slice(0,20).join(',') || '',
          kbName:   kbName || '',
        });
      }
      console.log(`[kbExtractFile] ${chunkEntries.length} chunks`);

    } else {
      // Text file
      const decoded = atob(base64);
      const CC = 4000, OC = 400;
      for (let i = 0, idx = 0; i < decoded.length; i += CC - OC, idx++) {
        const chunk = decoded.slice(i, i + CC);
        if (chunk.trim().length < 50) continue;
        const txt = await callClaude(
          `Extract ALL useful Q&A pairs from this section. JSON only:\n[{"question":"...","answer":"...","category":"..."}]\n\nSection:\n${chunk}\n\nJSON:`,
          'Extract sales KB Q&A. Return only valid JSON array.', 3000
        );
        qaEntries.push(...parseJSON(txt));
        chunkEntries.push({
          question: `[CHUNK ${idx+1}] ${fileName}`,
          answer: chunk, category: 'raw_chunk', source: fileName, kbName: kbName || '',
          keywords: chunk.toLowerCase().match(/\b[a-z]{4,}\b/g)?.slice(0,20).join(',') || '',
        });
      }
    }

    // Apply keywords + metadata to all Q&A entries
    const finalQA = qaEntries.map((e: any) => ({
      ...e,
      source:   fileName,
      kbName:   kbName || '',
      keywords: makeKeywords(e.question||'', e.answer||'', e.category||''),
    }));

    const all = [...finalQA, ...chunkEntries];
    console.log(`[kbExtractFile] Total: ${finalQA.length} Q&A + ${chunkEntries.length} chunks = ${all.length}`);
    return Response.json({ entries: all, count: all.length, qaCount: finalQA.length, chunkCount: chunkEntries.length });

  } catch (e: any) {
    console.error('[kbExtractFile] Error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});