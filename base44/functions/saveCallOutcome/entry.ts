/**
 * saveCallOutcome — writes everything a finished Debt Call Coach call produced,
 * in one server-side pass.
 *
 * The dialer used to write each piece from the browser (lead update, transcript
 * report, call note, AI synopsis, key facts, intent snapshots, coach tips). Any
 * one failure was swallowed by an empty catch and every write after it was lost,
 * so calls showed up with no report, no intent score and no notes. Running the
 * same writes here as the service role makes the save independent of the browser,
 * and every step reports back so nothing can fail silently again.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const CALL_LABELS: Record<string, string> = {
  front_to_back: 'Front→Back',
  open_only: 'Open Only',
  cold_call: 'Cold Call',
  closer_call: 'Closer Call',
};

/** Fallback used only when the page could not build the full report text. */
function shortReport(intent: any): string {
  if (!intent) return '';
  const head = `🎯 INTENT REPORT — ${intent.intentScore ?? '—'}/100`;
  const who = [intent.animalType ? `${intent.animalType} personality` : '', intent.interestLevel ? `${intent.interestLevel} interest` : ''].filter(Boolean).join(' · ');
  const read = intent.report || intent.engagementReadOut || intent.interestReason || '';
  const lines = [head, who, '', read];
  if (intent.recommendedNextStep) lines.push('', `NEXT STEP: ${intent.recommendedNextStep}`);
  return lines.filter(Boolean).join('\n').trim();
}

function firstTwoSentences(text: string): string {
  const parts = String(text || '').split(/[.!?]/).map(s => s.trim()).filter(Boolean).slice(0, 2);
  return parts.length ? parts.join('. ') + '.' : '';
}

