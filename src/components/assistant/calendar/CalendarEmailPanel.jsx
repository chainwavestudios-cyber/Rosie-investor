import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ApptTrackingBadges from '@/components/debt/ApptTrackingBadges';
import useSuperAdminConfig, { contactCardValues } from '@/hooks/useSuperAdminConfig';

export default function CalendarEmailPanel({ lead }) {
  const [sending, setSending] = useState(''), [message, setMessage] = useState(''), [error, setError] = useState('');
  const cache = useQueryClient();
  const templates = useQuery({ queryKey: ['calendar-email-templates'], queryFn: () => base44.entities.DebtEmailTemplate.filter({ $or: [{ name: { $regex: '^\\s*credentials\\s*$', $options: 'i' } }, { attachToContactCard: true }] }, { sort: 'sortOrder', limit: 50 }) });
  const send = async (template) => {
    setSending(template.id); setMessage(''); setError('');
    try { const { data } = await base44.functions.invoke('sendDebtEmail', { templateId: template.id, leadId: lead.id }); if (data?.error) throw new Error(data.error); setMessage(`${template.name} sent to ${lead.email}.`); cache.invalidateQueries({ queryKey: ['calendar-email-opens', lead.id] }); }
    catch (e) { setError(e.message); } finally { setSending(''); }
  };
  const opened = useQuery({ queryKey: ['calendar-email-opens', lead.id], queryFn: () => base44.entities.EmailTrackingEvent.count({ leadId: lead.id, eventType: 'open', templateName: { $regex: '^credentials$', $options: 'i' } }), refetchInterval: 30000 });
  const { config } = useSuperAdminConfig();
  const welcomeMessage = contactCardValues(config).welcomeMessage;
  return <section className="calendar-panel">
    <h3 className="calendar-title">Credentials & welcome email</h3>
    <p className="mb-4 text-sm leading-relaxed text-assistant-muted">Send or resend the “credentials” template, including Chris’s welcome message, through the existing tracked email flow.</p>
    <p className="mb-4 break-all text-sm text-assistant-info">To: {lead.email || 'No email on file. Open the Lead Contact Card to add one.'}</p>
    {welcomeMessage && <div className="mb-5 rounded-md border border-assistant-border bg-assistant-canvas p-4"><div className="calendar-label">Welcome message</div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-assistant-ink">{welcomeMessage}</p></div>}
    {templates.isPending && <p className="text-assistant-muted">Loading email buttons…</p>}
    {templates.isError && <p role="alert" className="calendar-error">Could not load email templates.</p>}
    <div className="mb-5 flex flex-wrap gap-3">{templates.data?.items.map(t => <button key={t.id} onClick={() => send(t)} disabled={!!sending || !lead.email} className="calendar-button">{sending === t.id ? 'Sending…' : (t.name.trim().toLowerCase() === 'credentials' ? 'Send Credentials & Welcome Email' : t.buttonLabel || t.name)}</button>)}</div>
    {templates.data?.items.length === 0 && <p className="text-sm text-assistant-warning">No credentials template or contact-card email buttons found.</p>}
    {message && <p role="status" className="mb-4 text-sm text-assistant-primary">{message}</p>}
    {error && <p role="alert" className="calendar-error mb-4">Email failed: {error}</p>}
    <div className="border-t border-assistant-border pt-4"><h4 className="calendar-label">Email engagement</h4>
      <p className="mb-3 text-sm text-assistant-muted">{opened.isPending ? 'Loading credentials open status…' : opened.isError ? 'Credentials open status unavailable.' : opened.data > 0 ? 'Credentials email opened' : 'No credentials email open recorded yet'}</p>
      <ApptTrackingBadges lead={lead} />
    </div>
  </section>;
}