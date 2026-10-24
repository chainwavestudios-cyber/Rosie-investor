/**
 * AutomationControlRow.jsx — one automation with its live switch and its timing.
 *
 * Where the work happens in a function, the switch really stops it; where the rule
 * is decided by the engagement numbers, the row says which tab owns it instead of
 * offering a switch that would do nothing.
 */
import { C, chip } from '@/components/superadmin/kit';
import AutomationToggle from '@/components/automation/AutomationToggle';
import FieldNumber from '@/components/automation/FieldNumber';

const line = { display: 'flex', gap: '7px', marginTop: '5px', fontSize: '11px', lineHeight: '1.55' };
const tag = { color: C.dim, fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', minWidth: '36px', paddingTop: '2px' };

export default function AutomationControlRow({ automation, on, intervalMinutes, lastRunAt, onToggle, onInterval }) {
  const ran = lastRunAt ? new Date(lastRunAt).toLocaleString('en-US') : '';

  return (
    <div style={{ background: C.surface, border: `1px solid ${on ? C.border : `${C.warn}55`}`, borderRadius: '6px', padding: '11px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ color: C.ink, fontSize: '13px', fontWeight: 'bold', flex: 1 }}>{automation.name}</span>
        <span style={chip(C.purple)}>{automation.cadence}</span>
        {automation.gated ? (
          <AutomationToggle on={on} onChange={onToggle} />
        ) : (
          <span style={chip(C.dim)}>set on the Scoring rules tab</span>
        )}
      </div>

      <div style={line}><span style={tag}>WHEN</span><span style={{ color: C.muted }}>{automation.when}</span></div>
      <div style={line}><span style={tag}>THEN</span><span style={{ color: C.ink }}>{automation.then}</span></div>
      <div style={{ ...line, fontSize: '10px' }}>
        <span style={tag}>RUNS</span>
        <span style={{ color: C.dim }}>
          {automation.gated ? `${automation.enforcedBy}${ran ? ` · last ran ${ran}` : ' · no run recorded yet'}` : automation.where}
        </span>
      </div>

      {automation.warn && (
        <div style={{ color: C.warn, fontSize: '10px', marginTop: '7px' }}>⚠ {automation.warn}</div>
      )}

      {automation.gated && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: '9px', paddingTop: '9px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ width: '74px' }}>
            <FieldNumber value={intervalMinutes} onChange={onInterval} max={10080} />
          </div>
          <span style={{ color: C.ink, fontSize: '11px' }}>minutes between runs · 0 = every time its schedule fires</span>
        </div>
      )}

      {automation.gated && !on && (
        <div style={{ color: C.warn, fontSize: '10px', marginTop: '7px' }}>
          Stopped — this automation does not run anywhere while it is off.
        </div>
      )}
    </div>
  );
}