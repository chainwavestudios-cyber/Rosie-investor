/**
 * LeadActivityTab.jsx — Notes & chronological activity history for a lead.
 * Shows manual notes, call logs, AI intent synopsis, status changes, and calendar events.
 * Includes a quick-add note input and a calendar event creator with Google Calendar link.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { setEventReminders } from '@/components/debt/ProfileTimerWatcher';

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
  const [calSaving, setCalSaving] = useState(false);

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

  // Pull upcoming Google Calendar events and log any that mention this lead but aren't tracked yet
  const syncGoogleEvents = useCallback(async () => {
    if (!lead.id) return;
    try {
      const [res, existing] = await Promise.all([
        base44.functions.invoke('googleCalendarSync', { action: 'syncEvents' }),
        base44.entities.DebtLeadActivity.filter({ leadId: lead.id }, '-created_date', 200),
      ]);
      const result = res?.data || res;
      const events = result?.events || [];
      const leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim().toLowerCase();
      if (!leadName) return;
      const loggedIds = new Set();
      (existing || []).forEach(a => {
        if (a.activityType === 'calendar_event') {
          try { const m = JSON.parse(a.metadataJson || '{}'); if (m.eventId) loggedIds.add(m.eventId); } catch {}
        }
      });
      const toCreate = [];
      for (const ev of events) {
        if (loggedIds.has(ev.id)) continue;
        const summary = (ev.summary || '').toLowerCase();
        if (!summary.includes(leadName)) continue;
        const startISO = ev.start?.dateTime || ev.start?.date;
        if (!startISO) continue;
        toCreate.push({
          leadId: lead.id,
          leadName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
          activityType: 'calendar_event',
          activityText: `📅 ${ev.summary || 'Event'} — ${new Date(startISO).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
          createdBy: 'google_sync',
          metadataJson: JSON.stringify({ eventId: ev.id, htmlLink: ev.htmlLink, synced: true, date: startISO }),
        });
      }
      if (toCreate.length > 0) {
        await base44.entities.DebtLeadActivity.bulkCreate(toCreate);
        loadActivities();
      }
    } catch {}
  }, [lead, loadActivities]);

  useEffect(() => { syncGoogleEvents(); }, [syncGoogleEvents]);

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

  const createCalendarEvent = async () => {
    if (!calEvent.title.trim() || !calEvent.date || !lead.id) return;
    setCalSaving(true);
    try {
      const startDt = new Date(`${calEvent.date}T${calEvent.time || '09:00'}:00`);
      const endDt = new Date(startDt);
      endDt.setMinutes(endDt.getMinutes() + (calEvent.duration || 30));
      const eventTitle = `${calEvent.title} — ${lead.firstName} ${lead.lastName}`;
      const desc = `${calEvent.description || ''}\n\nLead: ${lead.firstName} ${lead.lastName}\nPhone: ${lead.phone || 'N/A'}\nDebt: ${lead.debtAmount ? '$' + lead.debtAmount.toLocaleString() : 'N/A'}`;
      const res = await base44.functions.invoke('googleCalendarSync', {
        action: 'createEvent',
        title: eventTitle,
        startISO: startDt.toISOString(),
        endISO: endDt.toISOString(),
        description: desc,
      });
      const result = res?.data || res;
      if (result?.status !== 'success') {
        alert('Failed to create calendar event: ' + (result?.error || 'Unknown error'));
        setCalSaving(false);
        return;
      }
      await base44.entities.DebtLeadActivity.create({
        leadId: lead.id,
        leadName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
        activityType: 'calendar_event',
        activityText: `📅 ${calEvent.title} — ${calEvent.date} at ${calEvent.time} (${calEvent.duration}min)`,
        createdBy: coachUser?.username || '',
        metadataJson: JSON.stringify({ date: calEvent.date, time: calEvent.time, duration: calEvent.duration, eventId: result.eventId, htmlLink: result.htmlLink }),
      });
      // Auto-register 1-hour and 5-minute popup reminders
      setEventReminders(lead, startDt.toISOString(), calEvent.title);
      if (result.htmlLink) setCalendarLink(result.htmlLink);
      setCalEvent({ title: '', date: '', time: '09:00', duration: 30, description: '' });
      setShowCalendar(false);
      loadActivities();
    } catch (e) { alert('Failed to create calendar event: ' + (e?.message || String(e))); }
    setCalSaving(false);
  };

  return (
    <div>
      {/* Quick note input */}
      <div style={{ marginBottom: '16px' }}>
        <label style={ls}>Quick Note</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); } }} placeholder="Add a note about this lead…" style={{ ...inp, flex: 1 }} />
          <button onClick={addNote} disabled={saving || !noteText.trim() || !lead.id} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '0 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', opacity: saving || !noteText.trim() || !lead.id ? 0.5 : 1 }}>+ Add</button>
        </div>
      </div>

      {/* Calendar event creator */}
      <div style={{ marginBottom: '16px' }}>
        <button onClick={() => setShowCalendar(p => !p)} disabled={!lead.id} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '8px 14px', cursor: lead.id ? 'pointer' : 'not-allowed', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', opacity: lead.id ? 1 : 0.4 }}>
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
              <button onClick={createCalendarEvent} disabled={calSaving || !calEvent.title.trim() || !calEvent.date || !lead.id} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: calSaving || !calEvent.title.trim() || !calEvent.date || !lead.id ? 0.5 : 1 }}>{calSaving ? '⏳ Creating…' : '📅 Create Event'}</button>
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
          <div style={{ color: '#4a5568', textAlign: 'center', padding: '20px', fontSize: '12px' }}>{lead.id ? 'No activity yet. Add a note or schedule an event above.' : 'Save the lead to start logging activity, calls, and AI synopsis.'}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activities.map(a => {
              const cfg = ACTIVITY_CONFIG[a.activityType] || ACTIVITY_CONFIG.note;
              let meta = null;
              try { meta = a.metadataJson ? JSON.parse(a.metadataJson) : null; } catch {}
              return (
                <div key={a.id} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${cfg.color}22`, borderLeft: `3px solid ${cfg.color}`, borderRadius: '3px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', flexShrink: 0 }}>{cfg.icon}</span>
                  <span style={{ color: cfg.color, fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', flexShrink: 0, minWidth: '52px' }}>{cfg.label}</span>
                  <span style={{ color: '#c4cdd8', fontSize: '11px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.activityText}</span>
                  {meta?.htmlLink && a.activityType === 'calendar_event' && (
                    <a href={meta.htmlLink} target="_blank" rel="noreferrer" style={{ color: BLUE, fontSize: '10px', textDecoration: 'underline', flexShrink: 0 }}>↗</a>
                  )}
                  <span style={{ color: '#4a5568', fontSize: '9px', flexShrink: 0 }}>{formatTimeAgo(a.created_date)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}