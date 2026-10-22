import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { mailjet2, marketingUser, readMarketingTemplate, saveMarketingTemplate, renderMarketingEmail, sendMarketingEmail } from '../../shared/fronterMailjet.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const user = await marketingUser(base44, body);
    const action = body.action || 'send';
    const rows = page => page?.items || page || [];
    if (action === 'list') {
      const offset = Math.max(0, Number(body.offset) || 0);
      const data = await mailjet2(`/v3/REST/template?Limit=50&Offset=${offset}`);
      return Response.json({ templates: (data.Data || []).map(t => ({ id: String(t.ID), name: t.Name })), hasMore: (data.Data || []).length === 50, account: 2, canEdit: user.canEdit });
    }
    if (action === 'recipients') {
      const query = { email: { $regex: '@' }, status: { $nin: ['removed', 'migrated'] } };
      if (user.role === 'fronter') query.assignedTo = user.username;
      const search = String(body.search || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (search) query.$or = ['firstName', 'lastName', 'email', 'phone'].map(field => ({ [field]: { $regex: search, $options: 'i' } }));
      const [page, total] = await Promise.all([base44.asServiceRole.entities.FronterLead.filter(query, { sort: '-updated_date', limit: 50, ...(body.cursor ? { cursor: body.cursor } : {}) }), base44.asServiceRole.entities.FronterLead.count(query)]);
      return Response.json({ items: rows(page).map(c => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, status: c.status })), total, hasMore: !!page.has_more, cursor: page.next_cursor });
    }
    if (action === 'sync') {
      if (!user.canEdit) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const local = await base44.asServiceRole.entities.FronterEmailTemplate.get(body.localId);
      if (!local) return Response.json({ error: 'Template not found.' }, { status: 404 });
      let id = String(body.templateId || local.mailjetTemplateId || '');
      if (!id) {
        const created = await mailjet2('/v3/REST/template', 'POST', { Name: local.label, Purposes: ['marketing', 'transactional'] });
        id = String(created.Data?.[0]?.ID || '');
      }
      await readMarketingTemplate(base44, id);
      const template = await saveMarketingTemplate(base44, id, { name: local.label, subject: local.subject, html: local.body, localId: local.id }, user);
      return Response.json({ template, account: 2 });
    }
    const template = await readMarketingTemplate(base44, body.templateId);
    if (action === 'get') {
      const sample = await renderMarketingEmail(base44, template, { firstName: 'Test', lastName: 'Contact', email: '', debtAmount: 20000, noticeId: 'SAMPLE' });
      return Response.json({ template, previewHtml: sample.html, account: 2 });
    }
    if (action === 'save') {
      if (!user.canEdit) return Response.json({ error: 'Forbidden' }, { status: 403 });
      return Response.json({ template: await saveMarketingTemplate(base44, template.id, { ...body.draft, localId: template.localId }, user), account: 2 });
    }
    if (action === 'test') {
      const result = await sendMarketingEmail(base44, template, { firstName: 'Test', lastName: 'Contact', email: body.to, debtAmount: 20000, noticeId: 'SAMPLE' }, { test: true, sandbox: body.sandbox === true });
      return Response.json({ success: true, ...result });
    }
    if (action !== 'send') return Response.json({ error: 'Unknown marketing action.' }, { status: 400 });
    const ids = [...new Set(Array.isArray(body.leadIds) ? body.leadIds.filter(id => typeof id === 'string' && id) : [])];
    if (!ids.length || ids.length > 25) return Response.json({ error: 'Select between 1 and 25 contacts per send.' }, { status: 400 });
    const query = { id: { $in: ids }, status: { $nin: ['removed', 'migrated'] } };
    if (user.role === 'fronter') query.assignedTo = user.username;
    const cards = rows(await base44.asServiceRole.entities.FronterLead.filter(query, { limit: 25 }));
    const sent = [], failed = [];
    for (let i = 0; i < ids.length; i += 4) {
      const results = await Promise.allSettled(ids.slice(i, i + 4).map(async leadId => {
        const lead = cards.find(c => c.id === leadId);
        if (!lead) throw new Error('Contact not found or not assigned to this fronter.');
        const result = await sendMarketingEmail(base44, template, lead, { sandbox: body.sandbox === true });
        if (!result.sandbox) {
          const now = new Date().toISOString();
          await base44.asServiceRole.entities.EmailLog.create({ leadId, toEmail: result.to, toName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(), subject: result.subject, templateId: template.id, messageId: result.messageId, status: 'sent', sentAt: now, sentBy: user.username, fromEmail: result.from, isCustomEmail: true });
          const notes = JSON.parse(lead.notesLogJson || '[]');
          notes.push({ text: `${template.name} emailed via Mailjet account 2 to ${result.to}`, timestamp: now, author: user.username, type: 'marketing' });
          await base44.asServiceRole.entities.FronterLead.update(leadId, { notesLogJson: JSON.stringify(notes) });
        }
        return { leadId, ...result };
      }));
      results.forEach((result, index) => result.status === 'fulfilled' ? sent.push(result.value) : failed.push({ leadId: ids[i + index], error: result.reason?.message || String(result.reason) }));
    }
    return Response.json({ success: true, sent, failed, account: 2, provider: 'mailjet' });
  } catch (error) {
    const message = error?.message || String(error);
    return Response.json({ error: message }, { status: message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500 });
  }
}