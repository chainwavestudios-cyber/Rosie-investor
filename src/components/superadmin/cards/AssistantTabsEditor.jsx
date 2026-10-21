/**
 * AssistantTabsEditor.jsx — add, edit or remove the extra script tabs that appear on
 * every calendar contact card the assistant opens. Stored as JSON on the shared
 * SuperAdminConfig record, so a save pushes to the assistant's screen live.
 */
import { C, lbl, inputStyle, emptyStyle, btn } from '@/components/superadmin/kit';
import { parseScriptTabRows } from '@/hooks/useSuperAdminConfig';

export default function AssistantTabsEditor({ value, onChange }) {
  const rows = parseScriptTabRows(value);
  const write = (next) => onChange(JSON.stringify(next));
  const setRow = (index, key, text) => write(rows.map((row, i) => (i === index ? { ...row, [key]: text } : row)));

  return (
    <div style={{ paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div style={{ color: C.muted, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>Extra assistant script tabs</div>
        <div style={{ flex: 1 }} />
        <button onClick={() => write([...rows, { label: '', script: '' }])} style={btn(C.fronter)}>+ Add script tab</button>
      </div>
      <div style={{ color: C.dim, fontSize: '10px', marginBottom: '10px' }}>
        Each tab appears on every contact card the assistant opens, right after the built-in tabs (Appointment, Rebook, 1-Hour Call, Call &amp; Transfer, Credentials, Notes). Scripts support {'{{firstname}}'}, {'{{Email}}'} and {'{{appointment}}'}. A row with no label or no script stays off the assistant's card.
      </div>
      {!rows.length && <div style={emptyStyle}>No extra tabs yet. Use “Add script tab” for anything new the assistant should read.</div>}
      {rows.map((row, index) => (
        <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) minmax(220px, 1fr) auto', gap: '8px', alignItems: 'start', marginBottom: '10px' }}>
          <div>
            <label style={lbl}>Tab label</label>
            <input value={row.label} onChange={(e) => setRow(index, 'label', e.target.value)} placeholder="e.g. Rebook Appointment" style={inputStyle} />
          </div>
          <div>
            <label style={lbl}>Script the assistant reads</label>
            <textarea value={row.script} onChange={(e) => setRow(index, 'script', e.target.value)} rows={4} placeholder="What the assistant says on this tab…" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </div>
          <button onClick={() => write(rows.filter((_, i) => i !== index))} style={{ ...btn(C.danger), marginTop: '17px' }}>Remove</button>
        </div>
      ))}
    </div>
  );
}