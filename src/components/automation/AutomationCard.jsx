/**
 * AutomationCard.jsx — one automation in plain English: what starts it, what it
 * then does, how often, and the screen it is changed on.
 */
import { C, chip } from '@/components/superadmin/kit';

const line = { display: 'flex', gap: '7px', marginTop: '5px', fontSize: '11px', lineHeight: '1.55' };
const tag = { color: C.dim, fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', minWidth: '36px', paddingTop: '2px' };

export default function AutomationCard({ automation, children }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '11px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ color: C.ink, fontSize: '13px', fontWeight: 'bold', flex: 1 }}>{automation.name}</span>
        <span style={chip(C.purple)}>{automation.cadence}</span>
      </div>
      <div style={line}><span style={tag}>WHEN</span><span style={{ color: C.muted }}>{automation.when}</span></div>
      <div style={line}><span style={tag}>THEN</span><span style={{ color: C.ink }}>{automation.then}</span></div>
      <div style={{ ...line, fontSize: '10px' }}><span style={tag}>SET IN</span><span style={{ color: C.dim }}>{automation.where}</span></div>
      {children}
    </div>
  );
}