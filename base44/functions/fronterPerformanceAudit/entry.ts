/**
 * fronterPerformanceAudit — AI Call Quality & Performance Auditor.
 *
 * Generates twice-daily performance audit reports for fronters:
 *   AM: 4.5 hours after clock-in
 *   PM: at shift close (clock-out)
 *
 * The 'check' action (called by the scheduled workflow every 10 min) iterates
 * all fronters with a FronterTimeEntry for today and generates reports as
 * needed. The 'generate' action generates a single report on demand.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { automationGate } from '../../shared/automationRules.ts';

const AUDIT_PROMPT = `You are an expert Sales Quality Assurance & Operations Auditor for Debt Solutions Corporation. Your task is to evaluate the call transcripts and metrics of each active "Fronter" twice a day. You will analyze adherence to the streamlined pitch, objection handling, conversion performance, and operational efficiency, generating an actionable, data-driven performance report.

EVALUATION FRAMEWORK & SCORING SYSTEM (0-100 Points Total)

Calculate a composite Agent Performance Score (APS) for the shift based on four core pillars:

1. Script Adherence & Pitch Fidelity (30 Points)
- Did the Fronter deliver the core value proposition efficiently?
- Did they successfully verify unsecured debt and pitch lowering payments / 0% interest without dragging out the conversation?
- 30 pts: Flawless, natural delivery of the core hook and value prop.
- 15-29 pts: Minor omissions (skipped minor conversational elements but hit main qualification points).
- 0-14 pts: Went off-script entirely, missed critical debt qualification gates, or wasted time on unneeded interrogation.

2. Objection Handling & Empathy (25 Points)
- How did the agent respond when prospects hesitated, gave pushback, or had timing concerns?
- 25 pts: Maintained a warm, calm, non-pushy tone; gracefully handled objections using approved rebuttals.
- 10-24 pts: Acceptable handling, but sounded slightly rigid or defensive.
- 0-9 pts: Argued with prospects, ignored objections, or triggered premature hang-ups.

3. Transfer & Conversion Metrics (25 Points)
- What is their ratio of qualified calls to attempted transfers?
- Did they successfully capture emails/contact info and hand off to Chris Bongiorno (619-222-4232)?
- 25 pts: High transfer success rate among qualified leads; zero missed email captures.
- 15-24 pts: Moderate transfer rate; occasional missed data capture.
- 0-9 pts: Low volume of transfers, high drop-off on qualified prospects.

4. Operational Efficiency & Call Hygiene (20 Points)
- What is their average call length and speed-to-transfer? (Optimal fronting calls should be fast-moving, around 60-120 seconds).
- 20 pts: Optimal pacing, high call velocity, minimal dead air or overly long qualification rabbit holes.
- 10-19 pts: Slightly bloated call lengths or slow handling times.
- 0-9 pts: Inefficient pacing, getting bogged down in unnecessary details.

REPORT STRUCTURE & OUTPUT TEMPLATE

Generate the report in the following clean, executive-ready markdown format:

# Fronter Performance Audit: [Agent Name]
* **Shift Period**: [Shift Start Time] - [Report Timestamp]
* **Composite APS Score**: [0-100] / 100 GREEN/YELLOW/RED
* **Total Calls Audited**: [X] | **Total Transfers Initiated**: [X] | **Transfer Rate**: [X%]
* **Average Call Duration**: [X mins/secs]

Key Performance Highlights
* **Pitch Adherence**: [1-2 sentences summarizing how well they stuck to the core script]
* **Objection Handling**: [Summary of how they managed pushback during this shift]
* **Pacing & Efficiency**: [Notes on call length and speed-to-transfer]

Areas for Coaching & Improvement
1. [Specific coaching point 1]
2. [Specific coaching point 2]

Transcript Spotlight (Notable Call)
* **Call ID / Prospect**: [ID]
* **What Went Well / Poorly**: [Brief AI breakdown of a standout call or a missed opportunity]`;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// Helper: filter() returns an array (no opts) or {items} (with opts) — normalize
async function list(entity: any, query: any, opts?: any): Promise<any[]> {
  const result = await entity.filter(query, opts);
  if (Array.isArray(result)) return result;
  return result?.items || [];
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req).asServiceRole;
  const body = await req.json().catch(() => ({}));
  const action = body.action || 'check';

  try {
    if (action === 'check') {
      const gate = await automationGate(base44, 'fronter_audits');
      if (!gate.run) return Response.json({ skipped: true, automation: 'fronter_audits', reason: gate.reason });

      const today = todayET();
      const now = Date.now();
      const generated: any[] = [];

      const timeEntries = await list(base44.entities.FronterTimeEntry, { date: today });

      for (const entry of timeEntries) {
        if (!entry.clockIn) continue;
        const clockInMs = new Date(entry.clockIn).getTime();
        const hoursSinceClockIn = (now - clockInMs) / (1000 * 60 * 60);

        // AM report: 4.5 hours after clock-in
        if (hoursSinceClockIn >= 4.5) {
          const existing = await list(base44.entities.FronterPerformanceReport, {
            fronterUsername: entry.username, reportDate: today, shiftPeriod: 'AM',
          });
          if (!existing?.[0]) {
            try {
              const report = await generateReport(base44, entry.username, 'AM', today, entry.clockIn, null);
              generated.push({ username: entry.username, period: 'AM', apsScore: report.apsScore });
              console.log(`[fronterPerformanceAudit] Generated AM report for ${entry.username}: APS ${report.apsScore}`);
            } catch (e) { console.error(`AM report failed for ${entry.username}:`, e.message); }
          }
        }

        // PM report: at clock-out
        if (entry.clockOut) {
          const existing = await list(base44.entities.FronterPerformanceReport, {
            fronterUsername: entry.username, reportDate: today, shiftPeriod: 'PM',
          });
          if (!existing?.[0]) {
            try {
              const report = await generateReport(base44, entry.username, 'PM', today, entry.clockIn, entry.clockOut);
              generated.push({ username: entry.username, period: 'PM', apsScore: report.apsScore });
              console.log(`[fronterPerformanceAudit] Generated PM report for ${entry.username}: APS ${report.apsScore}`);
            } catch (e) { console.error(`PM report failed for ${entry.username}:`, e.message); }
          }
        }
      }

      return json({ ok: true, generated, checked: timeEntries.length });
    }

    if (action === 'generate') {
      const { fronterUsername, shiftPeriod } = body;
      if (!fronterUsername || !shiftPeriod) return json({ ok: false, error: 'fronterUsername and shiftPeriod required' }, 400);

      const today = todayET();
      const timeEntries = await list(base44.entities.FronterTimeEntry, { username: fronterUsername, date: today });
      const entry = timeEntries?.[0];
      if (!entry?.clockIn) return json({ ok: false, error: 'No clock-in found for today' }, 400);

      const report = await generateReport(base44, fronterUsername, shiftPeriod, today, entry.clockIn, entry.clockOut);
      return json({ ok: true, report });
    }

    return json({ ok: false, error: 'Unknown action: ' + action }, 400);
  } catch (e) {
    console.error('[fronterPerformanceAudit] Error:', e.message);
    return json({ ok: false, error: e.message }, 500);
  }
});

async function generateReport(base44: any, fronterUsername: string, shiftPeriod: string, today: string, clockInISO: string, clockOutISO: string | null) {
  const clockInDate = new Date(clockInISO);
  const endDate = clockOutISO ? new Date(clockOutISO) : new Date();

  // Load transcripts since clock-in
  const allTranscripts = await list(base44.entities.FronterCallTranscript, { fronterUsername }, { sort: '-callDate', limit: 50 });
  const shiftTranscripts = (allTranscripts || []).filter((t: any) => {
    if (!t.callDate) return false;
    const d = new Date(t.callDate);
    return d >= clockInDate && d <= endDate;
  });

  // Load leads for metrics
  const allLeads = await list(base44.entities.FronterLead, { assignedTo: fronterUsername }, { sort: '-created_date', limit: 200 });
  const shiftLeads = (allLeads || []).filter((l: any) => {
    if (!l.lastCalledAt) return false;
    const d = new Date(l.lastCalledAt);
    return d >= clockInDate && d <= endDate;
  });

  // Compute metrics from actual data
  const totalCalls = shiftTranscripts.length;
  const totalTransfers = shiftLeads.filter((l: any) => l.status === 'transferred').length;
  const transferRate = totalCalls > 0 ? Math.round((totalTransfers / totalCalls) * 100) : 0;
  const avgCallDuration = totalCalls > 0
    ? Math.round(shiftTranscripts.reduce((s: number, t: any) => s + (t.durationSeconds || 0), 0) / totalCalls)
    : 0;

  // Build transcript text for the LLM (limit to 20 calls, truncate each)
  const transcriptTexts = shiftTranscripts.slice(0, 20).map((t: any, i: number) => {
    let transcriptContent = '';
    try {
      const lines = JSON.parse(t.transcriptJson || '[]');
      transcriptContent = lines.map((l: any) => `${l.speaker === 0 ? 'Agent' : 'Customer'}: ${l.text}`).join('\n');
    } catch { transcriptContent = t.transcriptJson || ''; }
    if (transcriptContent.length > 2000) transcriptContent = transcriptContent.slice(0, 2000) + '...[truncated]';
    return `--- Call ${i + 1}: ${t.leadName || 'Unknown'} | Duration: ${t.durationSeconds || 0}s | Result: ${t.callResult || 'N/A'} ---\n${transcriptContent}`;
  }).join('\n\n');

  // Load fronter display name
  const users = await list(base44.entities.DebtCoachUser, { username: fronterUsername }, { limit: 1 });
  const fronterName = users?.[0] ? `${users[0].firstName || ''} ${users[0].lastName || ''}`.trim() || fronterUsername : fronterUsername;

  const shiftStartStr = new Date(clockInISO).toLocaleString('en-US', { timeZone: 'America/New_York' });
  const reportTimeStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const avgDurStr = `${Math.floor(avgCallDuration / 60)}m ${avgCallDuration % 60}s`;

  const prompt = `${AUDIT_PROMPT}

---

ACTUAL SHIFT DATA:

Fronter: ${fronterName} (${fronterUsername})
Shift Period: ${shiftPeriod}
Shift Start: ${shiftStartStr}
Report Generated: ${reportTimeStr}

METRICS (computed from actual call data):
- Total Calls Audited: ${totalCalls}
- Total Transfers Initiated: ${totalTransfers}
- Transfer Rate: ${transferRate}%
- Average Call Duration: ${avgDurStr}

CALL TRANSCRIPTS (${Math.min(shiftTranscripts.length, 20)} of ${totalCalls}):
${transcriptTexts || 'No transcripts available for this shift period.'}

---

Generate the performance audit report following the exact format specified above. Be specific and reference actual call data from the transcripts. If there are no transcripts, still generate a report noting the lack of call data and providing general coaching guidance.

Return as JSON with these fields:
- apsScore: integer 0-100 (composite Agent Performance Score)
- scoreTier: "green" (80+), "yellow" (50-79), "red" (below 50)
- reportMarkdown: string (the full markdown report in the template format above)
- highlights: string (the Key Performance Highlights section)
- coachingPoints: string (the Areas for Coaching & Improvement section)
- transcriptSpotlight: string (the Transcript Spotlight section)`;

  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        apsScore: { type: 'number' },
        scoreTier: { type: 'string' },
        reportMarkdown: { type: 'string' },
        highlights: { type: 'string' },
        coachingPoints: { type: 'string' },
        transcriptSpotlight: { type: 'string' },
      },
      required: ['apsScore', 'scoreTier', 'reportMarkdown'],
    },
  });

  const report: any = {
    fronterUsername,
    fronterName,
    reportDate: today,
    shiftPeriod,
    apsScore: res?.apsScore || 0,
    scoreTier: ['green', 'yellow', 'red'].includes(res?.scoreTier) ? res.scoreTier : 'yellow',
    totalCalls,
    totalTransfers,
    transferRate,
    avgCallDurationSeconds: avgCallDuration,
    shiftStartISO: clockInISO,
    shiftEndISO: clockOutISO || null,
    reportTimestamp: new Date().toISOString(),
    reportMarkdown: res?.reportMarkdown || '',
    highlights: res?.highlights || '',
    coachingPoints: res?.coachingPoints || '',
    transcriptSpotlight: res?.transcriptSpotlight || '',
    viewedByFronter: false,
  };

  // Check if report already exists (for manual regeneration)
  const existing = await list(base44.entities.FronterPerformanceReport, {
    fronterUsername, reportDate: today, shiftPeriod,
  });
  if (existing?.[0]) {
    await base44.entities.FronterPerformanceReport.update(existing[0].id, report);
    report.id = existing[0].id;
  } else {
    const created = await base44.entities.FronterPerformanceReport.create(report);
    report.id = created?.id;
  }

  return report;
}