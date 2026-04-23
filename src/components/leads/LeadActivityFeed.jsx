import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

function fmt(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return d.toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
}

const EVENT_CONFIG = {
  note:         { icon: '📬', color: '#4ade80',  label: 'Email Opened' },
  email_open:   { icon: '📬', color: '#4ade80',  label: 'Email Opened' },
  email_click:  { icon: '🔗', color: '#60a5fa',  label: 'Link Clicked' },
  call:         { icon: '📞', color: GOLD,        label: 'Call' },
  connected:    { icon: '🟢', color: '#4ade80',  label: 'Connected' },
  not_available:{ icon: '📵', color: '#8a9ab8',  label: 'Not Available' },
  prospect:     { icon: '🚀', color: '#a78bfa',  label: 'Marked Prospect' },
  voicemail:    { icon: '📳', color: '#f59e0b',  label: 'Voicemail' },
  not_interested:{ icon:'❌', color: '#ef4444',  label: 'Not Interested' },
  converted:    { icon: '✅', color: '#4ade80',  label: 'Converted' },
};

export default function LeadActivityFeed({ onOpenLead }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      // Get recent LeadHistory + recent EmailLog entries
      const [history, emailLogs] = await Promise.all([
        base44.entities.LeadHistory.list('-created_date', 100).catch(() => []),
        base44.entities.EmailLog.list('-sentAt', 100).catch(() => []),
      ]);

      // Get lead names in one batch
      const leadIds = [...new Set([
        ...history.map(h => h.leadId),
        ...emailLogs.map(e => e.leadId),
      ].filter(Boolean))];

      let leadsMap = {};
      if (leadIds.length > 0) {
        const allLeads = await base44.entities.Lead.list('-created_date', 2000);
        allLeads.forEach(l => { leadsMap[l.id] = l; });
      }

      const evts = [];

      // From LeadHistory
      history.forEach(h => {
        const lead = leadsMap[h.leadId];
        // Determine event type from content for email events
        let type = h.type;
        if (h.type === 'note' && h.content?.includes('Email opened')) type = 'email_open';
        if (h.type === 'note' && h.content?.includes('link clicked')) type = 'email_click';

        evts.push({
          type,
          leadId: h.leadId,
          leadName: lead ? `${lead.firstName} ${lead.lastName}` : h.leadId,
          leadPhone: lead?.phone,
          time: h.createdAt || h.created_date,
          detail: h.content,
          raw: lead,
        });
      });

      // From EmailLog — sent/opened/clicked
      emailLogs.forEach(log => {
        const lead = leadsMap[log.leadId];
        if (log.status === 'opened' && log.openedAt) {
          evts.push({
            type: 'email_open',
            leadId: log.leadId,
            leadName: lead ? `${lead.firstName} ${lead.lastName}` : log.toName || log.toEmail,
            leadPhone: lead?.phone,
            time: log.openedAt,
            detail: `Email opened`,
            raw: lead,
          });
        }
        if (log.status === 'clicked' && log.clickedAt) {
          evts.push({
            type: 'email_click',
            leadId: log.leadId,
            leadName: lead ? `${lead.firstName} ${lead.lastName}` : log.toName || log.toEmail,
            leadPhone: lead?.phone,
            time: log.clickedAt,
            detail: `Clicked: ${log.clickedUrl || 'link'}`,
            raw: lead,
          });
        }
      });

      // Deduplicate and sort
      evts.sort((a, b) => new Date(b.time) - new Date(a.time));
      setEvents(evts.slice(0, 80));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // Important action types to highlight
  const important = ['email_open', 'email_click', 'connected', 'prospect', 'converted'];

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '4px',
      overflow: 'hidden',
      marginBottom: '20px',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>⚡ Lead Activity Feed</span>
        <span style={{ color: '#6b7280', fontSize: '11px' }}>{events.filter(e => important.includes(e.type)).length} important events</span>
      </div>

      {loading && <div style={{ color: '#6b7280', fontSize: '12px', padding: '16px', textAlign: 'center' }}>Loading…</div>}
      {!loading && events.length === 0 && (
        <div style={{ color: '#4a5568', fontSize: '11px', padding: '20px', textAlign: 'center' }}>No lead activity yet</div>
      )}

      {/* Important events highlight strip */}
      {!loading && events.filter(e => important.includes(e.type)).length > 0 && (
        <div style={{ overflowX: 'auto', display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.15)' }}>
          {events.filter(e => important.includes(e.type)).slice(0, 10).map((evt, i) => {
            const ec = EVENT_CONFIG[evt.type] || { icon: '📌', color: GOLD, label: evt.type };
            return (
              <div key={i}
                onClick={() => evt.raw && onOpenLead(evt.raw)}
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
      <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
        {events.map((evt, i) => {
          const ec = EVENT_CONFIG[evt.type] || { icon: '📌', color: '#8a9ab8', label: evt.type };
          const isImportant = important.includes(evt.type);
          return (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr 180px 100px',
              gap: '0 10px',
              alignItems: 'center',
              padding: '6px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              background: isImportant ? `${ec.color}08` : 'transparent',
              cursor: evt.raw ? 'pointer' : 'default',
              transition: 'background 0.1s',
            }}
              onClick={() => evt.raw && onOpenLead(evt.raw)}
              onMouseEnter={e => { if (evt.raw) e.currentTarget.style.background = isImportant ? `${ec.color}12` : 'rgba(255,255,255,0.02)'; }}
              onMouseLeave={e => e.currentTarget.style.background = isImportant ? `${ec.color}08` : 'transparent'}
            >
              <span style={{ fontSize: '12px', textAlign: 'center' }}>{ec.icon}</span>
              <div style={{ overflow: 'hidden' }}>
                <span style={{ color: '#e8e0d0', fontSize: '12px', fontWeight: isImportant ? 'bold' : 'normal', marginRight: '6px' }}>{evt.leadName}</span>
                <span style={{ color: ec.color, fontSize: '10px' }}>{ec.label}</span>
                {evt.detail && <span style={{ color: '#4a5568', fontSize: '10px', marginLeft: '6px' }}>· {evt.detail.slice(0, 60)}</span>}
              </div>
              <div style={{ color: '#4a5568', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {evt.leadPhone || '—'}
              </div>
              <div style={{ color: '#6b7280', fontSize: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {fmt(evt.time)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}