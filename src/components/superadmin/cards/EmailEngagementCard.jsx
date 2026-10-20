/**
 * EmailEngagementCard.jsx — one system's email engagement: opens, link clicks and
 * which template is pulling the most attention, straight from the tracking events.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { C, rowStyle, emptyStyle, chip, ago, asArray } from '@/components/superadmin/kit';

const SYSTEMS = {
  coach: { templateEntity: 'DebtEmailTemplate', leadEntity: 'DebtLead', openedField: 'apptEmailOpenedAt', label: (t) => t.name, viewsLabel: 'Clients who opened their email' },
  fronter: { templateEntity: 'FronterEmailTemplate', leadEntity: 'FronterLead', openedField: 'emailOpenedAt', label: (t) => t.label, viewsLabel: 'Welcome message views' },
};

export default function EmailEngagementCard({ system }) {
  const cfg = SYSTEMS[system] || SYSTEMS.coach;
  const [events, setEvents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [opened, setOpened] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const tpl = asArray(await base44.entities[cfg.templateEntity].list('-created_date', 100));
      setTemplates(tpl);
      const ids = tpl.map((t) => t.id);
      const [views, evts] = await Promise.all([
        base44.entities[cfg.leadEntity].count({ [cfg.openedField]: { $ne: null } }).catch(() => null),
        ids.length
          ? base44.entities.EmailTrackingEvent.filter({ templateId: { $in: ids } }, '-trackedAt', 200)
          : base44.entities.EmailTrackingEvent.list('-trackedAt', 200),
      ]);
      setOpened(views);
      setEvents(asArray(evts));
    } catch { /* tracking unavailable */ }
    setLoading(false);
  }, [cfg]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => base44.entities.EmailTrackingEvent.subscribe((event) => {
    if (event.type === 'delete') { setEvents((prev) => prev.filter((e) => e.id !== event.id)); return; }
    setEvents((prev) => [event.data, ...prev.filter((e) => e.id !== event.data.id)].slice(0, 200));
  }), []);

  const opens = events.filter((e) => e.eventType === 'open').length;
  const clicks = events.filter((e) => e.eventType === 'click').length;
  const uniqueLeads = new Set(events.map((e) => e.leadId).filter(Boolean)).size;
  const openRate = events.length ? Math.round((opens / events.length) * 100) : 0;

  const perTemplate = Object.values(
    events.reduce((acc, e) => {
      const key = e.templateName || 'Untracked template';
      acc[key] = acc[key] || { name: key, opens: 0, clicks: 0 };
      if (e.eventType === 'open') acc[key].opens += 1;
      if (e.eventType === 'click') acc[key].clicks += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.opens + b.clicks - (a.opens + a.clicks));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: '6px', marginBottom: '12px' }}>
        {[
          { label: 'Opens', value: opens, color: C.fronter },
          { label: 'Clicks', value: clicks, color: C.coach },
          { label: 'Clients', value: uniqueLeads, color: C.purple },
          { label: 'Open rate', value: `${openRate}%`, color: C.warn },
        ].map((s) => (
          <div key={s.label} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '7px 8px' }}>
            <div style={{ color: C.muted, fontSize: '9px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: '16px', fontWeight: 'bold' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
        <span style={{ color: C.fronter, fontSize: '19px', fontWeight: 'bold' }}>{opened ?? '—'}</span>
        <span style={{ color: C.muted, fontSize: '11px' }}>{cfg.viewsLabel}</span>
      </div>

      {loading && <div style={emptyStyle}>Loading email engagement…</div>}
      {!loading && events.length === 0 && <div style={emptyStyle}>No tracked email activity for this system yet.</div>}

      {perTemplate.slice(0, 5).map((t) => (
        <div key={t.name} style={rowStyle}>
          <span style={{ flex: 1, color: C.ink, fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
          <span style={chip(C.fronter)}>{t.opens} opens</span>
          <span style={chip(C.coach)}>{t.clicks} clicks</span>
        </div>
      ))}

      {events.length > 0 && (
        <div style={{ marginTop: '10px', paddingTop: '9px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ color: C.muted, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Live open & click feed</div>
          {events.slice(0, 8).map((e) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', fontSize: '11px' }}>
              <span style={{ color: e.eventType === 'click' ? C.coach : C.fronter }}>{e.eventType === 'click' ? '🖱' : '👁'}</span>
              <span style={{ flex: 1, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.templateName || 'Email'}</span>
              <span style={{ color: C.dim, fontSize: '10px' }}>{ago(e.trackedAt)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ color: C.dim, fontSize: '10px', marginTop: '10px' }}>
        {templates.length} template{templates.length === 1 ? '' : 's'} in this system
      </div>
    </div>
  );
}