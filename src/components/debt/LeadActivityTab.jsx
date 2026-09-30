/**
 * LeadActivityTab.jsx — Notes & chronological activity history for a lead.
 * Shows manual notes, call logs, AI intent synopsis, status changes, and calendar events.
 * Includes a quick-add note input and a calendar event creator with Google Calendar link.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';
const RED = '#ef4444';

const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

const ACTIVITY_CONFIG = {
  note: { icon: '📝', color: '#8a9ab8', label: 'Note' },
  call: { icon: '📞', color: BLUE, label: 'Call' },
  ai_synopsis: { icon: '🤖', color: PURPLE, label: 'AI Synopsis' },
  status_change: { icon: '🔄', color: AMBER, label: 'Status Change' },
  calendar_event: { icon: '📅', color: GOLD, label: 'Calendar Event' },
  lead_assigned: { icon: '🎯', color: GOLD, label: 'Lead Assigned' },
};

function formatTimeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatGoogleCalendarDate(dateStr, timeStr) {
  // Combine date + time, format as YYYYMMDDTHHMMSS
  const dt = new Date(`${dateStr}T${timeStr || '09:00'}:00`);
  return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export default function LeadActivityTab({ lead }) {
  const { user: coachUser } = useDebtCoachAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calEvent, setCalEvent] = useState({ title: '', date: '', time: '09:00', duration: 30, description: '' });
  const [calendarLink, setCalendarLink] = useState('');

  const loadActivities = useCallback(async () => {
    if (!lead.id) { setActivities([]); setLoading(false); return; }
    setLoading(true);
    try {
      const rows = await base44.entities.DebtLeadActivity.filter({ leadId: lead.id }, '-created_date', 200);
      setActivities(rows || []);
    } catch { setActivities([]); }
    setLoading(false);
  }, [lead.id]);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  // Realtime subscription
  useEffect(() => {
    if (!lead.id) return;
    const unsubscribe = base44.entities.DebtLeadActivity.subscribe((event) => {
      if (event.type === 'create') {
        loadActivities();
      }
    });
    return unsubscribe;
  }, [lead.id, loadActivities]);

  const addNote = async () => {
    if (!noteText.trim() || !lead.id) return;
    setSaving(true);
    try {
      await base44.entities.DebtLeadActivity.create({
        leadId: lead.id,
        leadName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
        activityType: 'note',
        activityText: noteText.trim(),
        createdBy: coachUser?.username || '',
      });
      setNoteText('');
      loadActivities();
    } catch (e) { alert('Failed to add note: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const createCalendarEvent = () => {
    if (!calEvent.title.trim() || !calEvent.date) return;
    const startStr = formatGoogleCalendarDate(calEvent.date, calEvent.time);
    const endDt = new Date(`${calEvent.date}T${calEvent.time || '09:00'}:00`);
    endDt.setMinutes(endDt.getMinutes() + (calEvent.duration || 30));
    const endStr = endDt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const title = encodeURIComponent(`${calEvent.title} — ${lead.firstName} ${lead.lastName}`);
    const details = encodeURIComponent(`${calEvent.description || ''}\n\nLead: ${lead.firstName} ${lead.lastName}\nPhone: ${lead.phone || 'N/A'}\nDebt: ${lead.debtAmount ? '$' + lead.debtAmount.toLocaleString() : 'N/A'}`);
    const link = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}`;

    setCalendarLink(link);

    // Save as activity
    base44.entities.DebtLeadActivity.create({
      leadId: lead.id,
      leadName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
      activityType: 'calendar_event',
      activityText: `📅 ${calEvent.title} — ${calEvent.date} at ${calEvent.time} (${calEvent.duration}min)`,
      createdBy: coachUser?.username || '',
      metadataJson: JSON.stringify({ date: calEvent.date, time: calEvent.time, duration: calEvent.duration, link }),
    }).then(() => loadActivities()).catch(() => {});
  };

  return (
    <div>
      {/* Quick note input */}
      <div style={{ marginBottom: '16px' }}>
        <label style={ls}>Quick Note</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); } }} placeholder="Add a note about this lead…" style={{ ...inp, flex: 1 }} />
          <button onClick={addNote} disabled={saving || !noteText.trim()} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '0 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', opacity: saving || !noteText.trim() ? 0.5 : 1 }}>+ Add</button>
        </div>
      </div>

      {/* Calendar event creator */}
      <div style={{ marginBottom: '16px' }}>
        <button onClick={() => setShowCalendar(p => !p)} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
          📅 Schedule Event
        </button>
        {showCalendar && (
          <div style={{ marginTop: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div style={{ gridColumn: '1 / -1' }}><label style={ls}>Event Title</label><input value={calEvent.title} onChange={e => setCalEvent(p => ({ ...p, title: e.target.value }))} placeholder="Follow-up call, Consultation…" style={inp} /></div>
              <div><label style={ls}>Date</label><input type="date" value={calEvent.date} onChange={e => setCalEvent(p => ({ ...p, date: e.target.value }))} style={inp} /></div>
              <div><label style={ls}>Time</label><input type="time" value={calEvent.time} onChange={e => setCalEvent(p => ({ ...p, time: e.target.value }))} style={inp} /></div>
              <div><label style={ls}>Duration (min)</label><input type="number" value={calEvent.duration} onChange={e => setCalEvent(p => ({ ...p, duration: Number(e.target.value) || 30 }))} style={inp} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={ls}>Description</label><textarea value={calEvent.description} onChange={e => setCalEvent(p => ({ ...p, description: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Agenda, notes…" /></div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={createCalendarEvent} disabled={!calEvent.title.trim() || !calEvent.date} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: !calEvent.title.trim() || !calEvent.date ? 0.5 : 1 }}>Create & Get Link</button>
              <button onClick={() => setShowCalendar(false)} style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
              {calendarLink && (
                <a href={calendarLink} target="_blank" rel="noreferrer" style={{ color: BLUE, fontSize: '11px', textDecoration: 'underline', marginLeft: 'auto' }}>🔗 Open in Google Calendar ↗</a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chronological activity history */}
      <div>
        <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>📋 Activity History</div>
        {loading ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px', fontSize: '12px' }}>Loading…</div>
        ) : activities.length === 0 ? (
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px', fontSize: '12px' }}>No activity yet. Add a note or schedule an event above.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activities.map(a => {
              const cfg = ACTIVITY_CONFIG[a.activityType] || ACTIVITY_CONFIG.note;
              let meta = null;
              try { meta = a.metadataJson ? JSON.parse(a.metadataJson) : null; } catch {}
              return (
                <div key={a.id} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${cfg.color}22`, borderLeft: `3px solid ${cfg.color}`, borderRadius: '4px', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px' }}>{cfg.icon}</span>
                      <span style={{ color: cfg.color, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{cfg.label}</span>
                      {a.createdBy && <span style={{ color: '#4a5568', fontSize: '10px' }}>· {a.createdBy}</span>}
                    </div>
                    <span style={{ color: '#4a5568', fontSize: '10px' }}>{formatTimeAgo(a.created_date)}</span>
                  </div>
                  <div style={{ color: '#c4cdd8', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{a.activityText}</div>
                  {meta?.link && a.activityType === 'calendar_event' && (
                    <a href={meta.link} target="_blank" rel="noreferrer" style={{ color: BLUE, fontSize: '11px', textDecoration: 'underline', marginTop: '6px', display: 'inline-block' }}>🔗 Open in Google Calendar ↗</a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}