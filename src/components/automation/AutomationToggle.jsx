/**
 * AutomationToggle.jsx — the on/off switch for one automation. Off means off
 * everywhere: the job itself checks this switch before it does any work.
 */
import { C } from '@/components/superadmin/kit';

export default function AutomationToggle({ on, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      title={on ? 'Switch this automation off' : 'Switch this automation on'}
      style={{
        background: on ? `${C.fronter}22` : 'rgba(255,255,255,0.05)',
        color: on ? C.fronter : C.dim,
        border: `1px solid ${on ? `${C.fronter}66` : C.border}`,
        borderRadius: '999px',
        padding: '4px 12px',
        cursor: 'pointer',
        fontSize: '10px',
        fontWeight: 'bold',
        letterSpacing: '0.6px',
        whiteSpace: 'nowrap',
      }}
    >
      {on ? '● ON' : '○ OFF'}
    </button>
  );
}