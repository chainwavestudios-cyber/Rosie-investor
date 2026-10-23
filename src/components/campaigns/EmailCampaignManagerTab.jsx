/**
 * EmailCampaignManagerTab.jsx — the Email Campaign Manager module.
 *
 * One place for CSV-driven bulk email: a campaign list, the six-step builder,
 * the results monitor, and the reusable email template library.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Btn, GOLD, MUTED, Stat } from './kit';
import CampaignsList from './CampaignsList';
import CampaignWizard from './CampaignWizard';
import CampaignMonitor from './CampaignMonitor';
import TemplateLibrary from './TemplateLibrary';

export default function EmailCampaignManagerTab({ username }) {
  const [view, setView] = useState('list');
  const [campaignId, setCampaignId] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const page = await base44.entities.EmailCampaignJob.list('-created_date', 100).catch(() => []);
    setCampaigns(page?.items || page || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const startNew = async () => {
    setBusy(true);
    const created = await base44.entities.EmailCampaignJob.create({
      name: 'Untitled campaign',
      status: 'draft',
      createdBy: username || '',
      batchSize: 25,
      intervalSeconds: 60,
      dailyLimit: 500,
      windowStart: '08:00',
      windowEnd: '20:00',
      timezone: 'America/New_York',
    });
    setBusy(false);
    setCampaignId(created.id);
    setView('wizard');
    load();
  };

  const open = (campaign) => {
    setCampaignId(campaign.id);
    setView(['running', 'paused', 'completed'].includes(campaign.status) ? 'monitor' : 'wizard');
  };

  const active = campaigns.filter((c) => ['running', 'paused'].includes(c.status)).length;
  const totals = campaigns.reduce((acc, c) => ({
    sent: acc.sent + Number(c.sentCount || 0),
    eligible: acc.eligible + Number(c.eligibleCount || 0),
    failed: acc.failed + Number(c.failedCount || 0),
  }), { sent: 0, eligible: 0, failed: 0 });

  if (view === 'wizard' && campaignId) {
    return (
      <CampaignWizard
        campaignId={campaignId}
        username={username}
        onExit={() => { setView('list'); setCampaignId(''); load(); }}
        onChanged={load}
      />
    );
  }

  if (view === 'monitor' && campaignId) {
    return (
      <CampaignMonitor
        campaignId={campaignId}
        onBack={() => { setView('list'); setCampaignId(''); load(); }}
        onChanged={load}
      />
    );
  }

  if (view === 'templates') {
    return <TemplateLibrary username={username} onBack={() => setView('list')} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: GOLD, fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📮 Email Campaign Manager</div>
          <div style={{ color: MUTED, fontSize: '12px', marginTop: '4px' }}>
            Upload a CSV, map its columns, pick one of your mailers, and send through the connected Gmail account — one email per recipient, each with its own links. Nothing sends until you review and approve the recipients.
          </div>
        </div>
        <Btn tone="ghost" onClick={() => setView('templates')}>📚 Email Templates</Btn>
        <Btn tone="gold" onClick={startNew} disabled={busy}>{busy ? 'Creating…' : '＋ New Campaign'}</Btn>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Stat label="Campaigns" value={campaigns.length} color={MUTED} />
        <Stat label="Running now" value={active} color={GOLD} />
        <Stat label="Recipients eligible" value={totals.eligible} color="#60a5fa" />
        <Stat label="Emails sent" value={totals.sent} color={GOLD} />
        <Stat label="Failed sends" value={totals.failed} color={totals.failed ? '#ef4444' : MUTED} />
      </div>

      {loading ? (
        <div style={{ color: MUTED, fontSize: '12px', padding: '20px 0' }}>Loading campaigns…</div>
      ) : (
        <CampaignsList
          campaigns={campaigns}
          onOpen={open}
          onChanged={load}
        />
      )}
    </div>
  );
}