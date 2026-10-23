/**
 * FieldNumber.jsx — one editable number in the rule set. A value moved off its
 * built-in default is flagged, so a custom rule is never mistaken for a stock one.
 */
import { C, inputStyle } from '@/components/superadmin/kit';

export default function FieldNumber({ label, value, onChange, min = 0, max = 999, step = 1, width, hint, changed }) {
  return (
    <label style={{ display: 'block' }} title={hint || ''}>
      {label && (
        <span style={{ display: 'block', color: changed ? C.warn : C.muted, fontSize: '9px', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '3px', whiteSpace: 'nowrap' }}>
          {label}{changed ? ' •' : ''}
        </span>
      )}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(Number.isFinite(next) ? next : 0);
        }}
        style={{
          ...inputStyle,
          width: width || '100%',
          borderColor: changed ? `${C.warn}66` : 'rgba(255,255,255,0.12)',
        }}
      />
    </label>
  );
}