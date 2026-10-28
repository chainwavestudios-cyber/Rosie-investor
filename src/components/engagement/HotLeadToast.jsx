/**
 * HotLeadToast.jsx — the arrival alert. The moment a lead crosses into hot it lands here
 * (with a chime when sound is on) while the permanent record keeps it for good.
 */
import { useEffect, useRef } from 'react';
import { C, chip } from '@/components/superadmin/kit';
import { tierStyle } from '@/lib/engagementTiers';
import LeadNameButton from '@/components/engagement/LeadNameButton';
import { logNotification } from '@/lib/notifyCenter';

export default function HotLeadToast({ arrivals, system, soundOn, onOpenLead, onDismiss }) {
  const playedRef = useRef('');
  const key = (arrivals || []).map((row) => `${row.id}:${row.lastEnteredAt}`).join('|');

  // Silent by design — every arrival is recorded in the Notifications tab instead.
  useEffect(() => {
    if (!arrivals?.length || playedRef.current === key) return;
    playedRef.current = key;
    arrivals.forEach((row) => logNotification({
      title: system === 'coach' ? `Hot lead: ${row.name || 'Lead'}` : `Hot prospect: ${row.name || 'Prospect'}`,
      body: [row.phone && `📞 ${row.phone}`, row.action].filter(Boolean).join(' · '),
      type: 'hot_lead',
      source: system === 'coach' ? 'Debt Call Coach' : 'Fronter engagement',
      linkPath: system === 'coach' ? '/debt-call-coach' : '/fronter',
    }));
  }, [key, arrivals, system]);

  if (!arrivals?.length) return null;

  const tone = system === 'coach' ? C.danger : C.warn;
  const style = tierStyle('hot');

  return (
    <div style={{
      position: 'fixed', top: '16px', right: '16px', width: '348px', maxWidth: 'calc(100vw - 32px)',
      background: C.surface, border: `1px solid ${tone}77`, borderLeft: `4px solid ${tone}`, borderRadius: '7px',
      padding: '11px 13px', boxShadow: '0 16px 44px rgba(0,0,0,0.6)', zIndex: 14950,
    }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ color: tone, fontSize: '13px', fontWeight: 'bold' }}>{system === 'coach' ? '🚨 New hot lead' : '⚡ New hot prospect'}</span>
        <span style={chip(tone)}>{arrivals.length}</span>
        <span style={{ flex: 1 }} />
        <button onClick={onDismiss} title="Dismiss" style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>×</button>
      </div>

      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '260px', overflowY: 'auto' }}>
        {arrivals.map((row) => (
          <div key={row.id} style={{ background: 'rgba(0,0,0,0.28)', border: `1px solid ${C.border}`, borderRadius: '5px', padding: '7px 9px' }}>
            <div style={{ display: 'flex', gap: '7px', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <LeadNameButton lead={row} onOpenLead={onOpenLead} size="12px" />
              <span style={{ color: style.color, fontSize: '11px', fontWeight: 'bold' }}>{style.icon} {row.lastScore}</span>
              {row.phone
                ? <a href={`tel:${row.phone}`} style={{ color: C.fronter, fontSize: '11px', textDecoration: 'none', fontWeight: 'bold' }}>📞 {row.phone}</a>
                : <span style={{ color: C.dim, fontSize: '10px' }}>no phone on file</span>}
            </div>
            {row.action && <div style={{ color: C.warn, fontSize: '10px', marginTop: '3px' }}>➜ {row.action}</div>}
          </div>
        ))}
      </div>

      <div style={{ color: C.dim, fontSize: '10px', marginTop: '8px' }}>Saved to the hot lead record — nothing is lost when the live cue clears.</div>
    </div>
  );
}