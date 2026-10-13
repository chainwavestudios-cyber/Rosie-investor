/**
 * FronterAdminHRTab.jsx — Admin HR management for fronter time cards.
 * Manually clock in/out fronters, edit punch times, and modify time entries
 * for any date. Auto-calculates total worked seconds (lunch + breaks excluded).
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const GREEN = '#4ade80';
const CYAN = '#22d3ee';
const PURPLE = '#a78bfa';
const RED = '#ef4444';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '5px 8px', color: '#e8e0d0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const PUNCH_FIELDS = [
  { key: 'clockIn', label: 'Clock In', color: GREEN },
  { key: 'lunchOut', label: 'Lunch Out', color: AMBER },
  { key: 'lunchIn', label: 'Lunch In', color: AMBER },
  { key: 'amBreakOut', label: 'AM Break Out', color: CYAN },
  { key: 'amBreakIn', label: 'AM Break In', color: CYAN },
  { key: 'pmBreakOut', label: 'PM Break Out', color: PURPLE },
  { key: 'pmBreakIn', label: 'PM Break In', color: PURPLE },
  { key: 'clockOut', label: 'Clock Out', color: RED },
];

function getETDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function fmtDur(s) {
  if (!s) return '0h 0m';
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

// Convert ISO string to a datetime-local input value in America/New_York
function isoToInput(iso) {
  if (!iso) return '';
  try {
    const parts = new Date(iso).toLocaleString('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    // en-CA gives "YYYY-MM-DD, HH:MM" — join with T
    return parts.replace(', ', 'T');
  } catch { return ''; }
}

// Convert a datetime-local input value (interpreted as ET) back to ISO
function inputToIso(val) {
  if (!val) return null;
  // val is "YYYY-MM-DDTHH:MM" in America/New_York local time.
  // Append the ET offset so Date parses it correctly.
  // Use a fixed -04:00 (EDT) / -05:00 (EST) — compute via Intl to be safe.
  const dt = new Date(val);
  // Use the formatter to get the offset at that time
  const offsetMs = new Date(val).getTimezoneOffset() * 60000;
  // datetime-local is interpreted as browser-local; we want it as ET wall-clock → ISO.
  // Simpler: treat the input as a wall-clock in ET by constructing the ISO with the
  // tz offset derived from the browser at that instant.
  return new Date(dt.getTime() - offsetMs + getEtOffsetMinutes(val) * 60000).toISOString();
}

function getEtOffsetMinutes(dateVal) {
  // Returns the America/New_York UTC offset in minutes for the given date
  const dt = new Date(dateVal);
  const etString = dt.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const etDate = new Date(etString);
  return Math.round((etDate - dt) / 60000);
}

// Subtract a break interval from total
function subtractBreak(total, outIso, inIso, nowIso) {
  if (!outIso) return total;
  const end = inIso ? new Date(inIso) : new Date(nowIso);
  const start = new Date(outIso);
  return total - (end - start) / 1000;
}

function calcTotal(entry, nowIso) {
  if (!entry?.clockIn) return 0;
  const end = entry.clockOut ? new Date(entry.clockOut) : new Date(nowIso);
  const start = new Date(entry.clockIn);
  let total = (end - start) / 1000;
  total = subtractBreak(total, entry.lunchOut, entry.lunchIn, nowIso);
  total = subtractBreak(total, entry.amBreakOut, entry.amBreakIn, nowIso);
  total = subtractBreak(total, entry.pmBreakOut, entry.pmBreakIn, nowIso);
  return Math.max(0, Math.floor(total));
}

export default function FronterAdminHRTab({ fronters }) {
  const [selectedDate, setSelectedDate] = useState(getETDate());
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({}); // { [username]: { ...fieldDrafts } }
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.FronterTimeEntry.filter({ date: selectedDate }, '-username', 200);
      setEntries(all || []);
    } catch {}
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);

  const entryByUser = {};
  (entries || []).forEach(e => { entryByUser[e.username] = e; });

  const startEdit = (username) => {
    const e = entryByUser[username] || {};
    const draft = {};
    PUNCH_FIELDS.forEach(f => { draft[f.key] = isoToInput(e[f.key]); });
    setEditing(prev => ({ ...prev, [username]: draft }));
  };

  const cancelEdit = (username) => {
    setEditing(prev => { const n = { ...prev }; delete n[username]; return n; });
  };

  const updateDraft = (username, field, val) => {
    setEditing(prev => ({ ...prev, [username]: { ...prev[username], [field]: val } }));
  };

  const saveEntry = async (username) => {
    const draft = editing[username];
    if (!draft) return;
    setSaving(prev => ({ ...prev, [username]: true }));
    try {
      const existing = entryByUser[username];
      const updates = {};
      PUNCH_FIELDS.forEach(f => {
        const val = draft[f.key];
        updates[f.key] = val ? inputToIso(val) : null;
      });
      // Recalculate totalSeconds
      const tempEntry = { ...existing, ...updates };
      updates.totalSeconds = updates.clockOut ? calcTotal(tempEntry, new Date().toISOString()) : (existing?.totalSeconds || 0);

      if (existing?.id) {
        await base44.entities.FronterTimeEntry.update(existing.id, updates);
      } else if (updates.clockIn) {
        await base44.entities.FronterTimeEntry.create({ username, date: selectedDate, ...updates });
      }
      setSaved(prev => ({ ...prev, [username]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [username]: false })), 2000);
      cancelEdit(username);
      await load();
    } catch (e) {
      alert('Save failed for ' + username + ': ' + (e?.message || String(e)));
    }
    setSaving(prev => ({ ...prev, [username]: false }));
  };

  // Quick action: clock in/out now for a fronter
  const quickClockIn = async (username) => {
    const existing = entryByUser[username];
    const nowIso = new Date().toISOString();
    try {
      if (existing?.id) {
        await base44.entities.FronterTimeEntry.update(existing.id, {
          clockIn: nowIso, clockOut: null, lunchOut: null, lunchIn: null,
          amBreakOut: null, amBreakIn: null, pmBreakOut: null, pmBreakIn: null, totalSeconds: 0,
        });
      } else {
        await base44.entities.FronterTimeEntry.create({ username, date: selectedDate, clockIn: nowIso });
      }
      await load();
    } catch (e) { alert('Clock in failed: ' + (e?.message || String(e))); }
  };

  const quickClockOut = async (username) => {
    const existing = entryByUser[username];
    if (!existing?.id || !existing.clockIn) { alert('Cannot clock out — not clocked in.'); return; }
    const nowIso = new Date().toISOString();
    const total = calcTotal(existing, nowIso);
    try {
      await base44.entities.FronterTimeEntry.update(existing.id, { clockOut: nowIso, totalSeconds: total });
      await load();
    } catch (e) { alert('Clock out failed: ' + (e?.message || String(e))); }
  };

  const clearEntry = async (username) => {
    const existing = entryByUser[username];
    if (!existing?.id) return;
    if (!confirm(`Clear the entire time entry for ${username} on ${selectedDate}?`)) return;
    try {
      await base44.entities.FronterTimeEntry.delete(existing.id);
      await load();
    } catch (e) { alert('Clear failed: ' + (e?.message || String(e))); }
  };

  const today = getETDate();
  const isToday = selectedDate === today;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>🕐 HR — Time Card Management</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ ...ls, marginBottom: 0 }}>Date</label>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ ...inp, width: 'auto', cursor: 'pointer' }} />
        </div>
      </div>

      <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '4px', padding: '10px 14px', marginBottom: '14px', color: '#8a9ab8', fontSize: '11px', lineHeight: 1.5 }}>
        Manually clock fronters in or out, or click <strong style={{ color: GOLD }}>Edit</strong> to modify any punch time for {selectedDate}. Total hours auto-calculate (lunch and breaks excluded).
      </div>

      {loading && <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px' }}>Loading…</div>}

      {!loading && fronters.length === 0 && (
        <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px', fontSize: '13px' }}>No fronter users found.</div>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {fronters.map(f => {
            const entry = entryByUser[f.username];
            const isClockedIn = !!entry?.clockIn && !entry?.clockOut;
            const isClockedOut = !!entry?.clockOut;
            const draft = editing[f.username];
            const isEditing = !!draft;
            const isSaving = saving[f.username];
            const justSaved = saved[f.username];
            const totalSeconds = entry?.clockOut ? (entry.totalSeconds || 0) : (entry?.clockIn ? calcTotal(entry, new Date().toISOString()) : 0);

            let statusColor = '#6b7280';
            let statusLabel = 'Not Clocked In';
            if (entry?.lunchOut && !entry?.lunchIn) { statusColor = AMBER; statusLabel = '🍽️ On Lunch'; }
            else if (entry?.amBreakOut && !entry?.amBreakIn) { statusColor = CYAN; statusLabel = '☕ AM Break'; }
            else if (entry?.pmBreakOut && !entry?.pmBreakIn) { statusColor = PURPLE; statusLabel = '☕ PM Break'; }
            else if (isClockedIn) { statusColor = GREEN; statusLabel = '🟢 Clocked In'; }
            else if (isClockedOut) { statusColor = '#6b7280'; statusLabel = '⏹ Clocked Out'; }

            return (
              <div key={f.id} style={{ background: '#0d1b2a', border: `1px solid ${isClockedIn ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '6px', padding: '14px 16px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, animation: isClockedIn ? 'pulse 1.5s infinite' : 'none' }} />
                    <span style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>{f.firstName || f.username} {f.lastName || ''}</span>
                    <span style={{ color: '#6b7280', fontSize: '11px' }}>@{f.username}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: 'bold', background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}44` }}>{statusLabel}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {justSaved && <span style={{ color: GREEN, fontSize: '11px', fontWeight: 'bold' }}>✓ Saved</span>}
                    {!isEditing ? (
                      <>
                        {isToday && !isClockedIn && !isClockedOut && (
                          <button onClick={() => quickClockIn(f.username)} style={{ background: 'rgba(74,222,128,0.15)', color: GREEN, border: `1px solid ${GREEN}44`, borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>🕐 Clock In Now</button>
                        )}
                        {isToday && isClockedIn && (
                          <button onClick={() => quickClockOut(f.username)} style={{ background: 'rgba(239,68,68,0.15)', color: RED, border: `1px solid ${RED}44`, borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>⏹ Clock Out Now</button>
                        )}
                        <button onClick={() => startEdit(f.username)} style={{ background: 'rgba(96,165,250,0.15)', color: BLUE, border: `1px solid ${BLUE}44`, borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✎ Edit</button>
                        {entry && <button onClick={() => clearEntry(f.username)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>Clear</button>}
                      </>
                    ) : (
                      <>
                        <button onClick={() => saveEntry(f.username)} disabled={isSaving} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '5px 14px', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: isSaving ? 0.5 : 1 }}>{isSaving ? '⏳…' : '💾 Save'}</button>
                        <button onClick={() => cancelEdit(f.username)} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
                      </>
                    )}
                  </div>
                </div>

                {/* Punch fields */}
                {!isEditing ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {PUNCH_FIELDS.map(field => {
                      const val = entry?.[field.key];
                      return (
                        <div key={field.key} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '6px 10px' }}>
                          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>{field.label}</div>
                          <div style={{ color: val ? field.color : '#4a5568', fontSize: '12px', fontFamily: 'monospace', marginTop: '2px' }}>
                            {val ? new Date(val).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }) : '—'}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ background: `${BLUE}10`, border: `1px solid ${BLUE}33`, borderRadius: '4px', padding: '6px 10px' }}>
                      <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Hours</div>
                      <div style={{ color: BLUE, fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', marginTop: '2px' }}>{fmtDur(totalSeconds)}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {PUNCH_FIELDS.map(field => (
                      <div key={field.key}>
                        <label style={ls}>{field.label}</label>
                        <input
                          type="datetime-local"
                          value={draft[field.key] || ''}
                          onChange={e => updateDraft(f.username, field.key, e.target.value)}
                          style={{ ...inp, colorScheme: 'dark' }}
                        />
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ background: `${BLUE}10`, border: `1px solid ${BLUE}33`, borderRadius: '4px', padding: '5px 10px', width: '100%' }}>
                        <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total (live)</div>
                        <div style={{ color: BLUE, fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold' }}>{fmtDur(totalSeconds)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}