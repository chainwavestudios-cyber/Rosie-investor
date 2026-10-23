/**
 * EngagementMetricList.jsx — whoever is behind one engagement number.
 * Click a tile in the strip and this lists the people that number counted,
 * each name opening that person's contact card.
 */
import { C, chip, emptyStyle } from '@/components/superadmin/kit';
import { tierStyle } from '@/lib/engagementTiers';
import LeadNameButton from '@/components/engagement/LeadNameButton';

const links = (count) => `${count} link${count === 1 ? '' : 's'}`;

/** One line saying why this person is in this list. */
function detailFor(key, lead) {
  switch (key) {
    case 'welcomeViews': return 'Listened to the welcome message';
    case 'uniqueOpeners': return `Opened ${lead.opens || 0}×`;
    case 'uniqueClickers': return `Clicked ${links(lead.clicks || 0)}`;
    case 'qualifyVisits': return 'Visited the qualification page';
    case 'emailsSent': return `Emailed — opened ${lead.opens || 0}×, clicked ${links(lead.clicks || 0)}`;
    case 'hotLeads': return lead.action || 'On the hot list right now';
    case 'engagedLeads': return lead.action || 'Engaged with the outreach';
    default: return `Score ${lead.score || 0} · opened ${lead.opens || 0}× · clicked ${links(lead.clicks || 0)}`;
  }
}

function lastLabel(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function EngagementMetricList({ metric, system = 'coach', leads, ids, onOpenLead, onClose }) {
  const byId = new Map((leads || []).map((row) => [row.leadId || row.id, row]));
  const rows = (ids || []).map((id) => byId.get(id)).filter(Boolean);
  const word = system === 'coach' ? 'lead' : 'prospect';

  return (
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${metric.color}`, borderRadius: '6px', padding: '12px 14px', marginTop: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ color: metric.color, fontSize: '13px', fontWeight: 'bold' }}>
          {metric.label} — {rows.length} {rows.length === 1 ? word : `${word}s`}
        </div>
        <div style={{ flex: 1 }} />
        {onClose && (
          <button type="button" onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', color: C.muted, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>× Close</button>
        )}
      </div>

      <div style={{ maxHeight: '320px', overflowY: 'auto', marginTop: '10px' }}>
        {rows.length === 0 && <div style={emptyStyle}>Nobody in this number for the selected window.</div>}
        {rows.map((lead, index) => {
          const style = tierStyle(lead.tier);
          return (
            <div key={lead.id || lead.leadId} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: '6px', marginBottom: '6px' }}>
              <span style={{ color: C.dim, fontSize: '11px', fontWeight: 'bold', width: '20px', paddingTop: '2px' }}>{index + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '7px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <LeadNameButton lead={lead} onOpenLead={onOpenLead} />
                  <span style={chip(style.color)}>{style.icon} {style.label}</span>
                  {lead.onFile === false && <span style={chip(C.muted)}>🗑 no card on file</span>}
                </div>
                <div style={{ color: C.muted, fontSize: '11px', marginTop: '3px' }}>{detailFor(metric.key, lead)}</div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {lead.phone && <a href={`tel:${lead.phone}`} style={{ color: C.fronter, fontSize: '11px', textDecoration: 'none' }}>📞 {lead.phone}</a>}
                  {lead.email && <a href={`mailto:${lead.email}`} style={{ color: C.coach, fontSize: '11px', textDecoration: 'none' }}>✉️ {lead.email}</a>}
                </div>
              </div>
              <div style={{ color: C.dim, fontSize: '10px', textAlign: 'right', minWidth: '86px' }}>{lastLabel(lead.lastAt)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}