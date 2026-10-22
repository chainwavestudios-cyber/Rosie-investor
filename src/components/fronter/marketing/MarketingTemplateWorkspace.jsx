import { useState } from 'react';
import MarketingTemplateEditor from '@/components/fronter/marketing/MarketingTemplateEditor';

export default function MarketingTemplateWorkspace({ marketing }) {
  const [editing, setEditing] = useState(false);
  const { templates, templateId, setTemplateId, template, previewHtml, canEdit, hasMore, loadCatalog, loadTemplate, call } = marketing;
  return <section className="calendar-panel space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <label className="calendar-label flex-1 min-w-0">Marketing templates
        <select aria-label="Marketing template" className="calendar-field mt-2" value={templateId} onChange={event => { setEditing(false); setTemplateId(event.target.value); }}>
          {!templates.length && <option value="">No templates in account 2</option>}
          {templates.map(item => <option key={item.id} value={item.id}>{item.name} · #{item.id}</option>)}
        </select>
      </label>
      <button type="button" className="calendar-secondary" onClick={() => loadCatalog()}>Refresh templates</button>
      {hasMore && <button type="button" className="calendar-secondary" onClick={() => loadCatalog(templates.length)}>More templates</button>}
    </div>
    {templateId && !template && <p role="status" className="text-sm text-assistant-muted">Loading email preview…</p>}
    {template && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{template.name}</h3><p className="text-sm text-assistant-muted">Subject: {template.subject}</p><p className="text-xs text-assistant-info">Outreach sender · {template.name} · Never Gmail</p></div>{canEdit && <button type="button" className="calendar-secondary" onClick={() => setEditing(!editing)}>{editing ? 'Close editor' : 'Edit template / images'}</button>}</div>
      {editing ? <MarketingTemplateEditor key={template.id} template={template} call={call} onSaved={loadTemplate} onClose={() => setEditing(false)} /> : <iframe title="Email preview" sandbox="" className="h-[480px] w-full rounded border border-assistant-border bg-background" srcDoc={previewHtml} />}
      {/mailer_html/.test(template.html) && <p className="text-xs text-assistant-muted">Your saved Rate Drop HTML notice is inserted into this template for each recipient. The preview uses sample contact details.</p>}
    </>}
  </section>;
}