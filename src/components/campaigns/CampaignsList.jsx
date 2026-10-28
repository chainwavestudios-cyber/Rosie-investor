
/** Campaign history as compact, scannable rows with actionable progress. */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowUpRight, BarChart3, FilePenLine, Inbox, Trash2 } from 'lucide-react';

function when(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—';
  return new Date(value).toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});
}

export default function CampaignsList({ campaigns, totalCount, onOpen, onEdit, onChanged }) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const remove = async (campaign) => {
    if (busyId || !window.confirm('Delete the unsent draft “' + (campaign.name || 'Untitled campaign') + '”? This cannot be undone.')) return;
    setBusyId(campaign.id);
    setError('');
    try {
      await base44.entities.EmailCampaignJob.delete(campaign.id);
      onChanged?.();
    } catch (err) {
      setError(err?.message || 'Could not delete the draft.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="ecm-panel" aria-label="Campaign history">
      <div className="ecm-panel-heading">
        <h3>Campaign history</h3>
        <span>{campaigns.length} shown{typeof totalCount === 'number' && totalCount !== campaigns.length ? ' of ' + totalCount : ''} · newest first</span>
      </div>
      {error && <div className="ecm-error" role="alert">{error}</div>}
      {!campaigns.length ? (
        <div className="ecm-empty">
          <Inbox size={22} />
          {totalCount ? 'No campaigns match your search or filter.' : 'No campaigns yet. Create one to start with a CSV, then review before sending.'}
        </div>
      ) : (
        <div>
          {campaigns.map(campaign => {
            const total = Number(campaign.eligibleCount || 0) || Number(campaign.importedCount || 0);
            const sent = Number(campaign.sentCount || 0);
            const pct = total ? Math.max(0, Math.min(100, Math.round(sent / total * 100))) : 0;
            const status = String(campaign.status || 'draft').toLowerCase();
            const monitorable = ['running', 'paused', 'completed'].includes(status);
            const canDelete = status === 'draft' && !sent;
            return (
              <div key={campaign.id} className="ecm-list-row">
                <div className="ecm-row-primary">
                  <div className="ecm-row-title">
                    <strong>{campaign.name || 'Untitled campaign'}</strong>
                    <span className={'ecm-status ecm-status-' + status}>{status}</span>
                  </div>
                  <div className="ecm-row-meta">
                    {campaign.templateName || 'No email template selected'}
                    {campaign.listName ? ' · ' + campaign.listName : ''}
                  </div>
                  <div className="ecm-row-sub">
                    {Number(campaign.importedCount || 0).toLocaleString()} imported · {Number(campaign.eligibleCount || 0).toLocaleString()} eligible
                    {Number(campaign.excludedCount || 0) ? ' · ' + Number(campaign.excludedCount).toLocaleString() + ' excluded' : ''}
                    {Number(campaign.failedCount || 0) ? ' · ' + Number(campaign.failedCount).toLocaleString() + ' failed' : ''}
                    {' · Created ' + when(campaign.created_date)}
                  </div>
                </div>
                <div className="ecm-row-progress">
                  <div className="ecm-progress-summary"><span>Send progress</span><strong>{pct}%</strong></div>
                  <div className="ecm-progress-track" role="progressbar" aria-label={(campaign.name || 'Campaign') + ' progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                    <div className="ecm-progress-fill" style={{width: pct + '%'}} />
                  </div>
                  <div className="ecm-progress-note">{sent.toLocaleString()} / {total.toLocaleString()} recipients</div>
                </div>
                <div className="ecm-row-actions">
                  <button type="button" className="ecm-row-button" onClick={() => onOpen(campaign)}>
                    {monitorable ? <BarChart3 size={13} /> : <FilePenLine size={13} />}
                    {monitorable ? 'View results' : 'Continue setup'}<ArrowUpRight size={12} />
                  </button>
                  {onEdit && ['completed', 'cancelled'].includes(status) && (
                    <button type="button" className="ecm-row-button secondary" onClick={() => onEdit(campaign)}><FilePenLine size={13} />Edit</button>
                  )}
                  {canDelete && (
                    <button type="button" className="ecm-row-button danger" title="Delete unsent draft" aria-label={'Delete draft ' + (campaign.name || 'Untitled campaign')} onClick={() => remove(campaign)} disabled={busyId === campaign.id}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
