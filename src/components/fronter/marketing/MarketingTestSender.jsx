import { useState } from 'react';

export default function MarketingTestSender({ template, call }) {
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const send = async event => {
    event.preventDefault();
    if (!template) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const result = await call('test', { templateId: template.id, to: to.trim() });
      setStatus(`The test send to ${result.to} was accepted. No contact record or campaign was changed.`);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  return <form className="calendar-panel space-y-3" onSubmit={send}>
    <h3 className="font-semibold">Send a test email now</h3>
    <p className="text-sm text-assistant-muted">Uses the selected saved template and sample details, through the outreach sender only.</p>
    <div className="flex flex-wrap items-end gap-3"><label className="calendar-label min-w-0 flex-1">Test email address<input type="email" aria-label="Marketing test email address" required value={to} onChange={event => setTo(event.target.value)} className="calendar-field mt-1" placeholder="Enter a test email address" /></label><button className="calendar-button" disabled={!template || busy}>{busy ? 'Sending…' : 'Send test'}</button></div>
    {status && <p role="status" className="text-sm text-assistant-primary">{status}</p>}
    {error && <p role="alert" className="calendar-error">{error}</p>}
  </form>;
}