/**
 * LeadGenTab.jsx — Social media lead scraping & intent mining dashboard.
 * Scrapes Reddit for debt-distress posts, extracts debt amounts, matches
 * high-intress phrases, enriches identities, and pushes leads to campaigns.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import LeadCrossAIResults from '@/components/debt/LeadCrossAIResults';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const PLATFORM_COLORS = { reddit: '#ff4500', quora: '#b92b27', stackexchange: '#f48024', x_twitter: '#1d9bf0', facebook: '#1877f2', tiktok: '#000000', manual: '#6b7280' };
const PLATFORM_LABELS = { reddit: 'Reddit', quora: 'Quora', stackexchange: 'Stack Exchange', x_twitter: 'X/Twitter', facebook: 'Facebook', tiktok: 'TikTok', manual: 'Manual' };
const STATUS_COLORS = { raw: '#6b7280', enriching: AMBER, enriched: GOLD, assigned: AMBER, pushed: BLUE, rejected: RED, duplicate: '#4a5568' };
const DISTRESS_COLORS = { A_screwed_drowning: RED, B_emotional_panic: AMBER, C_multicard_interest: PURPLE, none: '#4a5568' };
const DISTRESS_LABELS = { A_screwed_drowning: 'A — Drowning', B_emotional_panic: 'B — Panic', C_multicard_interest: 'C — Overwhelm', none: 'None' };

export default function LeadGenTab() {
  const { user: coachUser } = useDebtCoachAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [pushing, setPushing] = useState(null);
  const [error, setError] = useState('');
  const [scrapeResult, setScrapeResult] = useState(null);
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDistress, setFilterDistress] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [assigningLeadId, setAssigningLeadId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [crossEnriching, setCrossEnriching] = useState(false);
  const [crossEnrichResult, setCrossEnrichResult] = useState(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.ScrapedLead.list('-created_date', 200);
      setLeads(all || []);
    } catch (e) { setError('Failed to load leads: ' + (e?.message || String(e))); }
    setLoading(false);
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // Load employees for assignment dropdown
  useEffect(() => {
    base44.entities.DebtCoachUser.list('-created_date', 200)
      .then(all => setEmployees((all || []).filter(u => u.isActive !== false)))
      .catch(() => {});
  }, []);

  const assignLead = async (leadId, username) => {
    try {
      await base44.entities.ScrapedLead.update(leadId, {
        assignedTo: username,
        assignedAt: new Date().toISOString(),
        assignedBy: coachUser?.username || '',
        status: 'assigned',
      });
      setAssigningLeadId(null);
      loadLeads();
    } catch (e) { setError('Assignment failed: ' + (e?.message || String(e))); }
  };

  const runScraper = async () => {
    setScraping(true); setError(''); setScrapeResult(null);
    try {
      const res = await base44.functions.invoke('scrapeSocialLeads', { action: 'scrape', platforms: ['reddit', 'quora', 'stackexchange', 'x_twitter', 'facebook'] });
      const data = res?.data || res;
      setScrapeResult(data);
      loadLeads();
    } catch (e) { setError('Scrape failed: ' + (e?.message || String(e))); }
    setScraping(false);
  };

  const enrichLead = async (leadId) => {
    setEnriching(true);
    try {
      await base44.functions.invoke('resolveLeadIdentity', { leadId });
      loadLeads();
    } catch (e) { setError('Enrichment failed: ' + (e?.message || String(e))); }
    setEnriching(false);
  };

  const enrichAll = async () => {
    setEnriching(true);
    try {
      await base44.functions.invoke('resolveLeadIdentity', { bulk: true });
      loadLeads();
    } catch (e) { setError('Bulk enrichment failed: ' + (e?.message || String(e))); }
    setEnriching(false);
  };

  const pushToCampaign = async (lead) => {
    setPushing(lead.id);
    try {
      // Generate a lead number
      const allLeads = await base44.entities.DebtLead.list('-created_date', 500);
      const maxNum = (allLeads || []).reduce((max, l) => {
        const n = parseInt((l.leadNumber || '').replace('#', ''), 10);
        return isNaN(n) ? max : Math.max(max, n);
      }, 0);
      const leadNumber = `#${String(maxNum + 1).padStart(5, '0')}`;

      // Create a DebtLead from the scraped lead
      const fullName = lead.resolvedFullName || lead.displayName || lead.userHandle;
      const nameParts = fullName.split(' ').filter(Boolean);
      const firstName = nameParts[0] || lead.userHandle;
      const lastName = nameParts.slice(1).join(' ') || 'Unknown';

      const notes = `SCRAPED LEAD — ${PLATFORM_LABELS[lead.platform] || lead.platform}\n` +
        `Handle: ${lead.userHandle}\n` +
        `Post URL: ${lead.postUrl}\n` +
        `Distress Tag: ${lead.distressTag || 'none'}\n` +
        `Extracted Debt: ${lead.debtAmountRaw || 'unknown'}\n` +
        `Confidence: ${lead.identityMatchConfidence || 0}%\n\n` +
        `Original Post:\n${lead.postText?.substring(0, 1000) || ''}`;

      const created = await base44.entities.DebtLead.create({
        firstName,
        lastName,
        phone: lead.resolvedPhone || '',
        email: lead.resolvedEmail || '',
        debtAmount: lead.extractedDebtAmount || null,
        status: 'new',
        callCount: 0,
        leadNumber,
        debtCoachOwner: coachUser?.username || null,
        notes,
      });

      // Mark scraped lead as pushed
      await base44.entities.ScrapedLead.update(lead.id, {
        status: 'pushed',
        pushedToCampaignAt: new Date().toISOString(),
        pushedBy: coachUser?.username || '',
        convertedDebtLeadId: created.id,
      });

      loadLeads();
    } catch (e) { setError('Push to campaign failed: ' + (e?.message || String(e))); }
    setPushing(null);
  };

  const runLeadCrossEnrich = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setCrossEnriching(true); setError(''); setCrossEnrichResult(null);
    try {
      const res = await base44.functions.invoke('leadCrossEnrich', { bulk: true, leadIds: ids });
      setCrossEnrichResult(res?.data || res);
      loadLeads();
    } catch (e) { setError('LeadCross AI enrichment failed: ' + (e?.message || String(e))); }
    setCrossEnriching(false);
  };

  const enrichSingleLeadCross = async (leadId) => {
    setCrossEnriching(true);
    try {
      await base44.functions.invoke('leadCrossEnrich', { leadId });
      loadLeads();
      // If the detail modal is open, refresh the selected lead
      if (selectedLead?.id === leadId) {
        const updated = await base44.entities.ScrapedLead.get(leadId);
        setSelectedLead(updated);
      }
    } catch (e) { setError('LeadCross AI enrichment failed: ' + (e?.message || String(e))); }
    setCrossEnriching(false);
  };

  const exportCSV = () => {
    const rows = filtered.map(l => {
      const emails = l.enrichedEmailsJson ? (() => { try { return JSON.parse(l.enrichedEmailsJson); } catch { return []; } })() : [];
      const phones = l.enrichedPhonesJson ? (() => { try { return JSON.parse(l.enrichedPhonesJson); } catch { return []; } })() : [];
      const bestEmail = emails.sort((a, b) => b.confidence - a.confidence)[0];
      const bestPhone = phones.sort((a, b) => b.confidence - a.confidence)[0];
      return {
        platform: l.platform,
        userHandle: l.userHandle,
        resolvedName: l.resolvedFullName || '',
        company: l.companyName || '',
        domain: l.companyDomain || '',
        jobTitle: l.jobTitle || '',
        location: l.location || '',
        debtAmount: l.extractedDebtAmount || '',
        distressCategory: l.distressCategory || '',
        postUrl: l.postUrl || '',
        postTitle: l.postTitle || '',
        postText: (l.postText || '').replace(/"/g, '""').replace(/\n/g, ' ').substring(0, 500),
        bestEmail: bestEmail?.email || '',
        emailConfidence: bestEmail?.confidence || '',
        emailSource: bestEmail?.sourceFound || '',
        bestPhone: bestPhone?.phone || '',
        phoneConfidence: bestPhone?.confidence || '',
        phoneSource: bestPhone?.source || '',
        leadCrossStatus: l.leadCrossStatus || 'pending',
      };
    });
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leadcross_ai_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map(l => l.id));
    });
  };

  const testMatch = async () => {
    if (!testText.trim()) return;
    try {
      const res = await base44.functions.invoke('scrapeSocialLeads', { action: 'test_match', text: testText });
      setTestResult(res?.data || res);
    } catch (e) { setError('Test failed: ' + (e?.message || String(e))); }
  };

  // Filter leads
  const filtered = leads.filter(l => {
    if (filterPlatform !== 'all' && l.platform !== filterPlatform) return false;
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    if (filterDistress !== 'all' && l.distressCategory !== filterDistress) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      const hay = `${l.userHandle} ${l.postTitle} ${l.postText} ${l.resolvedFullName}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  // Stats
  const stats = {
    total: leads.length,
    raw: leads.filter(l => l.status === 'raw').length,
    enriched: leads.filter(l => l.status === 'enriched').length,
    pushed: leads.filter(l => l.status === 'pushed').length,
    byPlatform: {
      reddit: leads.filter(l => l.platform === 'reddit').length,
      quora: leads.filter(l => l.platform === 'quora').length,
      stackexchange: leads.filter(l => l.platform === 'stackexchange').length,
      x_twitter: leads.filter(l => l.platform === 'x_twitter').length,
      facebook: leads.filter(l => l.platform === 'facebook').length,
      tiktok: leads.filter(l => l.platform === 'tiktok').length,
    },
    byDistress: {
      A_screwed_drowning: leads.filter(l => l.distressCategory === 'A_screwed_drowning').length,
      B_emotional_panic: leads.filter(l => l.distressCategory === 'B_emotional_panic').length,
      C_multicard_interest: leads.filter(l => l.distressCategory === 'C_multicard_interest').length,
    },
    highIntent: leads.filter(l => l.extractedDebtAmount >= 10000 || l.distressCategory !== 'none').length,
  };

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatCard label="Total Scraped" value={stats.total} color="#c4cdd8" />
        <StatCard label="High Intent" value={stats.highIntent} color={GOLD} />
        <StatCard label="Reddit" value={stats.byPlatform.reddit} color="#ff4500" />
        <StatCard label="Quora" value={stats.byPlatform.quora} color="#b92b27" />
        <StatCard label="Stack Exch" value={stats.byPlatform.stackexchange} color="#f48024" />
        <StatCard label="X + FB" value={stats.byPlatform.x_twitter + stats.byPlatform.facebook} color="#1d9bf0" />
      </div>

      {/* Distress category breakdown */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <DistressBadge category="A_screwed_drowning" count={stats.byDistress.A_screwed_drowning} />
        <DistressBadge category="B_emotional_panic" count={stats.byDistress.B_emotional_panic} />
        <DistressBadge category="C_multicard_interest" count={stats.byDistress.C_multicard_interest} />
      </div>

      {/* Controls bar */}
      <div style={{ marginBottom: '16px', padding: '14px 18px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={runScraper} disabled={scraping} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 24px', cursor: scraping ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: scraping ? 0.5 : 1 }}>
          {scraping ? '⏳ Scraping…' : '🔴 Run Scraper'}
        </button>
        <button onClick={enrichAll} disabled={enriching} style={{ background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '4px', padding: '10px 20px', cursor: enriching ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: enriching ? 0.5 : 1 }}>
          {enriching ? '⏳ Enriching…' : '🔍 Enrich All Raw'}
        </button>
        <button onClick={loadLeads} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '10px 16px', cursor: 'pointer', fontSize: '12px' }}>🔄 Refresh</button>

        <button onClick={runLeadCrossEnrich} disabled={crossEnriching || selectedIds.size === 0} style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: crossEnriching || selectedIds.size === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: crossEnriching || selectedIds.size === 0 ? 0.5 : 1 }}>
          {crossEnriching ? '⏳ Cross-AI…' : `🚀 LeadCross AI (${selectedIds.size})`}
        </button>
        <button onClick={exportCSV} disabled={filtered.length === 0} style={{ background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '4px', padding: '10px 16px', cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: filtered.length === 0 ? 0.5 : 1 }}>
          📥 Export CSV
        </button>

        <div style={{ flex: 1 }} />

        <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search posts, handles…" style={{ ...inp, maxWidth: '240px' }} />
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} style={{ ...inp, maxWidth: '140px', cursor: 'pointer' }}>
          <option value="all">All Platforms</option>
          <option value="reddit">Reddit</option>
          <option value="quora">Quora</option>
          <option value="stackexchange">Stack Exchange</option>
          <option value="x_twitter">X/Twitter</option>
          <option value="facebook">Facebook</option>
          <option value="tiktok">TikTok</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, maxWidth: '140px', cursor: 'pointer' }}>
          <option value="all">All Statuses</option>
          <option value="raw">Raw</option>
          <option value="enriching">Enriching</option>
          <option value="enriched">Enriched</option>
          <option value="assigned">Assigned</option>
          <option value="pushed">Pushed</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={filterDistress} onChange={e => setFilterDistress(e.target.value)} style={{ ...inp, maxWidth: '160px', cursor: 'pointer' }}>
          <option value="all">All Distress</option>
          <option value="A_screwed_drowning">A — Drowning</option>
          <option value="B_emotional_panic">B — Panic</option>
          <option value="C_multicard_interest">C — Overwhelm</option>
          <option value="none">None</option>
        </select>
      </div>

      {scrapeResult && (
        <div style={{ marginBottom: '12px', padding: '12px 16px', background: 'rgba(16,185,129,0.08)', border: `1px solid ${GOLD}44`, borderRadius: '4px', color: GOLD, fontSize: '12px' }}>
          ✅ Scrape complete: {scrapeResult.totalPostsScanned} posts scanned → {scrapeResult.totalMatched} matched → {scrapeResult.newLeadsCreated} new leads created ({scrapeResult.duplicatesSkipped} duplicates skipped)
          {scrapeResult.errors?.map((e, i) => <div key={i} style={{ color: AMBER, marginTop: '4px' }}>⚠ {e}</div>)}
        </div>
      )}

      {crossEnrichResult && (
        <div style={{ marginBottom: '12px', padding: '12px 16px', background: 'rgba(167,139,250,0.08)', border: `1px solid #a78bfa44`, borderRadius: '4px', color: '#a78bfa', fontSize: '12px' }}>
          🚀 LeadCross AI complete: {crossEnrichResult.enriched} enriched, {crossEnrichResult.failed} failed out of {crossEnrichResult.processed} leads
        </div>
      )}

      {error && <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: RED, fontSize: '12px' }}>⚠ {error}</div>}

      {/* Lead table */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '10px 8px', textAlign: 'center', width: '32px' }}>
                  <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                </th>
                <th style={{ padding: '10px 4px', textAlign: 'center', width: '24px' }}></th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Platform</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>User Handle</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Post Snippet</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Debt Amt</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Distress Tag</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Identity</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: '#8a9ab8', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading scraped leads…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#4a5568' }}>No leads found. Run the scraper to start mining debt-distress posts.</td></tr>
              ) : filtered.map(lead => (
                <>
                <tr key={lead.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => toggleSelect(lead.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                    <button onClick={() => toggleRow(lead.id)} style={{ background: 'none', border: 'none', color: expandedRows.has(lead.id) ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '14px', padding: '0' }}>
                      {expandedRows.has(lead.id) ? '−' : '▶'}
                    </button>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '2px', background: `${PLATFORM_COLORS[lead.platform] || '#6b7280'}22`, color: PLATFORM_COLORS[lead.platform] || '#6b7280', fontSize: '10px', fontWeight: 'bold' }}>{PLATFORM_LABELS[lead.platform] || lead.platform}</span>
                    {lead.subreddit && <div style={{ color: '#4a5568', fontSize: '9px', marginTop: '2px' }}>{lead.subreddit}</div>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ color: '#e8e0d0', fontWeight: 'bold' }}>{lead.userHandle}</div>
                    {lead.resolvedFullName && lead.resolvedFullName !== lead.userHandle && <div style={{ color: GOLD, fontSize: '10px' }}>→ {lead.resolvedFullName}</div>}
                    {lead.location && <div style={{ color: '#4a5568', fontSize: '10px' }}>📍 {lead.location}</div>}
                  </td>
                  <td style={{ padding: '10px 12px', maxWidth: '300px' }}>
                    <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {lead.postTitle && <span style={{ fontWeight: 'bold' }}>{lead.postTitle} — </span>}{lead.postText?.substring(0, 200)}
                    </div>
                    {lead.postUrl && <a href={lead.postUrl} target="_blank" rel="noreferrer" style={{ color: BLUE, fontSize: '10px', textDecoration: 'underline' }}>View post ↗</a>}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    {lead.extractedDebtAmount ? (
                      <span style={{ color: GOLD, fontWeight: 'bold' }}>${lead.extractedDebtAmount.toLocaleString()}</span>
                    ) : <span style={{ color: '#4a5568' }}>—</span>}
                    {lead.debtAmountRaw && <div style={{ color: '#4a5568', fontSize: '9px' }}>"{lead.debtAmountRaw.substring(0, 20)}"</div>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {lead.distressCategory && lead.distressCategory !== 'none' ? (
                      <div>
                        <span style={{ padding: '2px 6px', borderRadius: '2px', background: `${DISTRESS_COLORS[lead.distressCategory]}22`, color: DISTRESS_COLORS[lead.distressCategory], fontSize: '9px', fontWeight: 'bold' }}>{DISTRESS_LABELS[lead.distressCategory]}</span>
                        <div style={{ color: '#8a9ab8', fontSize: '10px', marginTop: '2px' }}>"{lead.distressTag}"</div>
                      </div>
                    ) : <span style={{ color: '#4a5568', fontSize: '10px' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '2px', background: `${STATUS_COLORS[lead.status] || '#6b7280'}22`, color: STATUS_COLORS[lead.status] || '#6b7280', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>{lead.status}</span>
                    {lead.assignedTo && <div style={{ color: AMBER, fontSize: '10px', marginTop: '2px' }}>👤 {lead.assignedTo}</div>}
                    {lead.identityMatchConfidence != null && <div style={{ color: lead.identityMatchConfidence >= 70 ? GOLD : '#6b7280', fontSize: '10px', marginTop: '2px' }}>{lead.identityMatchConfidence}% conf</div>}
                  </td>
                  <td style={{ padding: '10px 12px', maxWidth: '180px' }}>
                    {lead.resolvedEmail && <div style={{ color: GOLD, fontSize: '10px' }}>✉ {lead.resolvedEmail}</div>}
                    {lead.resolvedPhone && <div style={{ color: GOLD, fontSize: '10px' }}>📞 {lead.resolvedPhone}</div>}
                    {!lead.resolvedEmail && !lead.resolvedPhone && <span style={{ color: '#4a5568', fontSize: '10px' }}>{lead.enrichmentStatus || 'pending'}</span>}
                    {lead.leadCrossStatus === 'enriched' && <span style={{ display: 'inline-block', marginTop: '2px', padding: '1px 6px', borderRadius: '2px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>Cross-AI ✓</span>}
                    {lead.leadCrossStatus === 'processing' && <span style={{ display: 'inline-block', marginTop: '2px', padding: '1px 6px', borderRadius: '2px', background: 'rgba(245,158,11,0.15)', color: AMBER, fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>Cross-AI ⏳</span>}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button onClick={() => setSelectedLead(lead)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', padding: '4px 8px', cursor: 'pointer', fontSize: '10px' }}>View</button>
                      <button onClick={() => enrichSingleLeadCross(lead.id)} disabled={crossEnriching} style={{ background: 'rgba(167,139,250,0.18)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.44)', borderRadius: '3px', padding: '4px 8px', cursor: 'pointer', fontSize: '10px', opacity: crossEnriching ? 0.5 : 1 }}>🚀 Cross-AI</button>
                      {lead.status === 'raw' && (
                        <button onClick={() => enrichLead(lead.id)} disabled={enriching} style={{ background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '3px', padding: '4px 8px', cursor: 'pointer', fontSize: '10px', opacity: enriching ? 0.5 : 1 }}>🔍 Enrich</button>
                      )}
                      {lead.status !== 'pushed' && (
                        <button onClick={() => pushToCampaign(lead)} disabled={pushing === lead.id} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', opacity: pushing === lead.id ? 0.5 : 1 }}>
                          {pushing === lead.id ? '⏳' : '→ Push'}
                        </button>
                      )}
                      {lead.status !== 'pushed' && (
                        <div style={{ position: 'relative' }}>
                          <button onClick={() => setAssigningLeadId(assigningLeadId === lead.id ? null : lead.id)} style={{ background: `${AMBER}18`, color: AMBER, border: `1px solid ${AMBER}44`, borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>👤 Assign</button>
                          {assigningLeadId === lead.id && (
                            <>
                              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setAssigningLeadId(null)} />
                            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', padding: '6px', zIndex: 100, minWidth: '180px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                              <div style={{ color: '#8a9ab8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', padding: '0 4px' }}>Assign to:</div>
                              {employees.length === 0 ? <div style={{ color: '#4a5568', fontSize: '11px', padding: '4px' }}>No employees found</div> : employees.map(emp => (
                                <button key={emp.id} onClick={() => assignLead(lead.id, emp.username)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: '#c4cdd8', padding: '6px 8px', cursor: 'pointer', fontSize: '11px', borderRadius: '3px' }} onMouseEnter={e => e.target.style.background = 'rgba(16,185,129,0.1)'} onMouseLeave={e => e.target.style.background = 'none'}>
                                  {emp.username} <span style={{ color: '#6b7280', fontSize: '9px' }}>({emp.role})</span>
                                </button>
                              ))}
                            </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedRows.has(lead.id) && (
                  <tr key={lead.id + '-expanded'} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td colSpan={10} style={{ padding: '0', background: 'rgba(0,0,0,0.2)' }}>
                      <div style={{ padding: '14px 20px' }}>
                        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>📝 Full Post Content</div>
                        {lead.postTitle && <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>{lead.postTitle}</div>}
                        <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif', maxHeight: '300px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '12px 16px' }}>
                          {lead.postText || 'No post content available.'}
                        </div>
                        {lead.postUrl && (
                          <a href={lead.postUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '8px', color: BLUE, fontSize: '11px', textDecoration: 'underline' }}>
                            🔗 View original post ↗
                          </a>
                        )}
                        {/* LeadCross AI inline summary */}
                        {lead.leadCrossStatus === 'enriched' && (
                          <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px' }}>
                            <span style={{ color: '#a78bfa', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }}>🚀 LeadCross AI: </span>
                            <span style={{ color: '#c4cdd8', fontSize: '11px' }}>
                              {lead.resolvedEmail && `✉ ${lead.resolvedEmail} · `}
                              {lead.resolvedPhone && `📞 ${lead.resolvedPhone} · `}
                              {lead.companyName && `🏢 ${lead.companyName} · `}
                              {lead.companyDomain && `🌐 ${lead.companyDomain}`}
                              {!lead.resolvedEmail && !lead.resolvedPhone && !lead.companyName && 'No contact info found — click View for details'}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regex tester */}
      <div style={{ marginTop: '16px', background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '16px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>🧪 Intent Matcher Tester</div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <textarea value={testText} onChange={e => setTestText(e.target.value)} placeholder="Paste a social media post to test debt amount extraction and distress matching…" rows={3} style={{ ...inp, resize: 'vertical', flex: 1 }} />
          <button onClick={testMatch} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '0 20px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Test Match</button>
        </div>
        {testResult && (
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '12px', fontSize: '12px' }}>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ color: '#8a9ab8' }}>Debt Amount: </span>
              {testResult.extractedAmount?.amount ? <span style={{ color: GOLD, fontWeight: 'bold' }}>${testResult.extractedAmount.amount.toLocaleString()}</span> : <span style={{ color: '#4a5568' }}>not found</span>}
              {testResult.extractedAmount?.raw && <span style={{ color: '#6b7280', marginLeft: '6px' }}>"{testResult.extractedAmount.raw}"</span>}
            </div>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ color: '#8a9ab8' }}>Distress: </span>
              {testResult.distress?.category !== 'none' ? (
                <span style={{ color: DISTRESS_COLORS[testResult.distress.category], fontWeight: 'bold' }}>{DISTRESS_LABELS[testResult.distress.category]} — "{testResult.distress.tag}"</span>
              ) : <span style={{ color: '#4a5568' }}>none</span>}
            </div>
            <div>
              <span style={{ color: '#8a9ab8' }}>High Intent: </span>
              <span style={{ color: testResult.isHighIntent ? GOLD : '#6b7280', fontWeight: 'bold' }}>{testResult.isHighIntent ? 'YES' : 'NO'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Lead detail modal */}
      {selectedLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setSelectedLead(null)}>
          <div style={{ background: '#0d1b2a', border: `1px solid ${GOLD}44`, borderRadius: '8px', maxWidth: '700px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ color: GOLD, fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase' }}>Scraped Lead Detail</div>
              <button onClick={() => setSelectedLead(null)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer' }}>✕</button>
            </div>
            <DetailRow label="Platform" value={`${PLATFORM_LABELS[selectedLead.platform] || selectedLead.platform} ${selectedLead.subreddit ? `(${selectedLead.subreddit})` : ''}`} />
            <DetailRow label="User Handle" value={selectedLead.userHandle} />
            <DetailRow label="Display Name" value={selectedLead.displayName || '—'} />
            <DetailRow label="Location" value={selectedLead.location || '—'} />
            <DetailRow label="Bio" value={selectedLead.bioText || '—'} />
            <DetailRow label="Post Title" value={selectedLead.postTitle || '—'} />
            <DetailRow label="Post URL" value={selectedLead.postUrl ? <a href={selectedLead.postUrl} target="_blank" rel="noreferrer" style={{ color: BLUE }}>{selectedLead.postUrl}</a> : '—'} />
            <div style={{ marginBottom: '12px' }}>
              <div style={{ ...ls }}>Full Post Text</div>
              <div style={{ color: '#c4cdd8', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '12px', maxHeight: '200px', overflowY: 'auto' }}>{selectedLead.postText}</div>
            </div>
            <DetailRow label="Extracted Debt Amount" value={selectedLead.extractedDebtAmount ? `$${selectedLead.extractedDebtAmount.toLocaleString()} ("${selectedLead.debtAmountRaw}")` : '—'} />
            <DetailRow label="Distress Category" value={selectedLead.distressCategory && selectedLead.distressCategory !== 'none' ? `${DISTRESS_LABELS[selectedLead.distressCategory]} — "${selectedLead.distressTag}"` : 'none'} />
            <DetailRow label="Matched Keywords" value={selectedLead.matchedKeywords || '—'} />
            <DetailRow label="Post Created At" value={selectedLead.postCreatedAt ? new Date(selectedLead.postCreatedAt).toLocaleString() : '—'} />
            <DetailRow label="Match Timestamp" value={selectedLead.matchTimestamp ? new Date(selectedLead.matchTimestamp).toLocaleString() : '—'} />
            <DetailRow label="Status" value={selectedLead.status} />
            <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '16px 0' }} />
            <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Identity Resolution</div>
            <DetailRow label="Resolved Full Name" value={selectedLead.resolvedFullName || '—'} />
            <DetailRow label="Resolved Email" value={selectedLead.resolvedEmail || '—'} />
            <DetailRow label="Resolved Phone" value={selectedLead.resolvedPhone || '—'} />
            <DetailRow label="Confidence Score" value={selectedLead.identityMatchConfidence != null ? `${selectedLead.identityMatchConfidence}%` : '—'} />
            <DetailRow label="Enrichment Status" value={selectedLead.enrichmentStatus || 'pending'} />
            <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '16px 0' }} />
            <div style={{ color: '#a78bfa', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>🚀 LeadCross AI Enrichment</div>
            <LeadCrossAIResults lead={selectedLead} onReenrich={() => enrichSingleLeadCross(selectedLead.id)} enriching={crossEnriching} />
            {selectedLead.profileDataJson && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ ...ls }}>Raw Profile Data</div>
                <div style={{ color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5, whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', padding: '10px', maxHeight: '150px', overflowY: 'auto' }}>
                  {(() => { try { return JSON.stringify(JSON.parse(selectedLead.profileDataJson), null, 2); } catch { return selectedLead.profileDataJson; } })()}
                </div>
              </div>
            )}
            {selectedLead.status !== 'pushed' && (
              <button onClick={() => { pushToCampaign(selectedLead); setSelectedLead(null); }} disabled={pushing === selectedLead.id} style={{ marginTop: '12px', background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '10px 24px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', width: '100%', opacity: pushing === selectedLead.id ? 0.5 : 1 }}>
                {pushing === selectedLead.id ? '⏳ Pushing…' : '→ Push Lead to Settlement IQ Campaign'}
              </button>
            )}
            {selectedLead.status === 'pushed' && (
              <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(96,165,250,0.1)', border: `1px solid ${BLUE}44`, borderRadius: '4px', color: BLUE, fontSize: '12px', textAlign: 'center' }}>
                ✅ Pushed to campaign by {selectedLead.pushedBy || 'unknown'} on {selectedLead.pushedToCampaignAt ? new Date(selectedLead.pushedToCampaignAt).toLocaleString() : '—'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '14px' }}>
      <div style={{ color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
      <div style={{ color, fontSize: '24px', fontWeight: 'bold' }}>{value}</div>
    </div>
  );
}

function DistressBadge({ category, count }) {
  return (
    <div style={{ padding: '8px 14px', background: `${DISTRESS_COLORS[category]}12`, border: `1px solid ${DISTRESS_COLORS[category]}33`, borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: DISTRESS_COLORS[category], fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>{DISTRESS_LABELS[category]}</span>
      <span style={{ color: DISTRESS_COLORS[category], fontSize: '16px', fontWeight: 'bold' }}>{count}</span>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', fontSize: '12px' }}>
      <span style={{ color: '#8a9ab8', minWidth: '140px', flexShrink: 0 }}>{label}:</span>
      <span style={{ color: '#c4cdd8', flex: 1 }}>{value}</span>
    </div>
  );
}