// Nightly AI cost report — one record per Eastern calendar day in AICostReport.
// Joins the app's per-call AI log rows with the exact token usage / cost rows
// written by liveAssistantAI (matched on callId), then totals cost per call,
// per agent and per AI feature. Called nightly by the workflow and on demand
// from the AI Reports tab.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { computeCostUsd, etDayRange, etDayString } from '../../shared/aiCost.ts';

// Storage guards — the report keeps the highest-cost calls and trims detail
// rather than risk an oversized record.
const MAX_CALLS = 150;
const MAX_ITEM_TYPES = 12;
const MAX_CALLS_JSON_CHARS = 350000;

function round(n: number, dp = 6) {
  const f = Math.pow(10, dp);
  return Math.round((n || 0) * f) / f;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const reportDate = (body?.date || '').match(/^\d{4}-\d{2}-\d{2}$/) ? body.date : etDayString(new Date(), -1);
    const { startISO, endISO } = etDayRange(reportDate);

    // ── Pull every AI usage row in the day (paged) ───────────────────────────
    const rows: any[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 5; page++) {
      const res: any = await base44.asServiceRole.entities.AICreditUsage.filter(
        { calledAt: { $gte: startISO, $lt: endISO } },
        { sort: '-calledAt', limit: 1000, ...(cursor ? { cursor } : {}) },
      );
      const items = res?.items || [];
      rows.push(...items);
      if (!res?.has_more || !res?.next_cursor) break;
      cursor = res.next_cursor;
    }

    // ── One row per AI call: the exact-usage row (tokens) wins over the app's
    //    estimate row logged under the same callId ──────────────────────────
    const byCallId = new Map<string, any>();
    const loose: any[] = [];
    for (const r of rows) {
      const tokens = (r.inputTokens || 0) + (r.outputTokens || 0);
      if (!r.callId) { loose.push(r); continue; }
      const seen = byCallId.get(r.callId);
      if (!seen) { byCallId.set(r.callId, r); continue; }
      const seenTokens = (seen.inputTokens || 0) + (seen.outputTokens || 0);
      if (tokens > 0 && seenTokens === 0) byCallId.set(r.callId, r);
    }

    const used = [...byCallId.values(), ...loose].map((r) => {
      const tokens = {
        inputTokens: r.inputTokens || 0,
        outputTokens: r.outputTokens || 0,
        cacheReadTokens: r.cacheReadTokens || 0,
        cacheWriteTokens: r.cacheWriteTokens || 0,
      };
      const exact = r.provider === 'anthropic' || (tokens.inputTokens + tokens.outputTokens) > 0;
      const costUsd = typeof r.costUsd === 'number' && r.costUsd > 0
        ? r.costUsd
        : exact ? computeCostUsd({ model: r.model, ...tokens }) : 0;
      return { ...r, ...tokens, exact, costUsd, credits: r.estimatedCredits || 0 };
    });

    // ── Group into calls ────────────────────────────────────────────────────
    const groups = new Map<string, any>();
    for (const r of used) {
      const key = r.transcriptId ? `t:${r.transcriptId}` : r.leadId ? `l:${r.leadId}` : `u:${r.callType || 'unknown'}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          key, leadId: r.leadId || '', leadName: r.leadName || '', leadNumber: r.leadNumber || '',
          agent: r.agentUsername || '', firstAt: r.calledAt, lastAt: r.calledAt,
          aiCalls: 0, costUsd: 0, credits: 0, inputTokens: 0, outputTokens: 0,
          cacheReadTokens: 0, cacheWriteTokens: 0, items: new Map<string, any>(),
        };
        groups.set(key, g);
      }
      g.aiCalls += 1;
      g.costUsd += r.costUsd;
      g.credits += r.credits;
      g.inputTokens += r.inputTokens;
      g.outputTokens += r.outputTokens;
      g.cacheReadTokens += r.cacheReadTokens;
      g.cacheWriteTokens += r.cacheWriteTokens;
      if (r.calledAt && r.calledAt < g.firstAt) g.firstAt = r.calledAt;
      if (r.calledAt && r.calledAt > g.lastAt) g.lastAt = r.calledAt;
      if (!g.leadName && r.leadName) { g.leadName = r.leadName; g.leadNumber = r.leadNumber || ''; g.leadId = r.leadId || ''; }
      if (!g.agent && r.agentUsername) g.agent = r.agentUsername;

      const typeKey = r.callType || 'unknown';
      const item = g.items.get(typeKey) || {
        callType: typeKey, calls: 0, costUsd: 0, credits: 0, provider: r.exact ? 'anthropic' : 'platform',
        model: r.model || '', inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
        firstAt: r.calledAt, lastAt: r.calledAt,
      };
      item.calls += 1;
      item.costUsd += r.costUsd;
      item.credits += r.credits;
      item.inputTokens += r.inputTokens;
      item.outputTokens += r.outputTokens;
      item.cacheReadTokens += r.cacheReadTokens;
      item.cacheWriteTokens += r.cacheWriteTokens;
      if (r.calledAt && r.calledAt < item.firstAt) item.firstAt = r.calledAt;
      if (r.calledAt && r.calledAt > item.lastAt) item.lastAt = r.calledAt;
      g.items.set(typeKey, item);
    }

    const allCalls = [...groups.values()].map((g) => ({
      leadId: g.leadId,
      leadName: g.leadName || 'Unattributed AI call',
      leadNumber: g.leadNumber,
      agent: g.agent || '—',
      unattributed: !g.leadId && !g.leadName,
      firstAt: g.firstAt,
      lastAt: g.lastAt,
      aiCalls: g.aiCalls,
      costUsd: round(g.costUsd),
      credits: g.credits,
      inputTokens: g.inputTokens,
      outputTokens: g.outputTokens,
      cacheReadTokens: g.cacheReadTokens,
      cacheWriteTokens: g.cacheWriteTokens,
      items: [...g.items.values()]
        .map((i) => ({ ...i, costUsd: round(i.costUsd) }))
        .sort((a, b) => b.costUsd - a.costUsd)
        .slice(0, MAX_ITEM_TYPES),
    })).sort((a, b) => b.costUsd - a.costUsd || b.aiCalls - a.aiCalls);

    // ── Totals ──────────────────────────────────────────────────────────────
    const totalCostUsd = round(used.reduce((s, r) => s + r.costUsd, 0));
    const totals = used.reduce((acc, r) => {
      const exact = r.exact;
      acc[r.callType || 'unknown'] = acc[r.callType || 'unknown'] || { callType: r.callType || 'unknown', calls: 0, costUsd: 0, credits: 0, inputTokens: 0, outputTokens: 0, exactCalls: 0 };
      const t = acc[r.callType || 'unknown'];
      t.calls += 1;
      t.costUsd += r.costUsd;
      t.credits += r.credits;
      t.inputTokens += r.inputTokens;
      t.outputTokens += r.outputTokens;
      if (exact) t.exactCalls += 1;
      return acc;
    }, {} as Record<string, any>);

    const agents = used.reduce((acc, r) => {
      const key = r.agentUsername || '— unknown —';
      acc[key] = acc[key] || { agent: key, calls: 0, costUsd: 0, credits: 0, callsWithAI: 0 };
      acc[key].calls += 1;
      acc[key].costUsd += r.costUsd;
      acc[key].credits += r.credits;
      return acc;
    }, {} as Record<string, any>);
    for (const g of allCalls) {
      const key = g.agent || '— unknown —';
      if (agents[key]) agents[key].callsWithAI += 1;
    }

    const byType = Object.values(totals)
      .map((t: any) => ({ ...t, costUsd: round(t.costUsd) }))
      .sort((a: any, b: any) => b.costUsd - a.costUsd || b.calls - a.calls);
    const byAgent = Object.values(agents)
      .map((a: any) => ({ ...a, costUsd: round(a.costUsd) }))
      .sort((a: any, b: any) => b.costUsd - a.costUsd || b.calls - a.calls);

    // ── Fit the per-call detail into one record ──────────────────────────────
    const kept: any[] = [];
    let chars = 0;
    let truncated = false;
    for (const c of allCalls) {
      const size = JSON.stringify(c).length;
      if (kept.length >= MAX_CALLS || chars + size > MAX_CALLS_JSON_CHARS) { truncated = true; break; }
      kept.push(c);
      chars += size;
    }

    const payload = {
      reportDate,
      windowStart: startISO,
      windowEnd: endISO,
      generatedAt: new Date().toISOString(),
      generatedBy: body?.source === 'workflow' ? 'nightly workflow' : (user.full_name || user.email || 'admin'),
      totalCostUsd,
      totalAICalls: used.length,
      anthropicCalls: used.filter((r) => r.exact).length,
      platformCalls: used.filter((r) => !r.exact).length,
      estimatedPlatformCredits: used.reduce((s, r) => s + r.credits, 0),
      inputTokens: used.reduce((s, r) => s + r.inputTokens, 0),
      outputTokens: used.reduce((s, r) => s + r.outputTokens, 0),
      cacheReadTokens: used.reduce((s, r) => s + r.cacheReadTokens, 0),
      cacheWriteTokens: used.reduce((s, r) => s + r.cacheWriteTokens, 0),
      callCount: allCalls.length,
      truncated,
      callsJson: JSON.stringify(kept),
      byAgentJson: JSON.stringify(byAgent),
      byTypeJson: JSON.stringify(byType),
    };

    const existingRes: any = await base44.asServiceRole.entities.AICostReport.filter({ reportDate }, '-created_date', 1);
    const existing = (existingRes?.items || existingRes || [])[0];
    const saved = existing
      ? await base44.asServiceRole.entities.AICostReport.update(existing.id, payload)
      : await base44.asServiceRole.entities.AICostReport.create(payload);

    return Response.json({
      ok: true,
      reportDate,
      id: saved?.id,
      totalCostUsd,
      totalAICalls: used.length,
      anthropicCalls: payload.anthropicCalls,
      platformCalls: payload.platformCalls,
      callCount: allCalls.length,
      truncated,
      rowsScanned: rows.length,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});