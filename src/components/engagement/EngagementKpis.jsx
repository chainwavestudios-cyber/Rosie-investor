/** EngagementKpis.jsx — the top strip of the Email Engagement page. */
import { C } from '@/components/superadmin/kit';

const TILES = [
  { key: 'emailsSent', label: 'Emails sent', color: C.muted },
  { key: 'leadsEngaged', label: 'Leads engaging', color: C.fronter },
  { key: 'uniqueOpeners', label: 'Leads who opened', color: C.fronter },
  { key: 'uniqueClickers', label: 'Leads who clicked', color: C.coach },
  { key: 'welcomeViews', label: 'Welcome messages', color: C.purple },
  { key: 'qualifyVisits', label: 'Qualification page', color: C.purple },
  { key: 'hotLeads', label: 'Hot leads', color: C.danger },
  { key: 'avgScore', label: 'Avg score', color: C.warn },
];

export default function EngagementKpis({ summary }) {
  if (!summary) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: '8px' }}>
      {TILES.map((tile) => (
        <div key={tile.key} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '9px 10px' }}>
          <div style={{ color: C.muted, fontSize: '9px', letterSpacing: '0.6px', textTransform: 'uppercase' }}>{tile.label}</div>
          <div style={{ color: tile.color, fontSize: '19px', fontWeight: 'bold', marginTop: '3px' }}>{summary[tile.key] ?? 0}</div>
        </div>
      ))}
    </div>
  );
}