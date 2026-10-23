/** EngagementFeed.jsx — the live tail of tracked opens, clicks and qualification visits. */
import { C, ago } from '@/components/superadmin/kit';
import { CREDENTIAL_LINKS } from '@/lib/engagementTiers';
import LeadNameButton from '@/components/engagement/LeadNameButton';

const EVENT = {
  open: { icon: '👁', color: C.fronter, label: 'opened the email' },
  click: { icon: '🖱', color: C.coach, label: 'clicked' },
  qualify_visit: { icon: '🎥', color: C.purple, label: 'reached the qualification page' },
};

export default function EngagementFeed({ recent, onOpenLead }) {
  if (!recent?.length) {
    return <div style={{ color: C.dim, fontSize: '12px', padding: '16px 0', textAlign: 'center' }}>No tracked email events yet.</div>;
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '0 0 4px', borderBottom: `1px solid ${C.border}`, color: C.dim, fontSize: '9px', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
        <span style={{ width: '12px' }} />
        <span>Lead</span>
        <span style={{ flex: 1 }} />
        <span>Email</span>
        <span style={{ minWidth: '58px', textAlign: 'right' }}>When</span>
      </div>
      {recent.map((event) => {
        const look = EVENT[event.eventType] || EVENT.open;
        const link = CREDENTIAL_LINKS.find((item) => String(event.url || '').includes(item.match));
        return (
          <div key={event.id} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '12px' }}>{look.icon}</span>
            <LeadNameButton lead={{ ...event, name: event.leadName, onFile: event.onFile }} onOpenLead={onOpenLead} size="12px" />
            {event.phone && (
              <a href={`tel:${event.phone}`} style={{ color: C.fronter, fontSize: '11px', textDecoration: 'none', whiteSpace: 'nowrap' }}>📞 {event.phone}</a>
            )}
            <span style={{ color: look.color, fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {event.eventType === 'click' ? `${look.label} ${link ? link.label : 'the welcome message'}` : look.label}
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ color: C.dim, fontSize: '10px', whiteSpace: 'nowrap' }}>{event.templateName || ''}</span>
            <span style={{ color: C.dim, fontSize: '10px', whiteSpace: 'nowrap', minWidth: '58px', textAlign: 'right' }}>{ago(event.trackedAt)}</span>
          </div>
        );
      })}
    </div>
  );
}