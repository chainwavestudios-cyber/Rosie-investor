/**
 * QueueCard.jsx — Fronter system: the transfer queue as it stands right now
 * (clients on hold with a fronter), the lead pipeline mix, and the most recent
 * transfers the super admin can point at and dial.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { C, rowStyle, emptyStyle, chip, ago, asArray } from '@/components/superadmin/kit';

export default function QueueCard({ onDial }) {
  const [holds, setHolds] = useState([]);
  const [counts, setCounts] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCounts = useCallback(async () => {
    try {
      const [byStatus, transferred] = await Promise.all([
        base44.entities.FronterLead.aggregate({ groupBy: 'status' }),
        base44.entities.FronterLead.filter({ status: 'transferred' }, '-transferredAt', 6),
      ]);
      setCounts(asArray(byStatus?.rows).sort((a, b) => (b.count || 0) - (a.count || 0)));
      setRecent(asArray(transferred));
    } catch { /* queue unavailable */ }
  }, []);

  useEffect(() => {
    let alive = true;
    base44.entities.FronterHeadsUp.filter({ status: 'active' }, '-createdAt', 20)
      .then((res) => { if (alive) setHolds(asArray(res)); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    loadCounts();
    const t = setInterval(loadCounts, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [loadCounts]);

  useEffect(() => base44.entities.FronterHeadsUp.subscribe((event) => {
    if (event.type === 'delete') { setHolds((prev) => prev.filter((h) => h.id !== event.id)); return; }
    const rec = event.data;
    setHolds((prev) => {
      const without = prev.filter((h) => h.id !== rec.id);
      return rec.status === 'active' ? [rec, ...without] : without;
    });
  }), []);

  const totalLeads = counts.reduce((sum, r) => sum + (r.count || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
        <span style={{ color: C.fronter, fontSize: '19px', fontWeight: 'bold' }}>{holds.length}</span>
        <span style={{ color: C.muted, fontSize: '11px' }}>clients on hold with a fronter</span>
      </div>

      {loading && <div style={emptyStyle}>Loading transfer queue…</div>}
      {!loading && holds.length === 0 && <div style={emptyStyle}>Queue is clear — no clients on hold.</div>}

      {holds.map((h) => (
        <div key={h.id} style={{ ...rowStyle, borderLeft: `3px solid ${C.warn}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: C.ink, fontSize: '12px', fontWeight: 'bold' }}>{h.leadName || 'Unknown client'}</div>
            <div style={{ color: C.dim, fontSize: '10px' }}>
              held by {h.fronterUsername || '—'} · {h.leadPhone || 'no phone'} · {ago(h.createdAt || h.created_date)}
            </div>
          </div>
          <span style={chip(h.conferenceName ? C.fronter : C.muted)}>{h.conferenceName ? 'on hold' : 'dialing'}</span>
          {h.leadPhone && onDial && (
            <button onClick={() => onDial(h.leadPhone, h.leadName)} style={{ background: `${C.fronter}1a`, color: C.fronter, border: `1px solid ${C.fronter}55`, borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>📞</button>
          )}
        </div>
      ))}

      {counts.length > 0 && (
        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ color: C.muted, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '7px' }}>Lead pipeline · {totalLeads} total</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {counts.map((r) => (
              <span key={r.status} style={chip(r.status === 'transferred' ? C.fronter : r.status === 'closed_deal' ? C.purple : C.coach)}>
                {r.status || 'unknown'} {r.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ color: C.muted, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '7px' }}>Recently transferred</div>
          {recent.map((l) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
              <span style={{ flex: 1, color: C.ink, fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {l.firstName} {l.lastName} <span style={{ color: C.dim }}>{l.leadNumber || ''}</span>
              </span>
              <span style={{ color: C.dim, fontSize: '10px' }}>{ago(l.transferredAt)}</span>
              {l.phone && onDial && (
                <button onClick={() => onDial(l.phone, `${l.firstName || ''} ${l.lastName || ''}`.trim())} style={{ background: 'transparent', color: C.coach, border: `1px solid ${C.coach}44`, borderRadius: '3px', padding: '2px 6px', cursor: 'pointer', fontSize: '10px' }}>📞</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}