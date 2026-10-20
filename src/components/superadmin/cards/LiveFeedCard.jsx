/**
 * LiveFeedCard.jsx — the realtime notification feed for one system, kept strictly
 * separate: the Debt Call Coach feed only carries coach-system entities, the Fronter
 * feed only fronter-system entities.
 */
import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { C, emptyStyle, ago, asArray } from '@/components/superadmin/kit';

const SOURCES = {
  coach: [
    {
      entity: 'CallLog', sort: '-calledAt', limit: 10,
      map: (r) => ({ ts: r.calledAt || r.created_date, color: r.direction === 'inbound' ? C.purple : C.coach, text: `${r.direction === 'inbound' ? 'Inbound' : 'Outbound'} call · ${r.callerName || r.fromNumber || r.toNumber || 'unknown'} (${r.status || 'ringing'})` }),
    },
    {
      entity: 'EmailTrackingEvent', sort: '-trackedAt', limit: 8,
      map: (r) => ({ ts: r.trackedAt || r.created_date, color: C.warn, text: `Client ${r.eventType === 'click' ? 'clicked a link in' : 'opened'} ${r.templateName || 'an email'}` }),
    },
    {
      entity: 'DebtLead', sort: '-updated_date', limit: 8,
      map: (r) => ({ ts: r.updated_date, color: C.fronter, text: `${r.firstName || ''} ${r.lastName || ''} — ${r.status || 'new'}${r.isHotLead ? ' 🔥' : ''}` }),
    },
  ],
  fronter: [
    {
      entity: 'FronterHeadsUp', sort: '-createdAt', limit: 8,
      map: (r) => ({ ts: r.createdAt || r.created_date, color: C.fronter, text: `${r.fronterUsername || 'fronter'} is on a call with ${r.leadName || 'a client'}` }),
    },
    {
      entity: 'HotCallAlert', sort: '-created_date', limit: 8,
      map: (r) => ({ ts: r.updated_date || r.created_date, color: r.criticalAlert ? C.danger : C.warn, text: `${r.status || 'monitoring'} alert · ${r.dialerUsername || ''} ${r.leadName || ''}${r.hotScore ? ` (${r.hotScore})` : ''}` }),
    },
    {
      entity: 'EmailTrackingEvent', sort: '-trackedAt', limit: 8,
      map: (r) => ({ ts: r.trackedAt || r.created_date, color: C.warn, text: `Lead ${r.eventType === 'click' ? 'clicked a link in' : 'opened'} ${r.templateName || 'an email'}` }),
    },
    {
      entity: 'FronterActivityLog', sort: '-created_date', limit: 8,
      map: (r) => ({ ts: r.created_date, color: C.coach, text: `${r.username} · ${(r.activityType || '').replace('_', ' ')}${r.tabName ? ` — ${r.tabName}` : ''}` }),
    },
  ],
};

export default function LiveFeedCard({ system }) {
  const sources = SOURCES[system] || SOURCES.coach;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const seen = useRef(new Map());

  const commit = () => setItems(Array.from(seen.current.values()).sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0)).slice(0, 40));

  const upsert = (key, entry) => {
    const existing = seen.current.get(key);
    if (existing && existing.ts === entry.ts && existing.text === entry.text) return;
    seen.current.set(key, { key, ...entry });
    commit();
  };

  useEffect(() => {
    let alive = true;
    seen.current = new Map();
    setLoading(true);

    sources.forEach((src) => {
      base44.entities[src.entity].list(src.sort, src.limit)
        .then((res) => {
          if (!alive) return;
          asArray(res).forEach((r) => {
            const mapped = src.map(r);
            seen.current.set(`${src.entity}:${r.id}`, { key: `${src.entity}:${r.id}`, ...mapped, entity: src.entity });
          });
          commit();
        })
        .catch(() => {})
        .finally(() => { if (alive) setLoading(false); });
    });

    const unsubs = sources.map((src) => base44.entities[src.entity].subscribe((event) => {
      const key = `${src.entity}:${event.id}`;
      if (event.type === 'delete') { seen.current.delete(key); commit(); return; }
      const mapped = src.map(event.data);
      const prev = seen.current.get(key);
      if (prev) seen.current.delete(key);
      seen.current.set(key, { key, ...mapped, entity: src.entity, fresh: true });
      commit();
    }));

    return () => { alive = false; unsubs.forEach((u) => u && u()); };
  }, [system]);

  return (
    <div>
      {loading && items.length === 0 && <div style={emptyStyle}>Connecting to the live feed…</div>}
      {!loading && items.length === 0 && <div style={emptyStyle}>No activity in this system yet.</div>}
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {items.map((it) => (
          <div key={it.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: it.color, marginTop: '4px', flexShrink: 0, boxShadow: it.fresh ? `0 0 8px ${it.color}` : 'none' }} />
            <span style={{ flex: 1, color: C.ink, fontSize: '11px', lineHeight: 1.45 }}>{it.text}</span>
            <span style={{ color: C.dim, fontSize: '10px', whiteSpace: 'nowrap' }}>{ago(it.ts)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}