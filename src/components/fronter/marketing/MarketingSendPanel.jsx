import { useState } from 'react';
import MarketingRecipientPicker from '@/components/fronter/marketing/MarketingRecipientPicker';
import useMarketingRecipients from '@/components/fronter/marketing/useMarketingRecipients';

export default function MarketingSendPanel({ template, call }) {
  const recipients = useMarketingRecipients(call);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [failures, setFailures] = useState([]);
  const send = async () => {
    if (!template || !recipients.selected.length || busy) return;
    setBusy(true); setStatus(''); setFailures([]);
    let sent = 0; const failed = []; const successful = [];
    try {
      const ids = [...recipients.selected];
      for (let index = 0; index < ids.length; index += 25) {
        const result = await call('send', { templateId: template.id, leadIds: ids.slice(index, index + 25) });
        sent += result.sent.length; failed.push(...result.failed); successful.push(...result.sent.map(item => item.leadId));
        setStatus(`${sent} accepted so far.`);
      }
      recipients.setSelected(previous => previous.filter(id => !successful.includes(id)));
      setStatus(`${sent} email${sent === 1 ? '' : 's'} accepted${failed.length ? `; ${failed.length} failed and remain selected` : ''}.`);
      setFailures(failed.map(item => item.error));
    } catch (error) {
      recipients.setSelected(previous => previous.filter(id => !successful.includes(id)));
      setStatus(`${sent} accepted before the send stopped.`); setFailures([error.message]);
    }
    setBusy(false);
  };
  return <div className="space-y-3">
    <MarketingRecipientPicker recipients={recipients} />
    <button type="button" className="calendar-button" disabled={!template || !recipients.selected.length || busy} onClick={send}>{busy ? 'Sending…' : `Send to ${recipients.selected.length} selected`}</button>
    {status && <p role="status" className="text-sm text-assistant-primary">{status}</p>}
    {failures.map((failure, index) => <p key={index} role="alert" className="calendar-error">{failure}</p>)}
  </div>;
}