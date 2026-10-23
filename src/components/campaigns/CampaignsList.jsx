/**
 * CampaignsList.jsx — every campaign the manager has built, with its live counts.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Btn, Card, DIM, MUTED, STATUS_TONE, SURFACE, BORDER } from './kit';

const when = (value) => (value ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

export default function CampaignsList({ campaigns, onOpen, onChanged }) {
  const [busyId, setBusyId] = useState('');

  const remove = async (campaign) => {
    setBusyId(campaign.id);
    await base44.entities.EmailCampaignJob.delete(campaign.id).catch(() => {});
    setBusyId('');
    onChanged();
  };

  if (!campaigns.length) {
    return (
      <Card title="No campaigns yet" hint="Start with “New Campaign” — step 1 takes the CSV, step 5 is where anything actually sends.">
        <div style={{ color: DIM, fontSize: '12px' }}>Nothing has been imported or sent.</div>
      </Card>
    );
  }

  return (
    <Card title="Campaigns" hint="Newest first. Open a draft to keep building it; open a running one to watch the queue.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {campaigns.map((campaign) => {
          const tone = STATUS_TONE[campaign.status] || MUTED;
          const total = Number(campaign.eligibleCount || 0) || Number(campaign.importedCount || 0);
          const sent = Number(campaign.sentCount || 0);
          const pct = total ? Math.min(100, Math.round((sent / total) * 100)) : 0;
          return (
            <div key={campaign.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${tone}`, borderRadius: '5px', padding: '11px 13px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{campaign.name || 'Untitled campaign'}</span>
                  <span style={{ background: `${tone}22`, color: tone, border: `1px solid ${tone}55`, borderRadius: '3px', padding: '1px 7px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{campaign.status}</span>
                  {campaign.templateName && <span style={{ color: MUTED, fontSize: '11px' }}>📧 {campaign.templateName}</span>}
                </div>
                <div style={{ color: DIM, fontSize: '11px', marginTop: '4px' }}>
                  {campaign.listName ? `${campaign.listName} · ` : ''}
                  {Number(campaign.importedCount || 0)} rows imported · {Number(campaign.eligibleCount || 0)} eligible
                  {Number(campaign.excludedCount || 0) ? ` · ${campaign.excludedCount} excluded` : ''}
                  {sent ? ` · ${sent} sent` : ''}
                  {Number(campaign.failedCount || 0) ? ` · ${campaign.failedCount} failed` : ''}
                </div>
                {total > 0 && (
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', marginTop: '7px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${tone},${tone}88)` }} />
                  </div>
                )}
                <div style={{ color: DIM, fontSize: '10px', marginTop: '5px' }}>
                  Created {when(campaign.created_date)}{campaign.lastRunAt ? ` · last queue run ${when(campaign.lastRunAt)}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '7px' }}>
                <Btn tone={['running', 'paused', 'completed'].includes(campaign.status) ? 'blue' : 'gold'} onClick={() => onOpen(campaign)}>
                  {['running', 'paused', 'completed'].includes(campaign.status) ? '📊 Monitor' : '✎ Open builder'}
                </Btn>
                {campaign.status === 'draft' && !Number(campaign.sentCount || 0) && (
                  <Btn tone="danger" onClick={() => remove(campaign)} disabled={busyId === campaign.id}>{busyId === campaign.id ? '…' : 'Delete'}</Btn>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}