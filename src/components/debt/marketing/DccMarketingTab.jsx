/**
 * DccMarketingTab.jsx — the Debt Call Coach Marketing tab.
 *
 * The vault leads distributed to "Debt Call Coach Marketing" form one pool; a
 * campaign takes a slice of that pool and spreads one saved Debt Call Coach
 * email across a schedule (start, finish, daily window, frequency, batch size).
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import MarketingGroupRoster from './MarketingGroupRoster';
import MarketingCampaignBuilder from './MarketingCampaignBuilder';
import MarketingCampaignsList from './MarketingCampaignsList';

const GOLD = '#10b981';
const BLUE = '#60a5fa';

export default function DccMarketingTab({ username }) {
  const [group, setGroup] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [vaultPage, templatesRes, campaignsRes] = await Promise.all([
      base44.entities.LeadVaultEntry.filter({ destination: 'debt_marketing' }, { sort: '-distributedAt', limit: 500 }).catch(() => ({ items: [] })),
      base44.entities.DebtEmailTemplate.list('-created_date', 100).catch(() => []),
      base44.entities.DebtMarketingCampaign.list('-created_date', 50).catch(() => []),
    ]);
    setGroup(vaultPage?.items || vaultPage || []);
    setTemplates(Array.isArray(templatesRes) ? templatesRes : templatesRes?.items || []);
    setCampaigns(Array.isArray(campaignsRes) ? campaignsRes : campaignsRes?.items || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const available = group.filter((g) => !g.marketingCampaignId && g.email);
  const assigned = group.length - available.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <div style={{ color: GOLD, fontSize: '15px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>📣 Debt Call Coach Marketing</div>
        <div style={{ color: '#8a9ab8', fontSize: '12px', marginTop: '4px' }}>
          Vault leads assigned to the marketing group — they are kept out of the Mailjet opt-in list and never dialed by the fronter queue.
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Stat label="In the marketing group" value={group.length} color={BLUE} />
        <Stat label="Available to assign" value={available.length} color={GOLD} />
        <Stat label="Already in a campaign" value={assigned} color="#8a9ab8" />
      </div>

      <MarketingCampaignBuilder
        availableLeads={available}
        templates={templates}
        username={username}
        onCreated={load}
      />

      <MarketingCampaignsList campaigns={campaigns} onChanged={load} />

      <MarketingGroupRoster group={group} loading={loading} />
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '12px 16px', minWidth: '160px' }}>
      <div style={{ color, fontSize: '22px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#8a9ab8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>{label}</div>
    </div>
  );
}