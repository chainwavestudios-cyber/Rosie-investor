/**
 * EngagedLeadList.jsx — the ranked follow-up list: the leads whose email
 * behaviour says they are worth a call right now, hottest first.
 */
import { useState } from 'react';
import { C, chip, emptyStyle } from '@/components/superadmin/kit';
import { tierStyle } from '@/lib/engagementTiers';
import LeadNameButton from '@/components/engagement/LeadNameButton';

const FILTERS = [
  { id: 'engaged+', label: '⚡ Engaged +', keep: (lead) => lead.tier === 'hot' || lead.tier === 'engaged' },
  { id: 'hot', label: '🔥 Hot only', keep: (lead) => lead.tier === 'hot' },
  { id: 'all', label: 'All activity', keep: () => true },
];

export default function EngagedLeadList({ leads, system = 'coach', onOpenLead }) {
  const [filter, setFilter] = useState('engaged+');
  const active = FILTERS.find((f) => f.id === filter) || FILTERS[0];
  const rows = (leads || []).filter(active.keep);

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {FILTERS.map((option) => (
          <button key={option.id} onClick={() => setFilter(option.id)} style={{
            background: filter === option.id ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
            color: filter === option.id ? C.fronter : C.muted,
            border: `1px solid ${filter === option.id ? `${C.fronter}55` : C.border}`,
            borderRadius: '4px', padding: '5px 11px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
          }}>{option.label}</button>
        ))}
        <span style={{ color: C.dim, fontSize: '11px', alignSelf: 'center' }}>{rows.length} of {(leads || []).length} scored leads</span>
      </div>

      {rows.length === 0 && <div style={emptyStyle}>Nothing in this band yet — activity appears here the moment an email is opened.</div>}

      {rows.map((lead, index) => {
        const style = tierStyle(lead.tier);
        return (
          <div key={lead.id || lead.leadId} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '9px 10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${index < 3 ? `${style.color}33` : C.border}`, borderRadius: '6px', marginBottom: '7px' }}>
            <span style={{ color: C.dim, fontSize: '11px', fontWeight: 'bold', width: '20px', paddingTop: '2px' }}>{index + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '7px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <LeadNameButton lead={lead} onOpenLead={onOpenLead} />
                <span style={chip(style.color)}>{style.icon} {style.label}</span>
                {lead.onFile === false && <span style={chip(C.muted)}>🗑 no card on file</span>}
                {lead.hotLead && <span style={chip(C.danger)}>🚨 {system === 'coach' ? 'HOT LEAD' : 'HOT PROSPECT'}</span>}
                {lead.assignedTo && <span style={chip(C.coach)}>◉ {lead.assignedTo}</span>}
                {lead.status && lead.status !== 'prospect' && <span style={chip(C.muted)}>{lead.status.replace('_', ' ')}</span>}
              </div>
              <div style={{ color: C.muted, fontSize: '11px', marginTop: '3px' }}>
                {(lead.reasons || []).join(' · ') || 'No tracked activity'}
              </div>
              <div style={{ color: C.warn, fontSize: '11px', marginTop: '3px' }}>➜ {lead.action}</div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                {lead.phone && <a href={`tel:${lead.phone}`} style={{ color: C.fronter, fontSize: '11px', textDecoration: 'none' }}>📞 {lead.phone}</a>}
                {lead.email && <a href={`mailto:${lead.email}`} style={{ color: C.coach, fontSize: '11px', textDecoration: 'none' }}>✉️ {lead.email}</a>}
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: '74px' }}>
              <div style={{ color: style.color, fontSize: '20px', fontWeight: 'bold', lineHeight: 1 }}>{lead.score}</div>
              <div style={{ height: '5px', width: '74px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden', marginTop: '5px' }}>
                <div style={{ height: '100%', width: `${Math.max(3, lead.score)}%`, background: style.color, borderRadius: '3px' }} />
              </div>
              <div style={{ color: C.dim, fontSize: '10px', marginTop: '4px' }}>{lead.lastAt ? new Date(lead.lastAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}