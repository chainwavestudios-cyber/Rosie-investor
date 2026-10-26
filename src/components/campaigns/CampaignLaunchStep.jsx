/**
 * CampaignLaunchStep.jsx — step 5: review, approve, start.
 *
 * A CSV upload never sends anything. This is the one screen where sends begin,
 * and only after the operator has looked at the recipients and ticked that they
 * reviewed them. The queues set here are what paces every later send, all day.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Btn, Card, DIM, Field, GOLD, MUTED, Stat, inputStyle } from './kit';
import CampaignRecipientsTable from './CampaignRecipientsTable';
import CampaignQueues from './CampaignQueues';
import Time12Picker from '@/components/shared/Time12Picker';
import { mirrorPatch, parseQueues } from '@/lib/campaignQueues';
import { fmt12Range } from '@/lib/time12';

const defaultForm = (campaign) => ({
  dailyLimit: Number(campaign?.dailyLimit || 25),
  windowStart: campaign?.windowStart || '08:00',
  windowEnd: campaign?.windowEnd || '20:00',
  timezone: campaign?.timezone || 'America/New_York',
});

export default function CampaignLaunchStep({ campaign, save, username, onStarted }) {
  const [excluded, setExcluded] = useState(new Set());
  const [reviewed, setReviewed] = useState(false);
  const [form, setForm] = useState(defaultForm(campaign));
  const [queues, setQueues] = useState(() => parseQueues(campaign));
  const [counts, setCounts] = useState({ pending: 0, sent: 0, skipped: 0, failed: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadCounts = useCallback(async () => {
    const [pending, sent, skipped, failed] = await Promise.all([
      base44.entities.EmailCampaignRecipient.count({ campaignId: campaign.id, status: 'pending' }).catch(() => 0),
      base44.entities.EmailCampaignRecipient.count({ campaignId: campaign.id, status: 'sent' }).catch(() => 0),
      base44.entities.EmailCampaignRecipient.count({ campaignId: campaign.id, status: 'skipped' }).catch(() => 0),
      base44.entities.EmailCampaignRecipient.count({ campaignId: campaign.id, status: 'failed' }).catch(() => 0),
    ]);
    setCounts({ pending, sent, skipped, failed });
  }, [campaign.id]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  const toggle = (id, approved) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (approved) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const approveAndStart = async () => {
    setBusy(true);
    setError('');
    try {
      for (const id of excluded) {
        await base44.entities.EmailCampaignRecipient.update(id, { status: 'skipped', reason: 'Taken out before launch' });
      }
      const now = new Date().toISOString();
      await save({
        ...form,
        queuesJson: JSON.stringify(queues),
        ...mirrorPatch(queues),
        status: 'running',
        approvedAt: now,
        approvedBy: username || 'admin',
        startedAt: now,
      });
      onStarted();
    } catch (e) {
      setError(e?.message || 'The campaign could not be started.');
    }
    setBusy(false);
  };

  const activeQueues = queues.filter((queue) => queue.enabled);
  const missing = [];
  if (!campaign.templateId) missing.push('an email template (step 3)');
  if (!counts.pending) missing.push('at least one approved recipient');
  if (!activeQueues.length) missing.push('at least one queue switched on');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Stat label="Ready to send" value={counts.pending.toLocaleString()} color={GOLD} hint={excluded.size ? `${excluded.size} taken out` : 'everyone eligible'} />
        <Stat label="Already sent" value={counts.sent} color="#60a5fa" />
        <Stat label="Skipped" value={counts.skipped} color={MUTED} />
        <Stat label="Failed" value={counts.failed} color={counts.failed ? '#ef4444' : MUTED} />
      </div>

      <Card
        title="Sending queues"
        hint="Each queue sends its own number of emails and then waits a random time between its shortest and longest gap. With more than one queue, one is picked at random for every send — so the pace keeps changing."
      >
        <CampaignQueues queues={queues} onChange={setQueues} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '10px', marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.09)', paddingTop: '14px' }}>
          <Field label="Emails per day">
            <input type="number" min="1" style={inputStyle} value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: Number(e.target.value) })} />
          </Field>
          <Field label="Window start">
            <Time12Picker value={form.windowStart} onChange={(v) => setForm({ ...form, windowStart: v })} inputStyle={inputStyle} />
          </Field>
          <Field label="Window end">
            <Time12Picker value={form.windowEnd} onChange={(v) => setForm({ ...form, windowEnd: v })} inputStyle={inputStyle} />
          </Field>
          <Field label="Timezone">
            <select style={inputStyle} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
              {['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Pacific/Honolulu'].map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ color: DIM, fontSize: '10px', marginTop: '10px' }}>
          Up to {form.dailyLimit} emails a day, sent one queue at a time inside {fmt12Range(form.windowStart, form.windowEnd)} {form.timezone}, until the whole list is done.
        </div>
      </Card>

      <Card title="Approve the recipients" hint="Untick anyone who should not receive this campaign — they are recorded as skipped with the reason, never silently dropped.">
        <CampaignRecipientsTable
          campaignId={campaign.id}
          refreshKey={campaign.updated_date}
          selectable
          excluded={excluded}
          onToggle={toggle}
        />
        <label style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', marginTop: '14px', cursor: 'pointer' }}>
          <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} style={{ marginTop: '2px' }} />
          <span style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.6 }}>
            I have reviewed these {counts.pending.toLocaleString()} recipients and approve them for this campaign.
            {' '}Nothing has been sent yet — starting the queue is the next click.
          </span>
        </label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
          <Btn tone="gold" onClick={approveAndStart} disabled={!reviewed || busy || !!missing.length}>
            {busy ? 'Starting…' : '🚀 Approve & start the queue'}
          </Btn>
          {!!missing.length && <span style={{ color: '#f59e0b', fontSize: '11px' }}>Still needed: {missing.join(' and ')}.</span>}
          <span style={{ color: DIM, fontSize: '11px' }}>You can pause, resume or cancel at any point from step 6.</span>
        </div>
        {error && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '10px' }}>{error}</div>}
      </Card>
    </div>
  );
}