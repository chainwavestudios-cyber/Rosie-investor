// Compliance Admin — knowledge base management, script approvals, conversational
// AI agent for rule ingestion, settings management, and aggregate reporting.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { isComplianceAdmin, isComplianceManager, canMonitor } from '../../shared/complianceRoles.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ─── getSettings: Get compliance settings for a user ────────────────────
    if (action === 'getSettings') {
      const { targetUserId } = body;
      const settings = await base44.asServiceRole.entities.ComplianceSettings.filter({ userId: targetUserId }, '-created_date', 10);
      return Response.json({ settings: (settings || [])[0] || null });
    }

    // ─── updateSettings: Toggle compliance monitoring for a user ────────────
    if (action === 'updateSettings') {
      const { targetUserId, targetUsername, targetRole, isEnabled, sensitivityLevel } = body;
      if (!isComplianceManager(user.role)) {
        return Response.json({ error: 'Not authorized to manage compliance settings' }, { status: 403 });
      }
      if (targetRole && !canMonitor(user.role, targetRole)) {
        return Response.json({ error: 'Cannot monitor a user at or above your role' }, { status: 403 });
      }
      const existing = await base44.asServiceRole.entities.ComplianceSettings.filter({ userId: targetUserId }, '-created_date', 10);
      const current = (existing || [])[0];
      if (current) {
        const updated = await base44.asServiceRole.entities.ComplianceSettings.update(current.id, {
          isEnabled,
          sensitivityLevel: sensitivityLevel || current.sensitivityLevel || 'balanced',
          enabledBy: isEnabled ? user.username : current.enabledBy,
          enabledById: isEnabled ? user.id : current.enabledById,
        });
        return Response.json({ settings: updated });
      }
      const created = await base44.asServiceRole.entities.ComplianceSettings.create({
        userId: targetUserId,
        username: targetUsername,
        userRole: targetRole || 'dialer',
        isEnabled,
        enabledBy: user.username,
        enabledById: user.id,
        sensitivityLevel: sensitivityLevel || 'balanced',
      });
      return Response.json({ settings: created });
    }

    // ─── listUsers: Get all users the monitor can see ────────────────────────
    if (action === 'listUsers') {
      if (!isComplianceManager(user.role)) {
        return Response.json({ error: 'Not authorized' }, { status: 403 });
      }
      const allUsers = await base44.asServiceRole.entities.DebtCoachUser.list('-created_date', 500);
      const visible = (allUsers || []).filter(u => canMonitor(user.role, u.role) && u.isActive);
      // Attach compliance settings
      const withSettings = await Promise.all((visible || []).map(async u => {
        const settings = await base44.asServiceRole.entities.ComplianceSettings.filter({ userId: u.id }, '-created_date', 1);
        return { ...u, complianceEnabled: (settings || [])[0]?.isEnabled || false, sensitivity: (settings || [])[0]?.sensitivityLevel || 'balanced' };
      }));
      return Response.json({ users: withSettings });
    }

    // ─── uploadKnowledge: Create a compliance KB entry from text/file ────────
    if (action === 'uploadKnowledge') {
      if (!isComplianceAdmin(user.role)) {
        return Response.json({ error: 'Admin access required for compliance KB' }, { status: 403 });
      }
      const { title, category, content, mediaType, fileUrl, ruleInstructions, groundTruthJson, thresholdValue, tags } = body;
      const created = await base44.asServiceRole.entities.ComplianceKnowledgeBase.create({
        title, category: category || 'custom_rule', content, mediaType: mediaType || 'MANUAL',
        fileUrl, ruleInstructions, groundTruthJson, thresholdValue, tags,
        createdBy: user.username,
      });
      return Response.json({ kb: created });
    }

    // ─── listKnowledge: List all compliance KB entries ───────────────────────
    if (action === 'listKnowledge') {
      if (!isComplianceAdmin(user.role)) {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }
      const entries = await base44.asServiceRole.entities.ComplianceKnowledgeBase.list('-created_date', 500);
      return Response.json({ entries: entries || [] });
    }

    // ─── deleteKnowledge ─────────────────────────────────────────────────────
    if (action === 'deleteKnowledge') {
      if (!isComplianceAdmin(user.role)) {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }
      await base44.asServiceRole.entities.ComplianceKnowledgeBase.delete(body.kbId);
      return Response.json({ ok: true });
    }

    // ─── agentChat: Conversational AI for rule ingestion ─────────────────────
    if (action === 'agentChat') {
      if (!isComplianceAdmin(user.role)) {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }
      const { message, fileUrl, history } = body;
      const existingKb = await base44.asServiceRole.entities.ComplianceKnowledgeBase.list('-created_date', 100);
      const kbContext = (existingKb || []).map(k => `[${k.category}] ${k.title}: ${k.content}`).join('\n');

      const chatPrompt = `You are a Compliance Knowledge Assistant for a debt settlement call center. An admin is chatting with you to create or modify compliance rules.

EXISTING COMPLIANCE RULES:
${kbContext || 'No rules yet.'}

${fileUrl ? `The admin uploaded a file. Extract relevant compliance rules from it and structure them.` : ''}

ADMIN MESSAGE: ${message}

CONVERSATION HISTORY:
${JSON.stringify(history || [])}

If the admin is asking you to create a rule, respond with a structured rule you can save. If they're asking a question, answer it. If they want to upload/add a document, guide them.

Return JSON with:
- reply: your conversational response to the admin
- suggestedRule: if you detect a rule to create, include { title, category, content, ruleInstructions, groundTruthJson, thresholdValue } — otherwise null
- action: "chat" | "create_rule" | "ask_clarification"`;

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: chatPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            reply: { type: 'string' },
            action: { type: 'string' },
            suggestedRule: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                category: { type: 'string' },
                content: { type: 'string' },
                ruleInstructions: { type: 'string' },
                groundTruthJson: { type: 'string' },
                thresholdValue: { type: 'number' },
              },
            },
          },
        },
      });

      // If a rule is suggested and the admin's message implies creation, auto-create it
      let createdKb = null;
      if (result?.suggestedRule?.title && result?.action === 'create_rule') {
        createdKb = await base44.asServiceRole.entities.ComplianceKnowledgeBase.create({
          title: result.suggestedRule.title,
          category: result.suggestedRule.category || 'custom_rule',
          content: result.suggestedRule.content || '',
          ruleInstructions: result.suggestedRule.ruleInstructions || '',
          groundTruthJson: result.suggestedRule.groundTruthJson || '',
          thresholdValue: result.suggestedRule.thresholdValue || null,
          mediaType: 'MANUAL',
          createdBy: user.username,
        });
      }

      return Response.json({
        reply: result?.reply || '',
        action: result?.action || 'chat',
        suggestedRule: result?.suggestedRule || null,
        createdKb: createdKb ? { id: createdKb.id, title: createdKb.title } : null,
      });
    }

    // ─── approveScript: Toggle compliance-approved on a script ───────────────
    if (action === 'approveScript') {
      if (!isComplianceAdmin(user.role)) {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }
      const { scriptId, isApproved } = body;
      const script = await base44.asServiceRole.entities.DebtScript.get(scriptId);
      if (!script) return Response.json({ error: 'Script not found' }, { status: 404 });
      const updated = await base44.asServiceRole.entities.DebtScript.update(scriptId, { /* no field on entity — we track via KB */ });
      // Create/update a KB entry for the approved script
      const existing = await base44.asServiceRole.entities.ComplianceKnowledgeBase.filter({ scriptId, category: 'approved_script' }, '-created_date', 1);
      if (isApproved) {
        if ((existing || []).length === 0) {
          await base44.asServiceRole.entities.ComplianceKnowledgeBase.create({
            title: `Approved Script: ${script.name}`,
            category: 'approved_script',
            content: script.content || '',
            mediaType: 'MANUAL',
            scriptId,
            isApprovedScript: true,
            createdBy: user.username,
          });
        }
      } else {
        for (const e of (existing || [])) {
          await base44.asServiceRole.entities.ComplianceKnowledgeBase.delete(e.id);
        }
      }
      return Response.json({ ok: true, isApproved });
    }

    // ─── getRecords: Get compliance records (filtered by role) ───────────────
    if (action === 'getRecords') {
      const { targetUsername, status } = body;
      let records;
      if (targetUsername) {
        records = await base44.asServiceRole.entities.ComplianceRecord.filter({ username: targetUsername }, '-created_date', 200);
      } else if (isComplianceManager(user.role)) {
        records = await base44.asServiceRole.entities.ComplianceRecord.list('-created_date', 200);
      } else {
        // Dialers/managers see only their own
        records = await base44.asServiceRole.entities.ComplianceRecord.filter({ username: user.username }, '-created_date', 200);
      }
      if (status) records = (records || []).filter(r => r.status === status);
      return Response.json({ records: records || [] });
    }

    // ─── getRecord: Get a single compliance record with issues, notes, remedies ─
    if (action === 'getRecord') {
      const { recordId } = body;
      const record = await base44.asServiceRole.entities.ComplianceRecord.get(recordId);
      if (!record) return Response.json({ error: 'Not found' }, { status: 404 });
      // RBAC: dialers/managers can only see their own
      if (!isComplianceManager(user.role) && record.username !== user.username) {
        return Response.json({ error: 'Not authorized' }, { status: 403 });
      }
      const [issues, notes, remedies] = await Promise.all([
        base44.asServiceRole.entities.ComplianceIssue.filter({ complianceRecordId: recordId }, '-created_date', 100),
        base44.asServiceRole.entities.ComplianceNote.filter({ complianceRecordId: recordId }, 'created_date', 200),
        base44.asServiceRole.entities.ComplianceRemedy.filter({ complianceRecordId: recordId }, '-created_date', 50),
      ]);
      return Response.json({ record, issues: issues || [], notes: notes || [], remedies: remedies || [] });
    }

    // ─── addNote: Add a message to the compliance dialogue thread ────────────
    if (action === 'addNote') {
      const { recordId, message } = body;
      const record = await base44.asServiceRole.entities.ComplianceRecord.get(recordId);
      if (!record) return Response.json({ error: 'Not found' }, { status: 404 });
      if (!isComplianceManager(user.role) && record.username !== user.username) {
        return Response.json({ error: ' ' }, { status: 403 });
      }
      const note = await base44.asServiceRole.entities.ComplianceNote.create({
        complianceRecordId: recordId,
        complianceId: record.complianceId,
        authorId: user.id,
        authorUsername: user.username,
        authorRole: user.role,
        message,
      });
      return Response.json({ note });
    }

    // ─── addRemedy: Assign a remedy to a compliance record ───────────────────
    if (action === 'addRemedy') {
      if (!isComplianceManager(user.role)) {
        return Response.json({ error: 'Not authorized to assign remedies' }, { status: 403 });
      }
      const { recordId, mediaType, fileUrl, fileUri, title, description, quizJson } = body;
      const record = await base44.asServiceRole.entities.ComplianceRecord.get(recordId);
      if (!record) return Response.json({ error: 'Not found' }, { status: 404 });
      const remedy = await base44.asServiceRole.entities.ComplianceRemedy.create({
        complianceRecordId: recordId,
        complianceId: record.complianceId,
        mediaType: mediaType || 'TEXT',
        fileUrl, fileUri, title, description,
        assignedBy: user.username,
        assignedAt: new Date().toISOString(),
        quizJson,
      });
      // Move record to UNDER_REVIEW if currently OPEN
      if (record.status === 'OPEN') {
        await base44.asServiceRole.entities.ComplianceRecord.update(recordId, { status: 'UNDER_REVIEW' });
      }
      return Response.json({ remedy });
    }

    // ─── acknowledgeRemedy: User acknowledges a remedy ──────────────────────
    if (action === 'acknowledgeRemedy') {
      const { remedyId, quizAnswersJson, quizPassed } = body;
      const remedy = await base44.asServiceRole.entities.ComplianceRemedy.get(remedyId);
      if (!remedy) return Response.json({ error: 'Not found' }, { status: 404 });
      const updated = await base44.asServiceRole.entities.ComplianceRemedy.update(remedyId, {
        isAcknowledged: true,
        acknowledgedAt: new Date().toISOString(),
        quizAnswersJson,
        quizPassed: quizPassed || false,
      });
      // Check if all remedies for this record are acknowledged + quiz passed
      const record = await base44.asServiceRole.entities.ComplianceRecord.get(remedy.complianceRecordId);
      const allRemedies = await base44.asServiceRole.entities.ComplianceRemedy.filter({ complianceRecordId: remedy.complianceRecordId }, '-created_date', 50);
      const allAck = (allRemedies || []).every(r => r.isAcknowledged);
      const allQuiz = (allRemedies || []).every(r => !r.quizJson || r.quizPassed);
      if (allAck && allQuiz && record?.status === 'UNDER_REVIEW') {
        await base44.asServiceRole.entities.ComplianceRecord.update(remedy.complianceRecordId, { status: 'REMEDIED', remedyAcknowledged: true, quizPassed: allQuiz });
      }
      return Response.json({ remedy: updated });
    }

    // ─── closeRecord: Close a compliance ID ─────────────────────────────────
    if (action === 'closeRecord') {
      if (!isComplianceManager(user.role)) {
        return Response.json({ error: 'Not authorized to close compliance IDs' }, { status: 403 });
      }
      const { recordId, closeNote } = body;
      const record = await base44.asServiceRole.entities.ComplianceRecord.get(recordId);
      if (!record) return Response.json({ error: 'Not found' }, { status: 404 });
      const updated = await base44.asServiceRole.entities.ComplianceRecord.update(recordId, {
        status: 'CLOSED',
        closedAt: new Date().toISOString(),
        closedBy: user.username,
      });
      if (closeNote) {
        await base44.asServiceRole.entities.ComplianceNote.create({
          complianceRecordId: recordId,
          complianceId: record.complianceId,
          authorId: user.id,
          authorUsername: user.username,
          authorRole: user.role,
          message: closeNote,
        });
      }
      return Response.json({ record: updated });
    }

    // ─── generateQuiz: Auto-generate a 3-question quiz for a remedy ──────────
    if (action === 'generateQuiz') {
      if (!isComplianceManager(user.role)) {
        return Response.json({ error: 'Not authorized' }, { status: 403 });
      }
      const { remedyId } = body;
      const remedy = await base44.asServiceRole.entities.ComplianceRemedy.get(remedyId);
      if (!remedy) return Response.json({ error: 'Not found' }, { status: 404 });

      let contentSource = remedy.description || '';
      if (remedy.fileUrl) {
        try {
          const extracted = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
            file_url: remedy.fileUrl,
            json_schema: { type: 'object', properties: { content: { type: 'string' } } },
          });
          contentSource = (extracted?.output?.content || '') + ' ' + contentSource;
        } catch {}
      }

      const quizResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Generate a 3-question multiple-choice quiz to verify the reader understood this compliance training material. Each question should test key compliance concepts.

