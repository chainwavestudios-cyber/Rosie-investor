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

// Convert ISO to datetime-local input value (browser local time, which is ET for this admin)
function isoToInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

// Convert datetime-local input value back to ISO
function inputToIso(val) {
  if (!val) return null;
  return new Date(val).toISOString();
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

function archivedSessions(entry) {
  try { return JSON.parse(entry?.sessionsJson || '[]') || []; } catch { return []; }
}

function sumSessions(entry) {
  return archivedSessions(entry).reduce((s, x) => s + (x.totalSeconds || 0), 0);
}

// Grand total across all sessions (archived + active)
function grandTotal(entry, nowIso) {
  if (!entry) return 0;
  if (entry.clockOut) return entry.totalSeconds || 0; // already includes archived sessions
  if (entry.clockIn) return sumSessions(entry) + calcTotal(entry, nowIso);
  return 0;
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
      // Recalculate totalSeconds (archived sessions + active session)
      const tempEntry = { ...existing, ...updates };
      if (tempEntry.clockIn && tempEntry.clockOut) {
        updates.totalSeconds = sumSessions(tempEntry) + calcTotal(tempEntry, tempEntry.clockOut);
      } else if (tempEntry.clockIn) {
        updates.totalSeconds = 0; // active session — live calc takes over
      } else {
        updates.totalSeconds = 0;
      }

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
      if (existing?.id && existing.clockIn && existing.clockOut) {
        // Archive the completed session, then start a fresh one
        const sessions = [...archivedSessions(existing), { clockIn: existing.clockIn, clockOut: existing.clockOut, totalSeconds: calcTotal(existing, existing.clockOut) }];
        await base44.entities.FronterTimeEntry.update(existing.id, {
          sessionsJson: JSON.stringify(sessions),
          clockIn: nowIso, clockOut: null, lunchOut: null, lunchIn: null,
          amBreakOut: null, amBreakIn: null, pmBreakOut: null, pmBreakIn: null,
        });
      } else if (existing?.id) {
        await base44.entities.FronterTimeEntry.update(existing.id, {
          clockIn: nowIso, clockOut: null, lunchOut: null, lunchIn: null,
          amBreakOut: null, amBreakIn: null, pmBreakOut: null, pmBreakIn: null,
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

  // Delete a single punch field (e.g. just the clockOut, or just the clockIn)
  const deletePunch = async (username, field) => {
    const existing = entryByUser[username];
    if (!existing?.id || !existing[field]) return;
    if (!confirm(`Delete the ${PUNCH_FIELDS.find(f => f.key === field)?.label || field} punch for ${username}?`)) return;
    try {
      const updates = { [field]: null };
      const tempEntry = { ...existing, [field]: null };
      // Recompute totalSeconds based on remaining state
      if (tempEntry.clockIn && tempEntry.clockOut) {
        updates.totalSeconds = sumSessions(tempEntry) + calcTotal(tempEntry, tempEntry.clockOut);
      } else if (tempEntry.clockIn) {
        updates.totalSeconds = 0; // active session — live calc takes over
      } else {
        updates.totalSeconds = 0;
      }
      await base44.entities.FronterTimeEntry.update(existing.id, updates);
      await load();
    } catch (e) { alert('Delete failed: ' + (e?.message || String(e))); }
  };

  // Delete one archived session from sessionsJson
  const deleteSession = async (username, idx) => {
    const existing = entryByUser[username];
    if (!existing?.id) return;
    if (!confirm(`Delete prior session #${idx + 1} for ${username}?`)) return;
    try {
      const sessions = archivedSessions(existing);
      sessions.splice(idx, 1);
      const updates = { sessionsJson: JSON.stringify(sessions) };
      if (existing.clockOut) {
        const tempEntry = { ...existing, sessionsJson: JSON.stringify(sessions) };
        updates.totalSeconds = sumSessions(tempEntry) + calcTotal(tempEntry, existing.clockOut);
      } else {
        updates.totalSeconds = 0;
      }
      await base44.entities.FronterTimeEntry.update(existing.id, updates);
      await load();
    } catch (e) { alert('Delete failed: ' + (e?.message || String(e))); }
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
            const totalSeconds = grandTotal(entry, new Date().toISOString());
            const priorSessions = archivedSessions(entry);

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
                        {isToday && !isClockedIn && (
                          <button onClick={() => quickClockIn(f.username)} style={{ background: 'rgba(74,222,128,0.15)', color: GREEN, border: `1px solid ${GREEN}44`, borderRadius: '4px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>🕐 {isClockedOut ? 'Clock In Again' : 'Clock In Now'}</button>
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
                  <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {PUNCH_FIELDS.map(field => {
                      const val = entry?.[field.key];
                      return (
                        <div key={field.key} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '6px 10px', position: 'relative' }}>
                          <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>{field.label}</div>
                          <div style={{ color: val ? field.color : '#4a5568', fontSize: '12px', fontFamily: 'monospace', marginTop: '2px' }}>
                            {val ? new Date(val).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }) : '—'}
                          </div>
                          {val && (
                            <button onClick={() => deletePunch(f.username, field.key)} title={`Delete ${field.label}`} style={{ position: 'absolute', top: '4px', right: '4px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', padding: '0 3px', lineHeight: 1 }}>✕</button>
                          )}
                        </div>
                      );
                    })}
                    <div style={{ background: `${BLUE}10`, border: `1px solid ${BLUE}33`, borderRadius: '4px', padding: '6px 10px' }}>
                      <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Hours</div>
                      <div style={{ color: BLUE, fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', marginTop: '2px' }}>{fmtDur(totalSeconds)}</div>
                    </div>
                  </div>
                  {priorSessions.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ color: BLUE, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Prior Sessions ({priorSessions.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {priorSessions.map((s, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '4px', padding: '4px 10px' }}>
                            <span style={{ color: '#6b7280', fontSize: '10px', fontFamily: 'monospace' }}>#{idx + 1}</span>
                            <span style={{ color: GREEN, fontSize: '11px', fontFamily: 'monospace' }}>{new Date(s.clockIn).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })}</span>
                            <span style={{ color: '#6b7280', fontSize: '10px' }}>→</span>
                            <span style={{ color: RED, fontSize: '11px', fontFamily: 'monospace' }}>{new Date(s.clockOut).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })}</span>
                            <span style={{ color: BLUE, fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', marginLeft: 'auto' }}>{fmtDur(s.totalSeconds || 0)}</span>
                            <button onClick={() => deleteSession(f.username, idx)} title="Delete session" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', padding: '0 3px', lineHeight: 1 }}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </>
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