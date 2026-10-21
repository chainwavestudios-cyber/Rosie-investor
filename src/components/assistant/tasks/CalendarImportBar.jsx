/**
 * CalendarImportBar.jsx — The "Import Calendar Events" button in the tasks window.
 * Clicking it offers All / Missed / Completed; the chosen scope is pulled into the list.
 */
import { useState } from 'react';
import { GOLD, RED } from '@/components/assistant/tasks/taskMeta';
import { SCOPES, importCalendarEvents } from '@/components/assistant/tasks/importCalendarEvents';

export default function CalendarImportBar({ username, tasks, onImported }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const run = async (scope) => {
    setBusy(scope); setMsg(''); setError('');
    try {
      const res = await importCalendarEvents(scope, username, tasks);
      setMsg(res.imported
        ? `Imported ${res.imported} calendar event${res.imported === 1 ? '' : 's'}${res.skipped ? ` · ${res.skipped} already in your list` : ''}`
        : 'Nothing new — your list already covers those events.');
      onImported?.();
      setOpen(false);
    } catch (e) {
      setError('Import failed: ' + e.message);
    }
    setBusy('');
  };

  return <div>
    <button onClick={() => { setOpen(o => !o); setMsg(''); setError(''); }} style={{ background: 'rgba(255,255,255,0.05)', color: '#e8e0d0', border: `1px solid ${GOLD}55`, borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>⬇ Import Calendar Events</button>
    {open && <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${GOLD}44`, borderRadius: '6px', padding: '12px 14px', marginTop: '10px' }}>
      <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '8px' }}>Which calendar events should come into your list?</div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {SCOPES.map(s => <button key={s.id} disabled={!!busy} onClick={() => run(s.id)} style={{ background: busy === s.id ? `${GOLD}22` : 'rgba(255,255,255,0.06)', color: busy === s.id ? GOLD : '#e8e0d0', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '3px', padding: '7px 14px', cursor: busy ? 'wait' : 'pointer', fontSize: '11px', fontWeight: 'bold' }}>{busy === s.id ? 'Importing…' : s.label}</button>)}
      </div>
    </div>}
    {msg && <div style={{ color: GOLD, fontSize: '11px', marginTop: '6px' }}>{msg}</div>}
    {error && <div style={{ color: RED, fontSize: '11px', marginTop: '6px' }}>{error}</div>}
  </div>;
}