import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { reportType, dialerUsername, startDate, endDate } = body;

    // Verify the caller is an admin or manager
    const requesterUsers = await base44.asServiceRole.entities.DebtCoachUser.filter({ username: body.managerUsername || '' });
    const requester = requesterUsers?.[0];
    if (!requester || !requester.isActive) {
      return Response.json({ error: 'Requester not found' }, { status: 403 });
    }
    if (requester.role !== 'admin' && requester.role !== 'super_admin' && requester.role !== 'manager') {
      return Response.json({ error: 'Only admins and managers can generate reports' }, { status: 403 });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();

    // Fetch all transcripts for this dialer in the date range
    const allTranscripts = await base44.asServiceRole.entities.DebtCallTranscript.filter({ agentId: dialerUsername });
    const transcripts = (allTranscripts || []).filter(t => {
      const d = new Date(t.callDate);
      return d >= start && d <= end;
    });

    // Fetch Q&A history
    const allQA = await base44.asServiceRole.entities.DebtQAHistory.filter({ agentId: dialerUsername });
    const qaHistory = (allQA || []).filter(q => {
      const d = new Date(q.askedAt);
      return d >= start && d <= end;
    });

    // Fetch coaching tips
    const allTips = await base44.asServiceRole.entities.DebtCoachTip.filter({ agentId: dialerUsername });
    const tips = (allTips || []).filter(t => {
      const d = new Date(t.tipTime);
      return d >= start && d <= end;
    });

    // Fetch intent snapshots
    const allSnapshots = await base44.asServiceRole.entities.DebtIntentSnapshot.filter({ agentId: dialerUsername });
    const snapshots = (allSnapshots || []).filter(s => {
      const d = new Date(s.snapshotTime);
      return d >= start && d <= end;
    });

    // Fetch login sessions for time tracking
    const sessions = await base44.asServiceRole.entities.DialerSession.filter({ username: dialerUsername });
    const sessionRecords = (sessions || []).filter(s => {
      const d = new Date(s.loginAt);
      return d >= start && d <= end;
    });

    switch (reportType) {
      case 'callMeasurement': {
        const totalCalls = transcripts.length;
        const totalCallSeconds = transcripts.reduce((s, t) => s + (t.durationSeconds || 0), 0);
        const avgCallSeconds = totalCalls > 0 ? Math.round(totalCallSeconds / totalCalls) : 0;
        const totalLoginSeconds = sessionRecords.reduce((s, sess) => {
          const login = new Date(sess.loginAt).getTime();
          const logout = sess.logoutAt ? new Date(sess.logoutAt).getTime() : Date.now();
          return s + Math.round((logout - login) / 1000);
        }, 0);

        // Per-day breakdown
        const dayMap = {};
        for (const t of transcripts) {
          const dayKey = new Date(t.callDate).toISOString().split('T')[0];
          if (!dayMap[dayKey]) dayMap[dayKey] = { date: dayKey, calls: 0, totalSeconds: 0 };
          dayMap[dayKey].calls++;
          dayMap[dayKey].totalSeconds += (t.durationSeconds || 0);
        }
        const dailyBreakdown = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

        return Response.json({
          ok: true,
          report: {
            dialer: dialerUsername,
            dateRange: { start: start.toISOString(), end: end.toISOString() },
            totalCalls,
            totalCallTime: totalCallSeconds,
            totalCallTimeFormatted: formatDuration(totalCallSeconds),
            avgCallTime: avgCallSeconds,
            avgCallTimeFormatted: formatDuration(avgCallSeconds),
            totalLoginTime: totalLoginSeconds,
            totalLoginTimeFormatted: formatDuration(totalLoginSeconds),
            dailyBreakdown: dailyBreakdown.map(d => ({ ...d, timeFormatted: formatDuration(d.totalSeconds) })),
          },
        });
      }

      case 'intentReport': {
        // Build cumulative intent analysis
        const intentScores = snapshots.map(s => s.intentScore).filter(n => n != null);
        const avgIntent = intentScores.length > 0 ? Math.round(intentScores.reduce((a, b) => a + b, 0) / intentScores.length) : 0;
        const animalCounts = {};
        for (const s of snapshots) {
          if (s.animalType) animalCounts[s.animalType] = (animalCounts[s.animalType] || 0) + 1;
        }

        // Get previous period for comparison
        const periodLength = end.getTime() - start.getTime();
        const prevStart = new Date(start.getTime() - periodLength);
        const prevEnd = new Date(start.getTime() - 1);
        const prevSnapshots = (allSnapshots || []).filter(s => {
          const d = new Date(s.snapshotTime);
          return d >= prevStart && d <= prevEnd;
        });
        const prevIntentScores = prevSnapshots.map(s => s.intentScore).filter(n => n != null);
        const prevAvgIntent = prevIntentScores.length > 0 ? Math.round(prevIntentScores.reduce((a, b) => a + b, 0) / prevIntentScores.length) : 0;

        // Use AI to generate the cumulative report
        const reportText = snapshots.map(s => `Score: ${s.intentScore}, Animal: ${s.animalType || 'unknown'}\n${s.report || ''}`).join('\n---\n');
        const tipsText = tips.map(t => t.tip).join('\n---\n');

        const aiResult = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a sales performance analyst. Generate a cumulative intent and dialer report for "${dialerUsername}".

PERIOD: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}
PREVIOUS PERIOD: ${prevStart.toLocaleDateString()} to ${prevEnd.toLocaleDateString()}

CURRENT PERIOD STATS:
- Total calls: ${transcripts.length}
- Average intent score: ${avgIntent}/100 (previous: ${prevAvgIntent}/100)
- Intent trend: ${avgIntent > prevAvgIntent ? 'IMPROVING' : avgIntent < prevAvgIntent ? 'DECLINING' : 'STABLE'} (${avgIntent - prevAvgIntent > 0 ? '+' : ''}${avgIntent - prevAvgIntent} points)
- Animal distribution: ${JSON.stringify(animalCounts)}
- Total coaching tips: ${tips.length}

INTENT SNAPSHOTS:
${reportText || 'No intent snapshots for this period.'}

COACHING TIPS GIVEN:
${tipsText || 'No coaching tips for this period.'}

Generate a detailed report with these sections:
1. EXECUTIVE SUMMARY — Overall performance assessment
2. STRENGTHS — What the dialer does well (based on intent trends and coaching)
3. WEAKNESSES — Areas needing improvement
4. IMPROVEMENT ANALYSIS — Comparison vs previous period (improving or declining, with specifics)
5. RECOMMENDED ACTIONS — Specific, actionable steps for improvement

Be specific and data-driven. Reference actual scores and trends.`,
        });

        return Response.json({
          ok: true,
          report: {
            dialer: dialerUsername,
            dateRange: { start: start.toISOString(), end: end.toISOString() },
            avgIntent,
            prevAvgIntent,
            trend: avgIntent > prevAvgIntent ? 'IMPROVING' : avgIntent < prevAvgIntent ? 'DECLINING' : 'STABLE',
            totalCalls: transcripts.length,
            totalSnapshots: snapshots.length,
            animalCounts,
            aiReport: aiResult || 'No analysis generated.',
          },
        });
      }

      case 'qaReport': {
        // Compare Q&A given to the dialer vs what they actually said in calls
        const qaText = qaHistory.map(q => `Q: ${q.question}\nA (given): ${q.answer || '(no answer)'}\nSource: ${q.source}`).join('\n---\n');

        // Get transcript excerpts where the Q&A topics came up
        const transcriptExcerpts = transcripts.map(t => {
          try {
            const lines = JSON.parse(t.transcriptJson || '[]');
            const agentLines = lines.filter(l => l.speaker === 0).map(l => l.text).join(' ');
            return `Call ${t.callDate ? new Date(t.callDate).toLocaleDateString() : ''} (${t.leadName || 'Unknown'}):\n${agentLines.substring(0, 2000)}`;
          } catch { return ''; }
        }).filter(t => t).join('\n===\n');

        const aiResult = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a sales QA analyst. Compare the Q&A answers that were GIVEN to dialer "${dialerUsername}" versus what they ACTUALLY SAID in calls.

Q&A HISTORY (answers provided to the dialer):
${qaText || 'No Q&A history for this period.'}

ACTUAL CALL TRANSCRIPTS (agent speech only):
${transcriptExcerpts || 'No transcripts for this period.'}

Generate a detailed Q&A compliance report:
1. ADHERENCE — How closely the dialer's actual language matched the provided answers (high/medium/low adherence)
2. DEVIATIONS — Specific instances where the dialer said something different from the provided answer, and whether the deviation was positive or negative
3. MISSING ANSWERS — Questions that came up in calls but the dialer didn't use the provided answer
4. IMPROVEMENTS — Where the dialer added value beyond the provided answers
5. RECOMMENDATIONS — Specific suggestions for improving Q&A usage

Be specific — quote actual phrases from the transcripts where possible.`,
        });

        return Response.json({
          ok: true,
          report: {
            dialer: dialerUsername,
            dateRange: { start: start.toISOString(), end: end.toISOString() },
            totalQA: qaHistory.length,
            totalCalls: transcripts.length,
            aiReport: aiResult || 'No analysis generated.',
          },
        });
      }

      default:
        return Response.json({ error: 'Unknown report type' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}