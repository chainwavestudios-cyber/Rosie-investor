/**
 * EngagementKpis.jsx — the top strip of the Email Engagement console, per system.
 * Every tile is click-through: click a number and the people behind it are listed.
 */
import { C } from '@/components/superadmin/kit';

const TILES = {
  coach: [
    { key: 'emailsSent', label: 'Emails sent', color: C.muted },
    { key: 'leadsEngaged', label: 'Leads engaging', color: C.coach },
    { key: 'uniqueOpeners', label: 'Leads who opened', color: C.coach },
    { key: 'uniqueClickers', label: 'Leads who clicked', color: C.fronter },
    { key: 'welcomeViews', label: 'Welcome messages', color: C.purple },
    { key: 'qualifyVisits', label: 'Qualification page', color: C.purple },
    { key: 'hotLeads', label: '🔥 Hot leads', color: C.danger },
    { key: 'avgScore', label: 'Avg coach score', color: C.warn },
  ],
  fronter: [
    { key: 'emailsSent', label: 'Emails sent', color: C.muted },
    { key: 'leadsEngaged', label: 'Prospects engaging', color: C.fronter },
    { key: 'uniqueOpeners', label: 'Prospects who opened', color: C.fronter },
    { key: 'uniqueClickers', label: 'Prospects who clicked', color: C.coach },
    { key: 'hotLeads', label: '⚡ Hot prospects', color: C.warn },
    { key: 'engagedLeads', label: 'Engaged +', color: C.fronter },
    { key: 'qualifyVisits', label: 'Qualification page', color: C.purple },
    { key: 'avgScore', label: 'Avg fronter score', color: C.warn },
  ],
};

export default function EngagementKpis({ summary, system = 'coach', activeKey, onSelect }) {
  if (!summary) return null;
  const tiles = TILES[system] || TILES.coach;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: '8px' }}>
      {tiles.map((tile) => {
        const active = tile.key === activeKey;
        return (
          <button
            key={tile.key}
            type="button"
            onClick={() => onSelect?.(tile)}
            title={`Who is behind ${tile.label}`}
            style={{
              background: active ? `${tile.color}1f` : 'rgba(0,0,0,0.25)',
              border: `1px solid ${active ? `${tile.color}88` : C.border}`,
              borderRadius: '6px', padding: '9px 10px', textAlign: 'left', fontFamily: 'inherit',
              cursor: onSelect ? 'pointer' : 'default',
            }}
          >
            <div style={{ color: active ? tile.color : C.muted, fontSize: '9px', letterSpacing: '0.6px', textTransform: 'uppercase' }}>{tile.label}</div>
            <div style={{ color: tile.color, fontSize: '19px', fontWeight: 'bold', marginTop: '3px' }}>{summary[tile.key] ?? 0}</div>
          </button>
        );
      })}
    </div>
  );
}