/**
 * NewLeadsTab.jsx — Shows scraped leads assigned to the current user.
 * Users can import assigned leads to create client profiles they own.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const PLATFORM_COLORS = { reddit: '#ff4500', x_twitter: '#1d9bf0', facebook: '#1877f2', tiktok: '#000000', manual: '#6b7280' };
const PLATFORM_LABELS = { reddit: 'Reddit', x_twitter: 'X/Twitter', facebook: 'Facebook', tiktok: 'TikTok', manual: 'Manual' };
const DISTRESS_COLORS = { A_screwed_drowning: RED, B_emotional_panic: AMBER, C_multicard_interest: PURPLE, none: '#4a5568' };
const DISTRESS_LABELS = { A_screwed_drowning: 'A — Drowning', B_emotional_panic: 'B — Panic', C_multicard_interest: 'C — Overwhelm', none: 'None' };

export default function NewLeadsTab() {
  const { user: coachUser } = useDebtCoachAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(null);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');

  const loadLeads = useCallback(async () => {
    if (!coachUser?.username) return;
    setLoading(true);
    try {
      const all = await base44.entities.ScrapedLead.filter({ assignedTo: coachUser.username }, '-assignedAt', 100);
      // Only show leads that haven't been pushed/imported yet
      const pending = (all || []).filter(l => l.status === 'assigned' || l.status === 'enriched');
      setLeads(pending);
    } catch (e) { setError('Failed to load leads: ' + (e?.message || String(e))); }
    setLoading(false);
  }, [coachUser]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // Realtime subscription — refresh when new leads are assigned
  useEffect(() => {
    const unsubscribe = base44.entities.ScrapedLead.subscribe((event) => {
      if (event.type === 'update' || event.type === 'create') loadLeads();
    });
    return unsubscribe;
  }, [loadLeads]);

  const importLead = async (lead) => {
    setImporting(lead.id);
    try {
      // Generate lead number
      const allLeads = await base44.entities.DebtLead.list('-created_date', 500);
      const maxNum = (allLeads || []).reduce((max, l) => {
        const n = parseInt((l.leadNumber || '').replace('#', ''), 10);
        return isNaN(n) ? max : Math.max(max, n);
      }, 0);
      const leadNumber = `#${String(maxNum + 1).padStart(5, '0')}`;

      const fullName = lead.resolvedFullName || lead.displayName || lead.userHandle;
      const nameParts = fullName.split(' ').filter(Boolean);
      const firstName = nameParts[0] || lead.userHandle;
      const lastName = nameParts.slice(1).join(' ') || 'Unknown';

      const notes = `SCRAPED LEAD — ${PLATFORM_LABELS[lead.platform] || lead.platform}\n` +
        `Handle: ${lead.userHandle}\n` +
        `Post URL: ${lead.postUrl || 'N/A'}\n` +
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

      // Mark scraped lead as pushed/imported
      await base44.entities.ScrapedLead.update(lead.id, {
        status: 'pushed',
        pushedToCampaignAt: new Date().toISOString(),
        pushedBy: coachUser?.username || '',
        convertedDebtLeadId: created.id,
      });

      // Log activity
      await base44.entities.DebtLeadActivity.create({
        leadId: created.id,
        leadName: `${firstName} ${lastName}`.trim(),
        activityType: 'note',
        activityText: `Lead imported from ${PLATFORM_LABELS[lead.platform] || lead.platform} — assigned by ${lead.assignedBy || 'admin'}`,
        createdBy: coachUser?.username || '',
      });

      loadLeads();
    } catch (e) { setError('Import failed: ' + (e?.message || String(e))); }
    setImporting(null);
  };

  const filtered = leads.filter(l => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return `${l.userHandle} ${l.postTitle} ${l.postText} ${l.resolvedFullName}`.toLowerCase().includes(s);
  });

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: GOLD, fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase' }}>📥 New Leads Assigned to You</div>
          <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>{leads.length} lead{leads.length !== 1 ? 's' : ''} waiting to be imported</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search…" style={{ ...inp, maxWidth: '240px' }} />
          <button onClick={loadLeads} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '12px' }}>🔄 Refresh</button>
        </div>
      </div>

      {error && <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: RED, fontSize: '12px' }}>⚠ {error}</div>}

      {loading ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Loading your assigned leads…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '40px', textAlign: 'center' }}>
          <div style={{ color: '#4a5568', fontSize: '14px' }}>📭 No new leads assigned to you yet.</div>
          <div style={{ color: '#4a5568', fontSize: '12px', marginTop: '8px' }}>When an admin assigns you a scraped lead, it will appear here for you to import.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(lead => (
            <div key={lead.id} style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <span style={{ padding: '2px 8px', borderRadius: '2px', background: `${PLATFORM_COLORS[lead.platform] || '#6b7280'}22`, color: PLATFORM_COLORS[lead.platform] || '#6b7280', fontSize: '10px', fontWeight: 'bold' }}>{PLATFORM_LABELS[lead.platform] || lead.platform}</span>
                  <span style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginLeft: '8px' }}>{lead.resolvedFullName || lead.userHandle}</span>
                  {lead.assignedBy && <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '8px' }}>assigned by {lead.assignedBy}</span>}
                </div>
                {lead.distressCategory && lead.distressCategory !== 'none' && (
                  <span style={{ padding: '2px 8px', borderRadius: '2px', background: `${DISTRESS_COLORS[lead.distressCategory]}22`, color: DISTRESS_COLORS[lead.distressCategory], fontSize: '10px', fontWeight: 'bold' }}>{DISTRESS_LABELS[lead.distressCategory]}</span>
                )}
              </div>
              <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5, marginBottom: '10px', maxHeight: '60px', overflow: 'hidden' }}>
                {lead.postTitle && <span style={{ fontWeight: 'bold' }}>{lead.postTitle} — </span>}{lead.postText?.substring(0, 200)}
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {lead.extractedDebtAmount ? <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold' }}>${lead.extractedDebtAmount.toLocaleString()} debt</span> : null}
                {lead.resolvedPhone && <span style={{ color: GOLD, fontSize: '12px' }}>📞 {lead.resolvedPhone}</span>}
                {lead.resolvedEmail && <span style={{ color: GOLD, fontSize: '12px' }}>✉ {lead.resolvedEmail}</span>}
                {lead.location && <span style={{ color: '#6b7280', fontSize: '12px' }}>📍 {lead.location}</span>}
                <div style={{ flex: 1 }} />
                <button onClick={() => importLead(lead)} disabled={importing === lead.id} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 20px', cursor: importing === lead.id ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: importing === lead.id ? 0.5 : 1 }}>
                  {importing === lead.id ? '⏳ Importing…' : '📥 Import as Client'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}