export default async function (req) {
  const steps: Record<string, string> = {};
  const note = async (name: string, fn: () => Promise<string>) => {
    try {
      steps[name] = await fn();
    } catch (e) {
      steps[name] = 'error: ' + String((e && (e as Error).message) || e).slice(0, 220);
    }
  };

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const leadId: string = body?.leadId || '';
    if (!leadId) return Response.json({ error: 'leadId is required' }, { status: 400 });

    const transcript = Array.isArray(body?.transcript) ? body.transcript : [];
    const intent = body?.intent || null;
    const intentReport: string = body?.intentReport || shortReport(intent);
    const followUpReport: string = body?.followUpReport || '';
    const callAnalysisJson: string = body?.callAnalysisJson || '';
    const agentId: string = body?.agentId || '';
    const durationSeconds: number = Number(body?.durationSeconds) || 0;
    const callMode: string = body?.callMode || '';
    const callType: string = body?.callType || '';
    const direction: string = body?.direction || '';
    const coachTips = Array.isArray(body?.coachTips) ? body.coachTips : [];
    const qaItems = Array.isArray(body?.qaItems) ? body.qaItems : [];
    const intentHistory = Array.isArray(body?.intentHistory) ? body.intentHistory : [];
    const transcriptRecordId: string = body?.transcriptRecordId || '';

    const db = base44.asServiceRole.entities;
    const nowISO = new Date().toISOString();
    const lead = await db.DebtLead.get(leadId).catch(() => null);
    const leadName = lead ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() : '';
    const leadNumber = (lead && lead.leadNumber) || '';
    const transcriptJson = JSON.stringify(transcript);
    const lineCount = transcript.length;
    const score = intent && typeof intent.intentScore === 'number' && !Number.isNaN(intent.intentScore) ? intent.intentScore : null;
    const animal = (intent && intent.animalType) || null;
    // Both directions are logged: every incoming and every outgoing call
    const callPrefix = direction === 'inbound' ? 'Incoming call — ' : direction === 'outbound' ? 'Outgoing call — ' : '';

    // 1 ── the lead: last call, intent score, brief the next call
    await note('lead', async () => {
      const patch: Record<string, unknown> = {
        lastCallAt: nowISO,
        callCount: ((lead && lead.callCount) || 0) + 1,
        transcriptJson,
        intentScore: score,
        animalType: animal,
      };
      if (intentReport) {
        patch.nextCallBriefing = intentReport;
        patch.nextCallBriefingAt = nowISO;
      }
      await db.DebtLead.update(leadId, patch);
      return 'ok';
    });

    // 2 ── the call record: transcript + intent report + follow-up + analysis
    const transcriptId = await note('transcript', async () => {
      const data: Record<string, unknown> = {
        leadName,
        leadNumber,
        transcriptJson,
        transcriptLineCount: lineCount,
        durationSeconds,
        intentScore: score,
        animalType: animal,
      };
      if (intent) data.intentPlaybookJson = JSON.stringify(intent);
      if (intentReport) {
        data.intentReport = intentReport;
        data.reportAcknowledgedAt = null;
      }
      if (followUpReport) data.followUpReport = followUpReport;
      if (callAnalysisJson) data.callAnalysisJson = callAnalysisJson;
      if (transcriptRecordId) {
        await db.DebtCallTranscript.update(transcriptRecordId, data);
        return transcriptRecordId;
      }
      const created = await db.DebtCallTranscript.create({
        leadId,
        agentId,
        agentName: agentId,
        callMode,
        callType,
        callDate: nowISO,
        ...data,
      });
      return created?.id || 'created';
    });

    // 3 ── the notes: the call itself, plus the AI synopsis of the call
    await note('activity', async () => {
      const label = CALL_LABELS[callType] || 'Call';
      const durationMin = Math.round(durationSeconds / 60);
      const rows: Array<Record<string, unknown>> = [{
        leadId,
        leadName,
        activityType: 'call',
        activityText: `📞 ${callPrefix}${label} (${callMode === 'close' ? 'close' : 'open'}) — ${durationMin} min, ${lineCount} lines${score != null ? `, intent ${score}/100` : ''}`,
        createdBy: agentId,
        metadataJson: JSON.stringify({ durationMin, mode: callMode, callType, intentScore: score, animalType: animal }),
      }];
      const synopsisSource = (intent && (intent.report || intent.engagementReadOut || intent.interestReason)) || '';
      const synopsis = firstTwoSentences(synopsisSource);
      if (synopsis) {
        rows.push({ leadId, leadName, activityType: 'ai_synopsis', activityText: synopsis, createdBy: agentId });
      }
      await db.DebtLeadActivity.bulkCreate(rows);
      return 'ok';
    });

    // 4 ── what the client said, kept for the next call
    await note('facts', async () => {
      const facts = (intent && Array.isArray(intent.keyFacts) ? intent.keyFacts : []).filter((f: any) => f && f.fact);
      if (!facts.length) return 'none';
      const existingPage = await db.LeadMemory.filter({ leadId }, { limit: 200 });
      const existing = (existingPage?.items || []).map((m: any) => String(m.factText || '').toLowerCase());
      const rows = facts
        .filter((f: any) => !existing.includes(String(f.fact).toLowerCase()))
        .map((f: any) => ({
          leadId,
          leadName,
          factType: f.type || 'personal',
          factText: f.fact,
          context: f.context || '',
          importance: f.importance || 'medium',
          callDate: nowISO,
          followUpDate: f.followUpDate || null,
        }));
      if (rows.length) await db.LeadMemory.bulkCreate(rows);
      return `${rows.length} saved`;
    });

    // 5 ── the intent trail, coach tips and agent Q&A for this call
    await note('snapshots', async () => {
      const rows = intentHistory
        .filter((s: any) => s && typeof s.score === 'number')
        .map((s: any) => ({
          agentId,
          agentName: agentId,
          transcriptId,
          leadId,
          leadName,
          intentScore: s.score,
          animalType: s.animalType || null,
          report: s.report || '',
          snapshotTime: s.time || nowISO,
        }));
      if (!rows.length) return 'none';
      await db.DebtIntentSnapshot.bulkCreate(rows);
      return `${rows.length} saved`;
    });

    await note('tips', async () => {
      const rows = coachTips
        .filter((t: any) => t && t.tip)
        .map((t: any) => ({
          agentId,
          agentName: agentId,
          transcriptId,
          leadId,
          leadName,
          tip: t.tip,
          tipTime: t.time || nowISO,
        }));
      if (!rows.length) return 'none';
      await db.DebtCoachTip.bulkCreate(rows);
      return `${rows.length} saved`;
    });

    await note('qa', async () => {
      const rows = qaItems
        .filter((q: any) => q && q.question && q.answer)
        .map((q: any) => ({
          leadId,
          leadName,
          agentId,
          transcriptId,
          question: q.question,
          answer: q.answer,
          askedAt: q.askedAt || nowISO,
          source: 'auto',
        }));
      if (!rows.length) return 'none';
      await db.DebtQAHistory.bulkCreate(rows);
      return `${rows.length} saved`;
    });

    console.log('saveCallOutcome', leadId, JSON.stringify(steps));
    return Response.json({ ok: true, transcriptId, steps });
  } catch (error) {
    console.log('saveCallOutcome failed', String((error && (error as Error).message) || error), JSON.stringify(steps));
    return Response.json({ error: String((error && (error as Error).message) || error), steps }, { status: 500 });
  }
}