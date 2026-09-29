// Compliance Engine — evaluates live transcript chunks against KB rules,
// approved scripts, and ground-truth parameters. Creates ComplianceRecords
// and ComplianceIssues when violations are detected.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { canMonitor, isComplianceManager } from '../../shared/complianceRoles.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ─── evaluate: Run compliance evaluation on a transcript chunk ──────────
    if (action === 'evaluate') {
      const { transcriptChunk, fullTranscript, username, userRole, callMode, leadId, leadName, transcriptId, sensitivityLevel, callStartIso } = body;

      // Verify the caller has permission to monitor this user
      const monitorRole = user.role;
      if (!isComplianceManager(monitorRole)) {
        return Response.json({ error: 'Not authorized to run compliance evaluation' }, { status: 403 });
      }
      if (userRole && !canMonitor(monitorRole, userRole)) {
        return Response.json({ error: 'Cannot monitor a user at or above your role' }, { status: 403 });
      }

      // Load compliance KB rules + ground truth + approved scripts
      const [kbRules, approvedScripts] = await Promise.all([
        base44.asServiceRole.entities.ComplianceKnowledgeBase.list('-created_date', 200),
        base44.asServiceRole.entities.DebtScript.list('-sortOrder', 100),
      ]);

      const rules = (kbRules || []).filter(k => k.content);
      const scripts = (approvedScripts || []).filter(s => s.content);

      // Build the compliance evaluation prompt
      const rulesText = rules.map(r => {
        let line = `[${r.category}] ${r.title}: ${r.content}`;
        if (r.groundTruthJson) line += ` | Ground Truth: ${r.groundTruthJson}`;
        if (r.thresholdValue != null) line += ` | Threshold: ${r.thresholdValue}`;
        if (r.ruleInstructions) line += ` | Admin Instruction: ${r.ruleInstructions}`;
        return line;
      }).join('\n');

      const scriptsText = scripts.map(s => `[${s.scriptType}] ${s.name}:\n${s.content}`).join('\n---\n');

      const sensitivityPrompt = {
        strict: 'Use STRICT matching. Flag any deviation from approved scripts, even minor paraphrasing of regulatory disclosures. Every numerical claim must exactly match ground truth.',
        balanced: 'Use BALANCED matching. Flag clear regulatory disclosure omissions and factual misrepresentations. Allow conversational paraphrasing as long as legal meaning is preserved.',
        flexible: 'Use FLEXIBLE matching. Only flag clear factual misrepresentations and completely missing mandatory disclosures. Allow natural conversational variation.',
      }[sensitivityLevel || 'balanced'];

      const transcriptText = (fullTranscript || transcriptChunk || []).map(t => {
        const speaker = t.speaker === 0 ? 'Agent' : 'Customer';
        return `${speaker}: ${t.text}`;
      }).join('\n');

      const evalPrompt = `You are a compliance evaluation engine for a debt settlement call center. Evaluate the following live call transcript segment against the compliance rules and approved scripts.

${sensitivityPrompt}

COMPLIANCE RULES & GROUND TRUTH:
${rulesText || 'No specific rules configured yet.'}

APPROVED SCRIPTS:
${scriptsText || 'No approved scripts configured yet.'}

TRANSCRIPT TO EVALUATE:
${transcriptText}

Evaluate for:
1. REGULATORY DISCLOSURES: Did the agent make all required disclosures? (e.g., "this is not a loan", "we are not a credit repair company", "results may vary")
2. FACTUAL MISREPRESENTATION: Did the agent state any numerical claims (savings %, rates, timelines, success rates) that contradict the ground truth parameters? Flag exact mismatches.
3. SCRIPT DEVIATION: Did the agent deviate materially from approved scripts in ways that change legal meaning?
4. UNAPPROVED CLAIMS: Did the agent make promises or guarantees not in the approved scripts?
5. MISSING DISCLOSURE: Were any mandatory disclosures completely omitted?

Return JSON with:
- complianceScore (0-100, where 100 = fully compliant)
- compliantHooks (count of compliant script hooks observed)
- violations: array of { ruleViolated, ruleReference, flaggedText, expectedText, severity (LOW/MEDIUM/CRITICAL), confidenceScore (0-100), aiExplanation, groundTruthValue, claimedValue }
- summary: brief overall assessment

Only flag REAL violations. Do not flag minor conversational rephrasing. If the transcript is too short to evaluate, return score 100 and empty violations.`;

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: evalPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            complianceScore: { type: 'number' },
            compliantHooks: { type: 'number' },
            summary: { type: 'string' },
            violations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ruleViolated: { type: 'string' },
                  ruleReference: { type: 'string' },
                  flaggedText: { type: 'string' },
                  expectedText: { type: 'string' },
                  severity: { type: 'string' },
                  confidenceScore: { type: 'number' },
                  aiExplanation: { type: 'string' },
                  groundTruthValue: { type: 'string' },
                  claimedValue: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const score = result?.complianceScore ?? 100;
      const violations = result?.violations || [];
      const compliantHooks = result?.compliantHooks || 0;

      // If violations found, create a ComplianceRecord + Issues
      let record = null;
      let createdIssues = [];
      if (violations.length > 0) {
        // Generate Compliance ID
        const existingRecords = await base44.asServiceRole.entities.ComplianceRecord.list('-created_date', 500);
        const maxNum = (existingRecords || []).reduce((max, r) => {
          const n = parseInt((r.complianceId || '').replace('CMP-', '').replace(/-/g, ''), 10);
          return isNaN(n) ? max : Math.max(max, n);
        }, 0);
        const year = new Date().getFullYear();
        const complianceId = `CMP-${year}-${String(maxNum + 1).padStart(5, '0')}`;

        const criticalCount = violations.filter(v => v.severity === 'CRITICAL').length;
        const minorCount = violations.filter(v => v.severity === 'LOW').length;

        record = await base44.asServiceRole.entities.ComplianceRecord.create({
          complianceId,
          userId: body.userId || '',
          username: username || '',
          monitoredById: user.id,
          monitoredByUsername: user.username || '',
          transcriptId: transcriptId || '',
          leadId: leadId || '',
          leadName: leadName || '',
          callMode: callMode || 'open',
          status: 'OPEN',
          complianceScore: score,
          compliantHooks,
          violationsCount: violations.length,
          criticalCount,
          minorCount,
          sensitivityLevel: sensitivityLevel || 'balanced',
          transcriptJson: JSON.stringify(fullTranscript || transcriptChunk || []),
        });

        // Create issues
        const issueRecords = violations.map((v, i) => ({
          complianceRecordId: record.id,
          complianceId,
          timestampInCall: callStartIso ? Math.round((Date.now() - new Date(callStartIso).getTime()) / 1000) : 0,
          transcriptLineIndex: (fullTranscript || transcriptChunk || []).length - violations.length + i,
          ruleViolated: v.ruleViolated || 'script_deviation',
          ruleReference: v.ruleReference || '',
          flaggedText: v.flaggedText || '',
          expectedText: v.expectedText || '',
          severity: ['LOW', 'MEDIUM', 'CRITICAL'].includes(v.severity) ? v.severity : 'MEDIUM',
          confidenceScore: v.confidenceScore || 0,
          aiExplanation: v.aiExplanation || '',
          groundTruthValue: v.groundTruthValue || '',
          claimedValue: v.claimedValue || '',
        }));
        if (issueRecords.length > 0) {
          createdIssues = await base44.asServiceRole.entities.ComplianceIssue.bulkCreate(issueRecords);
        }

        // Add a system note to the record
        await base44.asServiceRole.entities.ComplianceNote.create({
          complianceRecordId: record.id,
          complianceId,
          authorUsername: 'system',
          authorRole: 'system',
          message: `Compliance ID issued automatically by AI engine. Score: ${score}/100. ${violations.length} violation(s) detected: ${violations.map(v => v.ruleViolated).join(', ')}.`,
          isSystem: true,
        });
      }

      return Response.json({
        complianceScore: score,
        compliantHooks,
        violationsCount: violations.length,
        violations: createdIssues,
        record: record ? { id: record.id, complianceId: record.complianceId, status: record.status } : null,
        summary: result?.summary || '',
      });
    }

    // ─── getLiveScore: Get current compliance score for an active call ──────
    if (action === 'getLiveScore') {
      const { username } = body;
      const records = await base44.asServiceRole.entities.ComplianceRecord.filter({ username }, '-created_date', 5);
      const openRecord = (records || []).find(r => r.status === 'OPEN' || r.status === 'UNDER_REVIEW');
      if (!openRecord) return Response.json({ score: 100, violations: 0, record: null });
      const issues = await base44.asServiceRole.entities.ComplianceIssue.filter({ complianceRecordId: openRecord.id }, '-created_date', 50);
      return Response.json({
        score: openRecord.complianceScore,
        violations: openRecord.violationsCount,
        critical: openRecord.criticalCount,
        minor: openRecord.minorCount,
        record: { id: openRecord.id, complianceId: openRecord.complianceId, status: openRecord.status },
        issues: (issues || []).map(i => ({ id: i.id, ruleViolated: i.ruleViolated, severity: i.severity, flaggedText: i.flaggedText, aiExplanation: i.aiExplanation })),
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}