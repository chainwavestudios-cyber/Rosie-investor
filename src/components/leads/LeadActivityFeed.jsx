import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

function fmt(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const EVENT_CONFIG = {
  note:          { icon: '📬', color: '#8a9ab8', label: 'note' },
  email_open:    { icon: '📬', color: '#4ade80', label: 'email open' },
  email_click:   { icon: '🔗', color: '#60a5fa', label: 'link clicked' },
  call:          { icon: '📞', color: GOLD,       label: 'call' },
  connected:     { icon: '🟢', color: '#4ade80', label: 'connected' },
  not_available: { icon: '📵', color: '#8a9ab8', label: 'not available' },
  prospect:      { icon: '🚀', color: '#a78bfa', label: 'prospect' },
  voicemail:     { icon: '📳', color: '#f59e0b', label: 'voicemail' },
  not_interested:{ icon: '❌', color: '#ef4444', label: 'not interested' },
  converted:     { icon: '✅', color: '#4ade80', label: 'converted' },
  status_change: { icon: '🔄', color: '#60a5fa', label: 'status change' },
};

export default function LeadActivityFeed({ onOpenLead, leads = [] }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadEvents(); }, []);

  const refresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      // Fetch history + leads + investors all in parallel
      const [history, allLeads, allInvestors] = await Promise.all([
        base44.entities.LeadHistory.list('-created_date', 150).catch(() => []),
        base44.entities.Lead.list('-updated_date', 10000).catch(() => []),
        base44.entities.InvestorUser.list('-updated_date', 2000).catch(() => []),
      ]);

      // Build lookup maps
      const leadsMap = {};
      leads.forEach(l => { leadsMap[l.id] = l; });
      allLeads.forEach(l => { leadsMap[l.id] = l; });

      const investorsMap = {};
      allInvestors.forEach(inv => { investorsMap[inv.id] = inv; });

      const evts = history.map(h => {
        const lead = leadsMap[h.leadId];
        const investor = !lead ? investorsMap[h.leadId] : null;
        const displayName = lead
          ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim()
          : investor
            ? investor.name
            : h.leadId; // fallback: show the ID so at least it's visible

        let type = h.type;
        if (h.content?.includes('Email opened') || h.content?.includes('email open')) type = 'email_open';
        if (h.content?.includes('link clicked') || h.content?.includes('Clicked')) type = 'email_click';

        return {
          type,
          leadId: h.leadId,
          leadName: displayName,
          leadPhone: lead?.phone || investor?.phone || '',
          time: h.created_date || h.createdAt,
          detail: h.content,
          raw: lead || investor || null,
        };
      });

      evts.sort((a, b) => new Date(b.time) - new Date(a.time));
      setEvents(evts.slice(0, 100));
    } catch (e) {
      console.error('[LeadActivityFeed]', e);
    }
    setLoading(false);
  };

  const important = ['email_open', 'email_click', 'connected', 'prospect', 'converted'];

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>⚡ Lead Activity Feed</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#6b7280', fontSize: '11px' }}>{events.filter(e => important.includes(e.type)).length} important events</span>
          <button onClick={refresh} disabled={refreshing} title="Refresh" style={{ background: 'none', border: 'none', color: refreshing ? '#6b7280' : GOLD, cursor: refreshing ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: refreshing ? 0.5 : 1 }}>🔄</button>
        </div>
      </div>

      {loading && <div style={{ color: '#6b7280', fontSize: '12px', padding: '16px', textAlign: 'center' }}>Loading…</div>}
      {!loading && events.length === 0 && (
        <div style={{ color: '#4a5568', fontSize: '11px', padding: '20px', textAlign: 'center' }}>No lead activity yet</div>
      )}

      {/* Important highlight strip */}
      {!loading && events.filter(e => important.includes(e.type)).length > 0 && (
        <div style={{ overflowX: 'auto', display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.15)' }}>
          {events.filter(e => important.includes(e.type)).slice(0, 10).map((evt, i) => {
            const ec = EVENT_CONFIG[evt.type] || { icon: '📌', color: GOLD, label: evt.type };
            return (
              <div key={i} onClick={() => evt.raw && onOpenLead(evt.raw)}
                style={{ padding: '8px 14px', borderRight: '1px solid rgba(255,255,255,0.05)', minWidth: '160px', flexShrink: 0, cursor: evt.raw ? 'pointer' : 'default', borderTop: `2px solid ${ec.color}44` }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '12px' }}>{ec.icon}</span>
                  <span style={{ color: ec.color, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{ec.label}</span>
                </div>
                <div style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.leadName}</div>
                <div style={{ color: '#6b7280', fontSize: '9px', marginTop: '1px' }}>{fmt(evt.time)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* All events list */}
      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
        {events.map((evt, i) => {
          const ec = EVENT_CONFIG[evt.type] || { icon: '📌', color: '#8a9ab8', label: evt.type };
          const isImportant = important.includes(evt.type);
          return (
            <div key={i}
              onClick={() => evt.raw && onOpenLead(evt.raw)}
              style={{ display: 'grid', gridTemplateColumns: '22px 1fr 80px', gap: '0 8px', alignItems: 'center', padding: '5px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', background: isImportant ? `${ec.color}08` : 'transparent', cursor: evt.raw ? 'pointer' : 'default' }}
              onMouseEnter={e => { if (evt.raw) e.currentTarget.style.background = isImportant ? `${ec.color}14` : 'rgba(255,255,255,0.02)'; }}
              onMouseLeave={e => e.currentTarget.style.background = isImportant ? `${ec.color}08` : 'transparent'}
            >
              <span style={{ fontSize: '11px', textAlign: 'center' }}>{ec.icon}</span>
              <div style={{ overflow: 'hidden', minWidth: 0 }}>
                <span style={{ color: isImportant ? '#e8e0d0' : '#c4cdd8', fontSize: '12px', fontWeight: isImportant ? 'bold' : 'normal', marginRight: '5px' }}>{evt.leadName}</span>
                <span style={{ color: ec.color, fontSize: '10px' }}>{ec.label}</span>
                {evt.detail && <span style={{ color: '#4a5568', fontSize: '10px', marginLeft: '5px' }}>· {evt.detail.slice(0, 70)}</span>}
              </div>
              <div style={{ color: '#6b7280', fontSize: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(evt.time)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}