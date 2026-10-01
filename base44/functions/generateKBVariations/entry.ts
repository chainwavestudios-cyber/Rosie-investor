import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { entryId, bulk } = body || {};

    // Bulk mode: generate variations for all KB entries that don't have them yet
    if (bulk) {
      const all = await base44.entities.KnowledgeBase.list('-created_date', 500);
      const needVariations = (all || []).filter(e => !e.variations || e.variations.trim().length === 0);
      let updated = 0;
      for (const entry of needVariations) {
        try {
          const variations = await generateVariations(base44, entry);
          if (variations) {
            await base44.entities.KnowledgeBase.update(entry.id, { variations });
            updated++;
          }
        } catch {}
      }
      return Response.json({ updated, total: needVariations.length });
    }

    // Single entry mode
    if (!entryId) return Response.json({ error: 'entryId required' }, { status: 400 });
    const entry = await base44.entities.KnowledgeBase.get(entryId);
    if (!entry) return Response.json({ error: 'Entry not found' }, { status: 404 });

    const variations = await generateVariations(base44, entry);
    // Return empty string instead of 500 — the LLM may occasionally return no variations
    const result = variations || '';
    if (result) {
      await base44.entities.KnowledgeBase.update(entryId, { variations: result });
    }
    return Response.json({ variations: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function generateVariations(base44: any, entry: any): Promise<string | null> {
  const category = entry.category || 'general';
  const context = `Category: ${category}\nTitle/Question: ${entry.question}\nAnswer/Content: ${(entry.answer || '').slice(0, 500)}`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a debt settlement sales trainer. Below is a knowledge base entry. Generate 8-12 common variations and alternative phrasings that a customer or agent might use to express the SAME concept, question, or concern.

Include:
- Different ways to ask the same question (formal, casual, worried, blunt)
- Common abbreviations or slang versions
- Statements that imply the same underlying concern (e.g., "I don't want to ruin my relationship with my creditors" = "Will this upset my credit card companies?")
- Variations with different emotional tones (anxious, angry, skeptical, curious)
- Both question and statement forms

Return ONLY the variations, one per line. No numbering, no bullets, no headers — just the raw phrasings separated by newlines.

KB ENTRY:
${context}`,
    response_json_schema: {
      type: 'object',
      properties: {
        variations: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  });

  const variations = result?.variations || result?.data?.variations || [];
  if (variations.length === 0) return null;
  return variations.filter(v => v && v.trim()).join('\n');
}