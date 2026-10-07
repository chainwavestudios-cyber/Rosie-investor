/**
 * smartLeadsChat — AI director for the lead generation engine.
 *
 * This function is the "brain" behind the Smart Leads tab. It:
 * 1. Reads the current SmartLeadConfig (keywords, subreddits, distress phrases, etc.)
 * 2. Processes user chat messages to understand what the user wants
 * 3. Modifies the config (add/remove keywords, adjust settings, add new sources)
 * 4. Learns from rejection feedback — analyzes why leads were rejected and adjusts
 * 5. Returns updated config + explanation of what it changed and why
 *
 * The AI can:
 * - Add/remove subreddits, search queries, Quora topics, Stack Exchange feeds
 * - Add/remove distress phrases in Categories A/B/C
 * - Adjust debt amount range
 * - Enable/disable platforms
 * - Adjust max post age
 * - Suggest new search strategies based on patterns in rejections
 * - Explain its reasoning for each change
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SmartLeadConfig {
  id?: string;
  subredditsJson?: string;
  searchQueriesJson?: string;
  quoraTopicsJson?: string;
  stackExchangeFeedsJson?: string;
  categoryAJson?: string;
  categoryBJson?: string;
  categoryCJson?: string;
  debtAmountMin?: number;
  debtAmountMax?: number;
  maxPostAgeDays?: number;
  platformsJson?: string;
  autoEnrich?: boolean;
  enrichmentEnabled?: boolean;
  scheduleEnabled?: boolean;
  scheduleCron?: string;
  aiLearningsJson?: string;
  lastUpdatedBy?: string;
}

function safeParseJson<T>(str: string | undefined | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'chat';

    // ── Load current config ─────────────────────────────────────────────────
    const loadConfig = async (): Promise<SmartLeadConfig> => {
      const configs = await base44.asServiceRole.entities.SmartLeadConfig.list('-created_date', 10);
      if (configs && configs.length > 0) return configs[0] as SmartLeadConfig;
      // Create default config if none exists
      const defaultConfig = {
        configName: 'default',
        subredditsJson: JSON.stringify(['Debt', 'povertyfinance', 'CreditCards', 'personalfinance']),
        searchQueriesJson: JSON.stringify(['credit card debt', 'drowning in debt', 'maxed out credit card', "can't pay minimum", 'debt settlement', 'behind on credit card']),
        quoraTopicsJson: JSON.stringify(['Debt', 'Credit-Cards', 'Personal-Debt', 'Personal-Finance-Advice']),
        stackExchangeFeedsJson: JSON.stringify(['https://money.stackexchange.com/feeds', 'https://money.stackexchange.com/feeds/tag/credit-card', 'https://money.stackexchange.com/feeds/tag/debt']),
        categoryAJson: JSON.stringify(['10k in credit card debt', '15k in credit card debt', '20k in credit card debt', '25k in credit card debt', '30k in credit card debt', '40k in credit card debt', '50k in credit card debt', '75k in credit card debt', '100k in credit card debt', '150k in credit card debt', '200k in credit card debt']),
        categoryBJson: JSON.stringify([
          { phrase: 'maxed out', require: ['10k', '20k', '30k', '50k', '100k'], mode: 'any' },
          { phrase: 'drowning in', require: ['credit card debt', 'card debt', 'minimum payments'], mode: 'any' },
          { phrase: 'so screwed', require: ['credit card', 'debt', 'cards'], mode: 'any' },
          { phrase: "can't make my minimum", require: [], mode: 'any' },
          { phrase: 'behind on credit card', require: [], mode: 'any' },
          { phrase: 'interest is killing me', require: ['credit card', 'balance'], mode: 'any' },
          { phrase: 'how to get out of', require: ['30k debt', '40k debt', '50k debt', '100k debt'], mode: 'any' },
        ]),
        categoryCJson: JSON.stringify(['paying $1000 a month in interest', 'paying $500 a month in interest', '5 cards maxed', '4 cards maxed', '3 cards maxed', 'credit card debt is ruin', 'credit card debt is destroying']),
        debtAmountMin: 10000,
        debtAmountMax: 200000,
        maxPostAgeDays: 60,
        platformsJson: JSON.stringify(['reddit', 'quora', 'stackexchange', 'x_twitter', 'facebook']),
        autoEnrich: false,
        enrichmentEnabled: false,
        scheduleEnabled: true,
        scheduleCron: '0 0,6,12,18 * * *',
        aiLearningsJson: JSON.stringify([]),
      };
      const created = await base44.asServiceRole.entities.SmartLeadConfig.create(defaultConfig);
      return created as SmartLeadConfig;
    };

    const config = await loadConfig();

    // ── Action: get_config — return current config for the UI ──────────────
    if (action === 'get_config') {
      return Response.json({ config });
    }

    // ── Action: update_config — manually update config fields ──────────────
    if (action === 'update_config') {
      const updates = body?.updates || {};
      const updated = await base44.asServiceRole.entities.SmartLeadConfig.update(config.id!, {
        ...updates,
        lastUpdatedBy: body?.username || 'manual',
      });
      return Response.json({ config: updated, status: 'ok' });
    }

    // ── Action: process_feedback — learn from a lead rejection ─────────────
    if (action === 'process_feedback') {
      const { feedbackId } = body;
      if (!feedbackId) return Response.json({ error: 'feedbackId required' }, { status: 400 });

      const feedback = await base44.asServiceRole.entities.SmartLeadFeedback.get(feedbackId);
      if (!feedback) return Response.json({ error: 'Feedback not found' }, { status: 404 });

      const leadData = safeParseJson(feedback.leadDataJson || '{}', {});
      const currentLearnings = safeParseJson(config.aiLearningsJson || '[]', [] as any[]);

      // Ask the AI to analyze the rejection and suggest config changes
      const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are the Smart Leads AI director for a debt settlement lead generation engine. A user has rejected a scraped lead and provided feedback. Your job is to analyze WHY the lead was rejected and determine what config changes (if any) should be made to avoid finding similar irrelevant leads in the future.

REJECTION FEEDBACK:
- Category: ${feedback.rejectionCategory}
- Reason: ${feedback.rejectionReason}

LEAD SNAPSHOT:
- Platform: ${leadData.platform}
- User Handle: ${leadData.userHandle}
- Post Title: ${leadData.postTitle || ''}
- Post Text: ${leadData.postText?.substring(0, 1000) || ''}
- Distress Category: ${leadData.distressCategory}
- Distress Tag: ${leadData.distressTag || ''}
- Extracted Debt Amount: ${leadData.extractedDebtAmount}
- Subreddit/Source: ${leadData.subreddit || ''}

CURRENT CONFIG SUMMARY:
- Subreddits: ${config.subredditsJson}
- Search Queries: ${config.searchQueriesJson}
- Category A phrases: ${config.categoryAJson}
- Category B rules: ${config.categoryBJson}
- Category C phrases: ${config.categoryCJson}
- Debt range: $${config.debtAmountMin} - $${config.debtAmountMax}
- Max post age: ${config.maxPostAgeDays} days
- Platforms: ${config.platformsJson}

Analyze the rejection and determine:
1. What pattern in this lead caused it to be irrelevant?
2. What specific config changes would prevent finding similar leads? (e.g., remove a subreddit, add a negative keyword, adjust debt range, remove a distress phrase that's too broad)
3. A concise learning note to remember for future scraping

Return JSON with:
- learningNote: a concise insight to remember (e.g., "Posts from r/povertyfinance about student loans are not relevant — they don't have credit card debt")
- configChanges: array of changes, each with { field, action: "add"|"remove"|"update", value, reason }
- explanation: why these changes make sense

Be conservative — only suggest changes that clearly address the rejection pattern. Don't over-react to a single rejection.`,
        response_json_schema: {
          type: 'object',
          properties: {
            learningNote: { type: 'string' },
            configChanges: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  action: { type: 'string' },
                  value: { type: 'string' },
                  reason: { type: 'string' },
                },
              },
            },
            explanation: { type: 'string' },
          },
        },
      });

      const learningNote = aiResult?.learningNote || '';
      const configChanges = aiResult?.configChanges || [];
      const explanation = aiResult?.explanation || '';

      // Apply config changes
      const updates: any = {};
      const changesApplied: any[] = [];

      for (const change of configChanges) {
        if (change.action === 'update') {
          updates[change.field] = change.value;
          changesApplied.push({ ...change, applied: true });
        } else if (change.action === 'add' || change.action === 'remove') {
          const fieldJson = change.field as keyof SmartLeadConfig;
          const currentVal = safeParseJson((config[fieldJson] as string) || '[]', [] as any[]);
          let newVal: any[];
          if (change.action === 'add') {
            if (Array.isArray(currentVal) && !currentVal.includes(change.value)) {
              newVal = [...currentVal, change.value];
            } else {
              continue;
            }
          } else {
            newVal = Array.isArray(currentVal) ? currentVal.filter((v: any) => v !== change.value && JSON.stringify(v) !== change.value) : currentVal;
          }
          updates[fieldJson] = JSON.stringify(newVal);
          changesApplied.push({ ...change, applied: true });
        }
      }

      // Add learning note to accumulated learnings
      if (learningNote) {
        currentLearnings.push({
          note: learningNote,
          from: 'rejection',
          feedbackId,
          timestamp: new Date().toISOString(),
        });
        updates.aiLearningsJson = JSON.stringify(currentLearnings.slice(-50)); // keep last 50
      }

      if (Object.keys(updates).length > 0) {
        updates.lastUpdatedBy = 'AI';
        await base44.asServiceRole.entities.SmartLeadConfig.update(config.id!, updates);
      }

      // Mark feedback as processed
      await base44.asServiceRole.entities.SmartLeadFeedback.update(feedbackId, {
        processedByAI: true,
        aiLearningNotes: learningNote,
        configChangesJson: JSON.stringify(changesApplied),
      });

      return Response.json({
        status: 'success',
        learningNote,
        configChanges: changesApplied,
        explanation,
        configUpdated: Object.keys(updates).length > 0,
      });
    }

    // ── Action: chat — main AI chatbot conversation ──────────────────────────
    if (action === 'chat') {
      const messages: ChatMessage[] = body?.messages || [];
      const username = body?.username || 'user';

      if (messages.length === 0) {
        return Response.json({ error: 'messages required' }, { status: 400 });
      }

      // Build context from current config
      const configContext = `
CURRENT SMART LEADS CONFIGURATION:
- Subreddits: ${config.subredditsJson}
- Search Queries: ${config.searchQueriesJson}
- Quora Topics: ${config.quoraTopicsJson}
- Stack Exchange Feeds: ${config.stackExchangeFeedsJson}
- Category A (Screwed/Drowning) phrases: ${config.categoryAJson}
- Category B (Emotional Panic) rules: ${config.categoryBJson}
- Category C (Multi-Card/Interest) phrases: ${config.categoryCJson}
- Debt Amount Range: $${config.debtAmountMin} - $${config.debtAmountMax}
- Max Post Age: ${config.maxPostAgeDays} days
- Enabled Platforms: ${config.platformsJson}
- Auto-Enrich: ${config.autoEnrich}
- Enrichment Enabled: ${config.enrichmentEnabled}
- Schedule Enabled: ${config.scheduleEnabled}
- Schedule: ${config.scheduleCron}

AI LEARNINGS (accumulated from rejections and chat):
${config.aiLearningsJson}

RECENT REJECTION FEEDBACK (last 10):
${await getRecentFeedback(base44, 10)}
`;

      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (!lastUserMessage) {
        return Response.json({ error: 'No user message found' }, { status: 400 });
      }

      const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are "Smart Leads" — the AI director for a debt settlement lead generation engine. Your purpose is to help the user refine the lead scraper to find BETTER, more relevant leads.

You can:
1. ADD or REMOVE subreddits, search queries, Quora topics, Stack Exchange feeds
2. ADD or REMOVE distress phrases in Categories A (screwed/drowning), B (emotional panic), C (multi-card/interest)
3. ADJUST the debt amount range (min/max)
4. ENABLE or DISABLE platforms (reddit, quora, stackexchange, x_twitter, facebook)
5. ADJUST max post age
6. SUGGEST new search strategies or keywords
7. EXPLAIN why certain leads are being found and how to improve quality

When the user asks you to make changes, you MUST return a JSON response with:
- response: your conversational response to the user (explain what you understood, what you're changing, and why)
- configChanges: array of specific changes to apply, each with:
  - field: one of "subredditsJson" | "searchQueriesJson" | "quoraTopicsJson" | "stackExchangeFeedsJson" | "categoryAJson" | "categoryBJson" | "categoryCJson" | "debtAmountMin" | "debtAmountMax" | "maxPostAgeDays" | "platformsJson" | "autoEnrich" | "enrichmentEnabled" | "scheduleEnabled" | "scheduleCron"
  - action: "add" | "remove" | "update" | "replace_all"
  - value: the value to add/remove/set (for arrays, the individual item; for scalars, the new value)
  - reason: why this change helps

For "replace_all" action, value should be a JSON array string of the complete new list.
For "add" and "remove", value is the individual item (string for arrays, number for scalars).
For "update", value is the new scalar value (as a string).

Only suggest changes that are clearly relevant to the user's request. If the user is just asking a question or exploring, return an empty configChanges array and just provide a helpful response.

If the user wants you to add new functionality (e.g., "scrape LinkedIn", "add a new platform"), explain what's possible and suggest the config changes needed.

${configContext}

USER MESSAGE: "${lastUserMessage.content}"

Respond with your analysis and any config changes needed.`,
        response_json_schema: {
          type: 'object',
          properties: {
            response: { type: 'string' },
            configChanges: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  action: { type: 'string' },
                  value: { type: 'string' },
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const aiResponse = aiResult?.response || '';
      const configChanges = aiResult?.configChanges || [];

      // Apply config changes
      const updates: any = {};
      const changesApplied: any[] = [];
      const currentLearnings = safeParseJson(config.aiLearningsJson || '[]', [] as any[]);

      for (const change of configChanges) {
        const field = change.field as keyof SmartLeadConfig;
        const validFields = ['subredditsJson', 'searchQueriesJson', 'quoraTopicsJson', 'stackExchangeFeedsJson', 'categoryAJson', 'categoryBJson', 'categoryCJson', 'debtAmountMin', 'debtAmountMax', 'maxPostAgeDays', 'platformsJson', 'autoEnrich', 'enrichmentEnabled', 'scheduleEnabled', 'scheduleCron'];
        if (!validFields.includes(field)) { changesApplied.push({ ...change, applied: false, error: 'invalid field' }); continue; }

        if (change.action === 'replace_all') {
          updates[field] = change.value;
          changesApplied.push({ ...change, applied: true });
        } else if (change.action === 'update') {
          // For numeric fields, parse the value
          if (field === 'debtAmountMin' || field === 'debtAmountMax' || field === 'maxPostAgeDays') {
            updates[field] = Number(change.value);
          } else if (field === 'autoEnrich' || field === 'enrichmentEnabled' || field === 'scheduleEnabled') {
            updates[field] = change.value === 'true' || change.value === true;
          } else {
            updates[field] = change.value;
          }
          changesApplied.push({ ...change, applied: true });
        } else if (change.action === 'add' || change.action === 'remove') {
          const currentVal = safeParseJson((config[field] as string) || '[]', [] as any[]);
          let newVal: any[];
          if (change.action === 'add') {
            if (Array.isArray(currentVal) && !currentVal.includes(change.value)) {
              newVal = [...currentVal, change.value];
            } else {
              changesApplied.push({ ...change, applied: false, error: 'already exists' });
              continue;
            }
          } else {
            newVal = Array.isArray(currentVal) ? currentVal.filter((v: any) => v !== change.value && JSON.stringify(v) !== change.value) : currentVal;
          }
          updates[field] = JSON.stringify(newVal);
          changesApplied.push({ ...change, applied: true });
        }
      }

      // Add learning note from chat
      if (configChanges.length > 0) {
        currentLearnings.push({
          note: `Chat: ${lastUserMessage.content.substring(0, 200)}`,
          from: 'chat',
          changesCount: changesApplied.filter(c => c.applied).length,
          timestamp: new Date().toISOString(),
        });
        updates.aiLearningsJson = JSON.stringify(currentLearnings.slice(-50));
      }

      if (Object.keys(updates).length > 0) {
        updates.lastUpdatedBy = `AI (${username})`;
        await base44.asServiceRole.entities.SmartLeadConfig.update(config.id!, updates);
      }

      return Response.json({
        response: aiResponse,
        configChanges: changesApplied,
        configUpdated: Object.keys(updates).length > 0,
      });
    }

    return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message, stack: (error as Error).stack }, { status: 500 });
  }
}

async function getRecentFeedback(base44: any, limit: number): Promise<string> {
  try {
    const feedback = await base44.asServiceRole.entities.SmartLeadFeedback.list('-created_date', limit);
    if (!feedback || feedback.length === 0) return 'No rejection feedback yet.';
    return feedback.map((f: any) => `- [${f.rejectionCategory}] ${f.rejectionReason?.substring(0, 200) || ''}`).join('\n');
  } catch {
    return 'Unable to load feedback.';
  }
}