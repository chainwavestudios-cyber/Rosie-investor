/**
 * HotLeadBanner.jsx — the realtime cue at the top of the engagement console:
 * who just crossed into hot, and which system they belong to.
 */
import { C, chip } from '@/components/superadmin/kit';
import { tierStyle } from '@/lib/engagementTiers';

export default function HotLeadBanner({ hot, leads, system }) {
  // Only leads still on file can be called: stale tracker rows are not a cue.
  const rows = (hot || []).filter((row) => (leads || []).find((lead) => lead.leadId === row.leadId)?.onFile !== false);
  if (!rows.length) return null;

  const tone = system === 'coach' ? C.danger : C.warn;
  const nameOf = (leadId) => (leads || []).find((lead) => lead.leadId === leadId)?.name || 'Lead';
  const style = tierStyle('hot');

  return (
    <div style={{ background: `${tone}12`, border: `1px solid ${tone}55`, borderRadius: '6px', padding: '10px 12px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: tone, fontSize: '13px', fontWeight: 'bold' }}>
          {system === 'coach' ? '🚨 HOT LEADS — call now' : '⚡ Hot prospects — call now'}
        </span>
        <span style={chip(tone)}>{rows.length} right now</span>
      </div>
      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginTop: '8px' }}>
        {rows.map((row) => (
          <span
            key={row.leadId}
            title={(row.reasons || []).join('\n')}
            style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${style.color}44`, borderRadius: '4px', padding: '5px 9px', fontSize: '11px', color: C.ink }}
          >
            <strong>{style.icon} {nameOf(row.leadId)}</strong>
            <span style={{ color: C.muted }}> · {row.score}</span>
            <span style={{ color: C.warn }}> · {row.action}</span>
          </span>
        ))}
      </div>
    </div>
  );
}