MATERIAL:
${contentSource || 'No content available.'}

Return JSON with a "questions" array, each having: question, options (4 choices), correctIndex (0-3).`,
        response_json_schema: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  options: { type: 'array', items: { type: 'string' } },
                  correctIndex: { type: 'number' },
                },
              },
            },
          },
        },
      });

      const quizJson = JSON.stringify(quizResult?.questions || []);
      await base44.asServiceRole.entities.ComplianceRemedy.update(remedyId, { quizJson });
      return Response.json({ quiz: quizResult?.questions || [] });
    }

    // ─── getStats: Aggregate compliance reporting ────────────────────────────
    if (action === 'getStats') {
      const { dateFrom, dateTo, targetUsername } = body;
      let records = await base44.asServiceRole.entities.ComplianceRecord.list('-created_date', 500);
      if (targetUsername) records = (records || []).filter(r => r.username === targetUsername);
      if (dateFrom) records = (records || []).filter(r => new Date(r.created_date) >= new Date(dateFrom));
      if (dateTo) records = (records || []).filter(r => new Date(r.created_date) <= new Date(dateTo));

      const total = (records || []).length;
      const open = (records || []).filter(r => r.status === 'OPEN').length;
      const remedied = (records || []).filter(r => r.status === 'REMEDIED').length;
      const closed = (records || []).filter(r => r.status === 'CLOSED').length;
      const avgScore = total > 0 ? Math.round((records || []).reduce((s, r) => s + (r.complianceScore || 0), 0) / total) : 100;
      const totalViolations = (records || []).reduce((s, r) => s + (r.violationsCount || 0), 0);
      const criticalViolations = (records || []).reduce((s, r) => s + (r.criticalCount || 0), 0);

      // Violation type breakdown
      const allIssues = await base44.asServiceRole.entities.ComplianceIssue.list('-created_date', 500);
      const recordIds = new Set((records || []).map(r => r.id));
      const relevantIssues = (allIssues || []).filter(i => recordIds.has(i.complianceRecordId));
      const byRule = {};
      for (const i of relevantIssues) {
        byRule[i.ruleViolated] = (byRule[i.ruleViolated] || 0) + 1;
      }

      // Per-user breakdown
      const byUser = {};
      for (const r of (records || [])) {
        if (!byUser[r.username]) byUser[r.username] = { username: r.username, total: 0, open: 0, avgScore: 0, scores: [] };
        byUser[r.username].total++;
        if (r.status === 'OPEN') byUser[r.username].open++;
        byUser[r.username].scores.push(r.complianceScore || 0);
      }
      for (const u of Object.values(byUser)) {
        u.avgScore = u.scores.length > 0 ? Math.round(u.scores.reduce((s, v) => s + v, 0) / u.scores.length) : 100;
        delete u.scores;
      }

      return Response.json({
        total, open, remedied, closed, avgScore, totalViolations, criticalViolations,
        byRule, byUser: Object.values(byUser),
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}