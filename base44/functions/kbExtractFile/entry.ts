/**
 * kbExtractFile — Extract Q&A pairs from an uploaded document using the
 * platform InvokeLLM integration (platform credits) instead of direct
 * Anthropic API calls. Accepts a public file_url (PDF, TXT, image).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

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

const SYSTEM = `You are building a comprehensive knowledge base from uploaded documents.
Extract EVERY useful Q&A pair from the document. Cover ALL topics: financials, projections,
team bios, legal structure, market size, product details, competitive advantages, risks,
timelines, processes, FAQs, specific numbers, percentages, dates, requirements, and anything
a salesperson or agent needs.
Rules:
- EXHAUSTIVE — extract every useful fact, not just the obvious ones
- Each entry covers ONE specific fact or topic
- Answers complete and self-contained (2-5 sentences)
- Do NOT bundle unrelated facts
- Include: every team member, every metric, every legal detail, every timeline step, every risk
- Categories: financials|product|team|market|legal|process|risk|faq|company
Return a JSON object with an "entries" array.`;

Deno.serve(async (req) => {
  try {
    const { fileName, fileType, file_url, base64, kbName } = await req.json();

    // .doc/.docx not supported by vision models — reject early
    if (fileType === 'application/msword' || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return Response.json({ error: 'Word documents (.doc/.docx) are not supported. Please convert to PDF or plain text.' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    let prompt = 'Extract ALL useful Q&A pairs from this document. Cover every fact, figure, name, date, process, and detail. Return a JSON object with an "entries" array, each entry having question, answer, and category fields.';
    const invokeArgs: any = { prompt, response_json_schema: {
      type: 'object',
      properties: {
        entries: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              answer: { type: 'string' },
              category: { type: 'string' },
            },
          },
        },
      },
    } };

    if (file_url) {
      invokeArgs.file_urls = [file_url];
    } else if (base64) {
      // Text file passed as base64 — decode and include in prompt
      const decoded = atob(base64);
      invokeArgs.prompt = `${prompt}\n\nDocument content:\n${decoded.slice(0, 50000)}`;
    } else {
      return Response.json({ error: 'Missing file_url or base64' }, { status: 400 });
    }

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM(invokeArgs);
    const rawEntries = result?.entries || [];

    // Apply keywords + metadata
    const entries = rawEntries
      .filter((e: any) => e.question && e.answer)
      .map((e: any) => ({
        ...e,
        source: fileName,
        kbName: kbName || '',
        keywords: makeKeywords(e.question || '', e.answer || '', e.category || ''),
      }));

    console.log(`[kbExtractFile] Extracted ${entries.length} Q&A entries from ${fileName}`);
    return Response.json({ entries, count: entries.length });

  } catch (e: any) {
    console.error('[kbExtractFile] Error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});