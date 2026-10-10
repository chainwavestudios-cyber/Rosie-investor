/**
 * FronterEmailTrackingNotifications.jsx — Global real-time popup notifications
 * for email opens and link clicks. Subscribes to EmailTrackingEvent creates,
 * waits 30 seconds (bot filter), then shows a toast notification.
 * Rendered once at the FronterPage level.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const BLUE = '#60a5fa';

const TRACKED_LINKS = [
  { match: 'trustpilot.com', label: 'Trustpilot Reviews' },
  { match: 'bbb.org', label: 'BBB Credentials' },
  { match: 'debtadvisorsofamerica.com', label: 'Our Website' },
];

function linkLabel(url) {
  const found = TRACKED_LINKS.find(t => url?.includes(t.match));
  return found ? found.label : 'a link';
}

export default function FronterEmailTrackingNotifications() {
  const [toasts, setToasts] = useState([]);
  const leadCache = useRef({});
  const timers = useRef({});

  // Look up a lead name by ID (cached)
  const getLeadName = async (leadId) => {
    if (leadCache.current[leadId]) return leadCache.current[leadId];
    try {
      const lead = await base44.entities.FronterLead.get(leadId);
      const name = lead ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() : 'Unknown';
      leadCache.current[leadId] = name;
      return name;
    } catch { return 'Unknown'; }
  };

  useEffect(() => {
    const unsub = base44.entities.EmailTrackingEvent.subscribe(async (event) => {
      if (event.type !== 'create' || !event.data?.leadId) return;
      const ev = event.data;
      const eventId = ev.id || `${ev.leadId}_${ev.trackedAt}_${ev.eventType}`;
      // Wait 30 seconds (bot filter) before showing the notification
      timers.current[eventId] = setTimeout(async () => {
        const leadName = await getLeadName(ev.leadId);
        const toast = {
          id: eventId,
          type: ev.eventType,
          leadName,
          url: ev.url,
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        };
        setToasts(prev => [...prev, toast]);
        // Auto-dismiss after 8 seconds
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== eventId));
        }, 8000);
      }, 30000);
    });
    return () => { try { unsub(); } catch {} Object.values(timers.current).forEach(t => clearTimeout(t)); };
  }, []);

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 10001, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '340px' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: '#0d1b2a',
          border: `2px solid ${t.type === 'open' ? GOLD : BLUE}`,
          borderRadius: '8px',
          padding: '12px 16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          animation: 'slideIn 0.3s ease-out',
        }}>
          <span style={{ fontSize: '24px', flexShrink: 0 }}>{t.type === 'open' ? '📧' : '🖱️'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: t.type === 'open' ? GOLD : BLUE, fontSize: '12px', fontWeight: 'bold' }}>
              {t.type === 'open' ? 'Email Opened!' : 'Link Clicked!'}
            </div>
            <div style={{ color: '#e8e0d0', fontSize: '13px', marginTop: '2px' }}>
              {t.leadName}
            </div>
            {t.type === 'click' && (
              <div style={{ color: '#8a9ab8', fontSize: '11px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                → {linkLabel(t.url)}
              </div>
            )}
            <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>{t.time}</div>
          </div>
          <button onClick={() => dismiss(t.id)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '16px', padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
      ))}
      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
}