/**
 * Next3HoursWindow.jsx — Live "next 3 hours" window for the Admin Assistant Command Center.
 * Buckets the next three hours into hour columns showing appointments, callbacks,
 * assistant tasks and Google Calendar events, so the assistant always sees what is
 * coming up. Anything due within 15 minutes pulses with a bright green LED border.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';
const LED = '#22c55e';

const HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = 3 * HOUR_MS;
const LED_MS = 15 * 60 * 1000;
const GRACE_MS = 5 * 60 * 1000; // keep an already-started item on the board briefly

const LEAD_FIELDS = ['firstName', 'lastName', 'phone', 'appointmentDate', 'appointmentTitle', 'callbackAt', 'status'];
const TASK_FIELDS = ['title', 'dueDate', 'priority', 'category', 'assignedTo'];

const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmtCountdown = (ms) => {
  const min = Math.round(ms / 60000);
  if (min <= 0) return 'now';
  if (min < 60) return `in ${min}m`;
  return `in ${Math.floor(min / 60)}h ${min % 60}m`;
};

export default function Next3HoursWindow() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const [apptPage, cbPage, taskPage] = await Promise.all([
        base44.entities.DebtLead.filter({ appointmentDate: { $ne: null } }, { limit: 200, fields: LEAD_FIELDS }),
        base44.entities.DebtLead.filter({ callbackAt: { $ne: null } }, { limit: 200, fields: LEAD_FIELDS }),
        // Closed-out tasks (done, rebooked, not interested, unavailable) stay off the board.
        base44.entities.AssistantTask.filter({ status: { $nin: ['done', 'rebooked', 'not_interested', 'unavailable'] } }, { limit: 200, fields: TASK_FIELDS }),
      ]);
      const byId = new Map();
      for (const l of (apptPage.items || apptPage || [])) byId.set(l.id, l);
      for (const l of (cbPage.items || cbPage || [])) byId.set(l.id, { ...(byId.get(l.id) || {}), ...l });

      const evs = [];
      for (const l of byId.values()) {
        const name = `${l.firstName || ''} ${l.lastName || ''}`.trim();
        if (l.appointmentDate) evs.push({ id: `${l.id}-appt`, kind: 'appointment', icon: '📅', label: l.appointmentTitle || 'Appointment', name, date: new Date(l.appointmentDate), color: GOLD });
        if (l.callbackAt) evs.push({ id: `${l.id}-cb`, kind: 'callback', icon: '📞', label: 'Callback', name, date: new Date(l.callbackAt), color: PURPLE });
      }
      for (const t of (taskPage.items || taskPage || [])) {
        if (!t.dueDate) continue;
        evs.push({ id: `${t.id}-task`, kind: 'task', icon: '✅', label: t.title || 'Task', name: t.assignedTo || '', date: new Date(t.dueDate), color: AMBER });
      }
      try {
        const g = await base44.functions.invoke('listCalendarEvents', { days: 1 });
        const gevs = g?.data?.events || g?.events || [];
        gevs.forEach((e, i) => {
          const d = new Date(e.startISO || e.start || e.startDateTime);
          if (isNaN(d.getTime())) return;
          evs.push({ id: `gcal-${i}`, kind: 'gcal', icon: '🗓️', label: e.title || e.summary || 'Calendar event', name: '', date: d, color: BLUE, htmlLink: e.htmlLink });
        });
      } catch { /* Google Calendar is optional */ }

      setItems(evs.filter(e => !isNaN(e.date.getTime())));
    } catch (e) {
      console.error('next3h load', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 90000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(t); }, []);

  const due = items
    .filter(e => e.date.getTime() > now - GRACE_MS && e.date.getTime() <= now + WINDOW_MS)
    .sort((a, b) => a.date - b.date);
  const later = items.filter(e => e.date.getTime() > now + WINDOW_MS).sort((a, b) => a.date - b.date)[0];

  const buckets = [0, 1, 2].map(i => {
    const start = i === 0 ? now - GRACE_MS : now + i * HOUR_MS;
    const end = now + (i + 1) * HOUR_MS;
    return {
      id: i,
      label: `${fmtTime(new Date(now + i * HOUR_MS))} – ${fmtTime(new Date(end))}`,
      items: due.filter(e => e.date.getTime() >= start && e.date.getTime() < end),
    };
  });

  return (
    <div style={{ background: 'rgba(13,27,42,0.75)', border: `1px solid ${GOLD}33`, borderRadius: '8px', padding: '12px 16px', marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: GOLD, fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>⏱ Next 3 Hours</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#6b7280', fontSize: '10px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: LED, boxShadow: `0 0 6px ${LED}` }} />
            live
          </span>
          <span style={{ color: '#8a9ab8', fontSize: '11px' }}>{fmtTime(new Date(now))} – {fmtTime(new Date(now + WINDOW_MS))}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#8a9ab8', fontSize: '10px' }}>{due.length === 0 ? 'nothing scheduled' : `${due.length} coming up`}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: LED, fontSize: '10px', fontWeight: 'bold' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', border: `2px solid ${LED}`, boxShadow: `0 0 8px ${LED}` }} />
            due within 15 min
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#4a5568', fontSize: '11px', padding: '10px 0' }}>Loading the next three hours…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {buckets.map(bucket => (
            <div key={bucket.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '8px 9px', minHeight: '62px' }}>
              <div style={{ color: '#6b7280', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>{bucket.label}</div>
              {bucket.items.length === 0 ? (
                <div style={{ color: '#2d3748', fontSize: '11px', textAlign: 'center', padding: '8px 0' }}>—</div>
              ) : bucket.items.map(e => {
                const ms = e.date.getTime() - now;
                const led = ms <= LED_MS;
                return (
                  <div key={e.id} className={led ? 'pulse-green-badge' : ''} title={`${e.label} · ${fmtTime(e.date)}`} style={{ background: led ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.03)', border: led ? `2px solid ${LED}` : `1px solid ${e.color}33`, borderLeft: led ? `2px solid ${LED}` : `3px solid ${e.color}`, borderRadius: '4px', padding: '5px 8px', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px' }}>{e.icon}</span>
                      <span style={{ color: led ? LED : '#e8e0d0', fontSize: '11px', fontWeight: 'bold', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name || e.label}</span>
                      <span style={{ color: led ? LED : e.color, fontSize: '10px', fontWeight: 'bold', flexShrink: 0 }}>{fmtTime(e.date)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', marginTop: '1px' }}>
                      <span style={{ color: '#6b7280', fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name ? e.label : (e.kind === 'gcal' ? 'Google Calendar' : '')}</span>
                      <span style={{ color: led ? LED : '#4a5568', fontSize: '9px', fontWeight: 'bold', flexShrink: 0 }}>{fmtCountdown(ms)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {!loading && due.length === 0 && (
        <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '8px' }}>
          Clear board for the next three hours{later ? ` · next up ${fmtTime(later.date)} — ${later.name || later.label}` : ''}
        </div>
      )}
    </div>
  );
}