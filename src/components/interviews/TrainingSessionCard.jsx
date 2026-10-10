/**
 * TrainingSessionCard.jsx — One training session card for the training scheduler.
 * Shows the session time, a searchable field to find fronters, a list of pending
 * attendees, and a submit button that creates/updates the Google Calendar event
 * and sends email reminders.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

export default function TrainingSessionCard({ sessionType, sessionName, sessionTime, accent, allFronters, existingAttendees, addedBy, onSubmitted }) {
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const searchResults = search.trim()
    ? allFronters
        .filter(f => {
          const name = `${f.firstName || ''} ${f.lastName || ''}`.toLowerCase();
          const username = (f.username || '').toLowerCase();
          const q = search.toLowerCase();
          return name.includes(q) || username.includes(q);
        })
        .filter(f => !pending.some(p => p.username === f.username))
        .filter(f => !existingAttendees.some(a => a.fronterUsername === f.username))
        .slice(0, 5)
    : [];

  const addToPending = (fronter) => {
    setPending(prev => [...prev, {
      username: fronter.username,
      name: `${fronter.firstName || ''} ${fronter.lastName || ''}`.trim(),
      email: fronter.email || '',
    }]);
    setSearch('');
  };

  const removeFromPending = (username) => {
    setPending(prev => prev.filter(p => p.username !== username));
  };

  const submit = async () => {
    if (pending.length === 0 || submitting) return;
    const validAttendees = pending.filter(a => a.email.trim());
    if (validAttendees.length === 0) {
      alert('All selected attendees need an email address to receive calendar invitations.');
      return;
    }
    setSubmitting(true);
    setStatus('');
    try {
      const res = await base44.functions.invoke('scheduleTraining', {
        sessionType,
        attendees: validAttendees,
        addedBy,
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      setStatus(`✅ ${validAttendees.length} attendee(s) added to "${sessionName}"! Calendar event updated and reminders sent.`);
      setPending([]);
      onSubmitted?.();
    } catch (e) {
      setStatus('❌ Failed: ' + (e?.message || String(e)));
    }
    setSubmitting(false);
  };

  return (
    <div style={{ background: '#0d1b2a', border: `1px solid ${accent}33`, borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Session header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: accent, color: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>{sessionType}</div>
        <div>
          <div style={{ color: '#e8e0d0', fontSize: '15px', fontWeight: 'bold' }}>{sessionName}</div>
          <div style={{ color: accent, fontSize: '12px' }}>🕐 {sessionTime}</div>
        </div>
      </div>

      {/* Already signed up */}
      {existingAttendees.length > 0 && (
        <div>
          <div style={{ ...ls, color: GOLD }}>✓ Already Added ({existingAttendees.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {existingAttendees.map((a, i) => (
              <span key={i} style={{ padding: '3px 10px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: GOLD, fontSize: '11px' }}>{a.fronterName}</span>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div>
        <label style={ls}>🔍 Search Fronter by Name</label>
        <input value={search} onChange={e => setSearch(e.target.value)} style={inp} placeholder="Type a name…" />
        {searchResults.length > 0 && (
          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {searchResults.map(f => (
              <button key={f.id} onClick={() => addToPending(f)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '7px 10px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#e8e0d0', fontSize: '12px' }}>{f.firstName} {f.lastName} <span style={{ color: '#6b7280', fontSize: '10px' }}>@{f.username}</span></span>
                <span style={{ color: accent, fontSize: '14px' }}>＋</span>
              </button>
            ))}
          </div>
        )}
        {search.trim() && searchResults.length === 0 && (
          <div style={{ color: '#4a5568', fontSize: '11px', marginTop: '4px' }}>No matching fronters found.</div>
        )}
      </div>

      {/* Pending list */}
      {pending.length > 0 && (
        <div>
          <div style={{ ...ls, color: BLUE }}>📋 To Be Added ({pending.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {pending.map(p => (
              <div key={p.username} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '4px' }}>
                <div>
                  <span style={{ color: '#e8e0d0', fontSize: '12px' }}>{p.name}</span>
                  <span style={{ color: '#6b7280', fontSize: '10px', marginLeft: '6px' }}>{p.email || '⚠️ no email'}</span>
                </div>
                <button onClick={() => removeFromPending(p.username)} style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: '14px' }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status */}
      {status && (
        <div style={{ color: status.startsWith('✅') ? GOLD : RED, fontSize: '12px', padding: '8px 10px', background: status.startsWith('✅') ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', borderRadius: '4px' }}>{status}</div>
      )}

      {/* Submit */}
      <button onClick={submit} disabled={pending.length === 0 || submitting}
        style={{
          background: pending.length === 0 || submitting ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${accent},#22c55e)`,
          color: pending.length === 0 || submitting ? '#4a5568' : DARK,
          border: 'none', borderRadius: '6px', padding: '10px 20px', cursor: pending.length === 0 || submitting ? 'not-allowed' : 'pointer',
          fontSize: '13px', fontWeight: 'bold', opacity: submitting ? 0.6 : 1,
        }}>
        {submitting ? '⏳ Scheduling…' : `📅 Submit & Add ${pending.length || ''} to Calendar`}
      </button>
    </div>
  );
}