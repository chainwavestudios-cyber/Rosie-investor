import { useState } from 'react';
import EmailDocumentEditor from '@/components/fronter/marketing/EmailDocumentEditor';

export default function MarketingTemplateEditor({ template, call, onSaved, onClose }) {
  const [draft, setDraft] = useState(template);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (field, value) => setDraft(previous => ({ ...previous, [field]: value }));
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await call('save', { templateId: template.id, draft });
      await onSaved(); onClose();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  return <form className="calendar-panel space-y-4" onSubmit={save}>
    <h3 className="calendar-title">Edit marketing template</h3>
    <label className="calendar-label">Template name<input aria-label="Marketing template name" required className="calendar-field mt-1" value={draft.name} onChange={event => set('name', event.target.value)} /></label>
    <label className="calendar-label">Email subject<input aria-label="Marketing email subject" required className="calendar-field mt-1" value={draft.subject} onChange={event => set('subject', event.target.value)} /></label>
    <EmailDocumentEditor html={draft.html} onChange={value => set('html', value)} />
    {error && <p role="alert" className="calendar-error">{error}</p>}
    <div className="flex flex-wrap gap-2"><button className="calendar-button" disabled={busy}>{busy ? 'Saving…' : 'Save template'}</button><button type="button" className="calendar-secondary" disabled={busy} onClick={onClose}>Cancel</button></div>
  </form>;
}