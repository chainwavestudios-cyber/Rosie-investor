
/**
 * Email Campaigns — the single campaign-management workspace in Debt Call Coach.
 * The previous Marketing tab is retired, but existing data is preserved.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Plus, RefreshCw, LayoutTemplate, Search, Send, Users, AlertTriangle, Layers3, CirclePlay, PauseCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import CampaignsList from './CampaignsList';
import CampaignWizard from './CampaignWizard';
import CampaignMonitor from './CampaignMonitor';
import TemplateLibrary from './TemplateLibrary';
import './EmailCampaignManager.css';

const filters = [
  { id: 'all', label: 'All campaigns' },
  { id: 'draft', label: 'Drafts' },
  { id: 'running', label: 'Running' },
  { id: 'paused', label: 'Paused' },
  { id: 'completed', label: 'Completed' },
];

function Metric({ Icon, label, value, note, tone = 'gold' }) {
  return (
    <div className={'ecm-metric ecm-metric-' + tone}>
      <div className="ecm-metric-label"><span>{label}</span><Icon size={15} strokeWidth={1.8} /></div>
      <strong>{Number(value || 0).toLocaleString()}</strong>
      <span className="ecm-metric-note">{note}</span>
    </div>
  );
}

export default function EmailCampaignManagerTab({ username }) {
  const [view, setView] = useState('list');
  const [campaignId, setCampaignId] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const page = await base44.entities.EmailCampaignJob.list('-created_date', 100);
      setCampaigns(Array.isArray(page) ? page : (page?.items || []));
      setError('');
    } catch (err) {
      setError(err?.message || 'Could not load campaigns. Try refreshing.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const backToList = useCallback(() => {
    setView('list');
    setCampaignId('');
    load();
  }, [load]);

  const startNew = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
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
      if (!created?.id) throw new Error('The new campaign was not returned.');
      setCampaignId(created.id);
      setView('wizard');
      load();
    } catch (err) {
      setError(err?.message || 'Could not create a campaign.');
    } finally {
      setBusy(false);
    }
  };

  const open = (campaign) => {
    setCampaignId(campaign.id);
    setView(['running', 'paused', 'completed'].includes(campaign.status) ? 'monitor' : 'wizard');
  };
  const openBuilder = (campaign) => {
    setCampaignId(campaign.id);
    setView('wizard');
  };

  const totals = useMemo(() => campaigns.reduce((acc, c) => ({
    sent: acc.sent + Number(c.sentCount || 0),
    eligible: acc.eligible + Number(c.eligibleCount || 0),
    failed: acc.failed + Number(c.failedCount || 0),
  }), { sent: 0, eligible: 0, failed: 0 }), [campaigns]);
  const running = campaigns.filter(c => c.status === 'running').length;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return campaigns.filter(c => {
      if (filter !== 'all' && c.status !== filter) return false;
      if (!query) return true;
      return [c.name, c.listName, c.templateName, c.status, c.createdBy]
        .some(value => String(value || '').toLowerCase().includes(query));
    });
  }, [campaigns, search, filter]);

  const filtersWithCount = filters.map(item => ({
    ...item,
    count: item.id === 'all' ? campaigns.length : campaigns.filter(c => c.status === item.id).length,
  }));

  if (view !== 'list') {
    return (
      <div className="ecm-root ecm-module">
        <div className="ecm-context">
          <button className="ecm-back" type="button" onClick={backToList}>Email Campaigns</button>
          <span>/</span><span>{view === 'wizard' ? 'Campaign builder' : view === 'monitor' ? 'Campaign results' : 'Template library'}</span>
        </div>
        {view === 'wizard' && campaignId && (
          <CampaignWizard campaignId={campaignId} username={username} onExit={backToList} onChanged={load} />
        )}
        {view === 'monitor' && campaignId && (
          <CampaignMonitor campaignId={campaignId} onBack={backToList} onChanged={load} />
        )}
        {view === 'templates' && <TemplateLibrary username={username} onBack={backToList} />}
      </div>
    );
  }

  return (
    <div className="ecm-root ecm-module">
      <header className="ecm-header">
        <div className="ecm-header-copy">
          <div className="ecm-eyebrow"><Mail size={13} /> Settlement IQ · Outreach workspace</div>
          <h2>Email Campaigns</h2>
          <p>Build, personalize, approve and track your Gmail campaigns from one place. Each recipient has an individual send and engagement record.</p>
        </div>
        <div className="ecm-header-actions">
          <button className="ecm-action ecm-action-secondary" type="button" onClick={load} disabled={refreshing} title="Refresh campaign metrics"><RefreshCw size={14} className={refreshing ? 'ecm-spinning' : ''} />Refresh</button>
          <button className="ecm-action ecm-action-secondary" type="button" onClick={() => setView('templates')}><LayoutTemplate size={14} />Template library</button>
          <button className="ecm-action ecm-action-primary" type="button" onClick={startNew} disabled={busy}><Plus size={15} />{busy ? 'Creating…' : 'New campaign'}</button>
        </div>
      </header>

      <div className="ecm-metrics" aria-label="Campaign summary">
        <Metric Icon={Layers3} label="Campaigns" value={campaigns.length} note="Most recent 100" />
        <Metric Icon={CirclePlay} label="Running" value={running} note="Active send queues" tone="green" />
        <Metric Icon={Users} label="Eligible recipients" value={totals.eligible} note="Across loaded campaigns" tone="blue" />
        <Metric Icon={Send} label="Emails sent" value={totals.sent} note="Recorded delivery attempts" tone="gold" />
        <Metric Icon={AlertTriangle} label="Failed" value={totals.failed} note="Review send errors" tone={totals.failed ? 'red' : 'muted'} />
      </div>

      <div className="ecm-toolbar">
        <label className="ecm-search">
          <Search size={15} />
          <input value={search} onChange={e => setSearch(e.target.value)} aria-label="Search campaigns" placeholder="Search campaign, list, template…" />
        </label>
        <div className="ecm-filters" role="group" aria-label="Campaign status filters">
          {filtersWithCount.map(item => (
            <button type="button" className="ecm-filter" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} key={item.id}>
              {item.label}<span>{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="ecm-error" role="alert"><AlertTriangle size={14} />{error}</div>}
      {loading ? (
        <div className="ecm-loading">Loading campaign history…</div>
      ) : (
        <CampaignsList campaigns={filtered} totalCount={campaigns.length} onOpen={open} onEdit={openBuilder} onChanged={load} />
      )}
      <p className="ecm-footnote"><PauseCircle size={12} /> Nothing sends when a campaign is created. The builder requires review and approval before launch. Summary counts reflect the 100 most recent campaigns.</p>
    </div>
  );
}
