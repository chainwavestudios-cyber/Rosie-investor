/**
 * RuleSaveBar.jsx — the save row the two rule screens share: writes the whole rule
 * set, and can put every number back to what the app shipped with.
 */
import { C, btn } from '@/components/superadmin/kit';

export default function RuleSaveBar({ onSave, onRestore, saving, note, updatedBy, updatedAt }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', position: 'sticky', bottom: 0, background: C.bg, borderTop: `1px solid ${C.border}`, padding: '10px 0', marginTop: '4px' }}>
      <button onClick={onSave} disabled={saving} style={{ ...btn(C.fronter), padding: '8px 16px', opacity: saving ? 0.6 : 1, cursor: saving ? 'default' : 'pointer' }}>
        {saving ? 'Saving…' : '💾 Save rules'}
      </button>
      {onRestore && <button onClick={onRestore} disabled={saving} style={btn(C.muted)}>↺ Restore built-in values</button>}
      <span style={{ color: note ? C.warn : C.muted, fontSize: '11px', flex: 1 }}>{note}</span>
      {updatedBy && <span style={{ color: C.dim, fontSize: '10px' }}>last saved by {updatedBy}{updatedAt ? ` · ${new Date(updatedAt).toLocaleString('en-US')}` : ''}</span>}
    </div>
  );
}