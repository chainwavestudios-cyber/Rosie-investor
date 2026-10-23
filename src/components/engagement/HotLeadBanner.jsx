/**
 * HotLeadBanner.jsx — the realtime cue at the top of the engagement console:
 * who just crossed into hot, and which system they belong to. The cue is live only;
 * the permanent record underneath keeps everyone who has ever been here.
 */
import { C, chip } from '@/components/superadmin/kit';
import { tierStyle } from '@/lib/engagementTiers';
import LeadNameButton from '@/components/engagement/LeadNameButton';

export default function HotLeadBanner({ hot, leads, system, recorded = 0, onOpenLead, onViewRecord }) {
  // Only leads still on file can be called: stale tracker rows are not a cue.
  const rows = (hot || []).filter((row) => (leads || []).find((lead) => lead.leadId === row.leadId)?.onFile !== false);
  if (!rows.length && !recorded) return null;

  const tone = system === 'coach' ? C.danger : C.warn;
  const nameOf = (leadId) => (leads || []).find((lead) => lead.leadId === leadId) || {};
  const style = tierStyle('hot');

  return (
    <div style={{ background: `${tone}12`, border: `1px solid ${tone}55`, borderRadius: '6px', padding: '10px 12px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: tone, fontSize: '13px', fontWeight: 'bold' }}>
          {system === 'coach' ? '🚨 HOT LEADS — call now' : '⚡ Hot prospects — call now'}
        </span>
        {rows.length > 0 && <span style={chip(tone)}>{rows.length} right now</span>}
        {recorded > 0 && (
          <button
            onClick={onViewRecord}
            title="Open the permanent hot lead record"
            style={{ ...chip(C.muted), background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}
          >📌 {recorded} on the permanent record ↓</button>
        )}
      </div>

      {rows.length === 0 && (
        <div style={{ color: C.muted, fontSize: '11px', marginTop: '7px' }}>
          Nobody is hot this minute — everyone who has been is in the permanent record below.
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginTop: '8px' }}>
          {rows.map((row) => (
            <span
              key={row.leadId}
              title={(row.reasons || []).join('\n')}
              style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${style.color}44`, borderRadius: '4px', padding: '5px 9px', fontSize: '11px', color: C.ink }}
            >
              <strong>{style.icon} <LeadNameButton lead={nameOf(row.leadId) || { leadId: row.leadId, name: 'Lead' }} onOpenLead={onOpenLead} size="11px" /></strong>
              {nameOf(row.leadId)?.phone && (
                <a href={`tel:${nameOf(row.leadId).phone}`} style={{ color: C.fronter, fontSize: '10px', textDecoration: 'none', marginLeft: '6px' }}>📞 {nameOf(row.leadId).phone}</a>
              )}
              <span style={{ color: C.muted }}> · {row.score}</span>
              <span style={{ color: C.warn }}> · {row.action}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}