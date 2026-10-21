/**
 * AssistantTabsEditor.jsx — add, edit or remove the extra tabs that appear on
 * every calendar contact card the assistant opens. Each tab carries the script the
 * assistant reads plus optional action buttons (call the client, merge & transfer).
 * Stored as JSON on the shared SuperAdminConfig record, so a save pushes live.
 */
import { C, lbl, inputStyle, emptyStyle, btn } from '@/components/superadmin/kit';
import { parseScriptTabRows } from '@/hooks/useSuperAdminConfig';

const ACTIONS = [
  ['callClient', '📞 Call client', C.coach, 'Dials the client on this tab with the assistant\'s assigned Twilio line.'],
  ['bookAppointment', '📅 Book appointment', C.coach, 'Opens the booking form for this client on the tab, so the assistant can book or rebook without switching tabs.'],
  ['credentials', '📧 Send credentials & welcome email', C.purple, 'Sends the “credentials” template, with the welcome message, to the client on this tab.'],
  ['followUpNote', '📝 Add follow-up note', C.warn, 'Lets the assistant write and save a calendar follow-up note on this tab.'],
  ['merge', '🔀 Merge & transfer', C.fronter, 'Adds a Merge & Transfer button that opens the popup with the numbers and script below. The transfer dials out on a free line that isn\'t assigned to anyone.'],
];

const newRow = () => ({ label: '', script: '', callClient: false, bookAppointment: false, credentials: false, followUpNote: false, merge: false });

export default function AssistantTabsEditor({ value, onChange }) {
  const rows = parseScriptTabRows(value);
  const write = (next) => onChange(JSON.stringify(next));
  const setRow = (index, key, text) => write(rows.map((row, i) => (i === index ? { ...row, [key]: text } : row)));
  const toggleRow = (index, key) => write(rows.map((row, i) => (i === index ? { ...row, [key]: !row[key] } : row)));

  return (
    <div style={{ paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div style={{ color: C.muted, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>Extra assistant script tabs</div>
        <div style={{ flex: 1 }} />
        <button onClick={() => write([...rows, newRow()])} style={btn(C.fronter)}>+ Add script tab</button>
      </div>
      <div style={{ color: C.dim, fontSize: '10px', marginBottom: '10px' }}>
        Each tab appears on every contact card the assistant opens, right after the built-in tabs (Appointment, Rebook, 1-Hour Call, Call &amp; Transfer, Credentials, Notes). Scripts support {'{{firstname}}'}, {'{{Email}}'} and {'{{appointment}}'}. Switch on any of the five action buttons to put them on the tab — they can be added to <b>any</b> tab, even one that already has that action on the built-in card, and any combination works on a single tab. The merge popup uses the merge / transfer numbers and the merge &amp; transfer script below. A row with no label, or with neither a script nor a button, stays off the assistant's card.
      </div>
      {!rows.length && <div style={emptyStyle}>No extra tabs yet. Use “Add script tab” for anything new the assistant should read or do.</div>}
      {rows.map((row, index) => (
        <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 240px) minmax(220px, 1fr) auto', gap: '8px', alignItems: 'start', marginBottom: '12px', padding: '10px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, borderRadius: '5px' }}>
          <div>
            <label style={lbl}>Tab label</label>
            <input value={row.label} onChange={(e) => setRow(index, 'label', e.target.value)} placeholder="e.g. Rebook Appointment" style={inputStyle} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
              {ACTIONS.map(([key, label, color, hint]) => (
                <button
                  key={key}
                  onClick={() => toggleRow(index, key)}
                  title={hint}
                  style={row[key]
                    ? { ...btn(color), background: `${color}33`, border: `1px solid ${color}` }
                    : { ...btn(C.muted), color: C.dim }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>Script the assistant reads {row.script ? '' : '(optional when a button is on)'}</label>
            <textarea value={row.script} onChange={(e) => setRow(index, 'script', e.target.value)} rows={4} placeholder="What the assistant says on this tab…" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </div>
          <button onClick={() => write(rows.filter((_, i) => i !== index))} style={{ ...btn(C.danger), marginTop: '17px' }}>Remove</button>
        </div>
      ))}
    </div>
  );
}