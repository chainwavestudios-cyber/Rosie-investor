import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/** Sends the contact card's “credentials” template (with the welcome message) to this client. */
export default function CalendarCredentialsButton({ lead }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const templates = useQuery({
    queryKey: ['calendar-credentials-template'],
    queryFn: () => base44.entities.DebtEmailTemplate.filter({ name: { $regex: '^\\s*credentials\\s*$', $options: 'i' } }, { limit: 1 }),
  });
  const template = templates.data?.items?.[0];

  const send = async () => {
    if (!template) return;
    setBusy(true); setMessage(''); setError('');
    try {
      const { data } = await base44.functions.invoke('sendDebtEmail', { templateId: template.id, leadId: lead.id });
      if (data?.error) throw new Error(data.error);
      setMessage(`Credentials & welcome email sent to ${lead.email}.`);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return <>
    <button onClick={send} disabled={busy || !template || !lead?.email} className="calendar-button">
      <Mail size={16} />{busy ? 'Sending…' : 'Send Credentials & Welcome Email'}
    </button>
    {!lead?.email && <p className="basis-full text-sm text-assistant-warning">No email on file — add one on the lead card first.</p>}
    {templates.isError && <p role="alert" className="basis-full text-sm text-assistant-warning">Could not load the credentials template.</p>}
    {message && <p role="status" className="basis-full text-sm text-assistant-primary">{message}</p>}
    {error && <p role="alert" className="calendar-error basis-full">Email failed: {error}</p>}
  </>;
}