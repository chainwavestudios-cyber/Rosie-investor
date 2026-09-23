/**
 * getScriptsForBob — Fetches opener and closer scripts from an external endpoint
 * and saves them to BOB's knowledge base (debt_open_scenario / debt_close_scenario).
 * Called by a scheduled workflow every 2 hours, or manually from the BOB trainer.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

const BOB_API_KEY = 'Ajwnedfjklnadsjknfgjknasdjkfnjkasdnfjandskj';
const SCRIPTS_URL = 'https://organic-train-intel-flow.base44.app/functions/GetScriptsForBob';

export default async function(req: Request): Promise<Response> {
  try {
    const res = await fetch(`${SCRIPTS_URL}?key=${BOB_API_KEY}`, {
      headers: { 'x-bob-api-key': BOB_API_KEY },
    });
    if (!res.ok) {
      return Response.json({ error: `External fetch failed: ${res.status} ${res.statusText}` }, { status: 502 });
    }
    const data = await res.json();
    const closers = data.closers || [];
    const openers = data.openers || [];

    const base44 = createClientFromRequest(req);

    // Get existing scenario entries to avoid duplicates (match by external_id in tags)
    const existing = await base44.asServiceRole.entities.KnowledgeBase.filter({
      category: { $in: ['debt_close_scenario', 'debt_open_scenario'] },
    });
    const existingIds = new Set((existing || []).map((e: any) => {
      const m = (e.tags || '').match(/external_id:(\S+)/);
      return m ? m[1] : null;
    }).filter(Boolean));

    let savedClosers = 0;
    let savedOpeners = 0;
    let skipped = 0;

    for (const c of closers) {
      const extId = String(c.id || '');
      if (extId && existingIds.has(extId)) { skipped++; continue; }
      const title = c.title || c.file_name || `Closer Script ${c.id || ''}`;
      const parts = [];
      if (c.analysis?.script) parts.push(`SCRIPT:\n${c.analysis.script}`);
      if (c.analysis?.qa_section) parts.push(`Q&A SECTION:\n${c.analysis.qa_section}`);
      if (c.analysis?.hot_points) parts.push(`HOT POINTS:\n${c.analysis.hot_points}`);
      const answer = parts.join('\n\n') || c.file_url || '';
      await base44.asServiceRole.entities.KnowledgeBase.create({
        question: title,
        answer,
        category: 'debt_close_scenario',
        source: c.rep?.name ? `Closer: ${c.rep.name}` : 'External Script Sync',
        kbName: 'Debt Settlement',
        tags: `external_id:${extId} external_sync`,
        created_date: new Date().toISOString(),
      });
      savedClosers++;
    }

    for (const o of openers) {
      const extId = String(o.id || '');
      if (extId && existingIds.has(extId)) { skipped++; continue; }
      const title = o.title || o.file_name || `Opener Script ${o.id || ''}`;
      const parts = [];
      if (o.analysis?.script) parts.push(`SCRIPT:\n${o.analysis.script}`);
      if (o.analysis?.qa_section) parts.push(`Q&A SECTION:\n${o.analysis.qa_section}`);
      if (o.analysis?.hot_points) parts.push(`HOT POINTS:\n${o.analysis.hot_points}`);
      const answer = parts.join('\n\n') || o.file_url || '';
      await base44.asServiceRole.entities.KnowledgeBase.create({
        question: title,
        answer,
        category: 'debt_open_scenario',
        source: o.rep?.name ? `Opener: ${o.rep.name}` : 'External Script Sync',
        kbName: 'Debt Settlement',
        tags: `external_id:${extId} external_sync`,
        created_date: new Date().toISOString(),
      });
      savedOpeners++;
    }

    return Response.json({
      status: 'success',
      fetchedClosers: closers.length,
      fetchedOpeners: openers.length,
      savedClosers,
      savedOpeners,
      skipped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}