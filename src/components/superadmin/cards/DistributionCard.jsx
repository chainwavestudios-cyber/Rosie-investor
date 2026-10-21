/**
 * DistributionCard.jsx — Fronter system: the lead vault pipeline and where leads
 * have been distributed, plus the most recent hand-offs to fronters.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { C, rowStyle, emptyStyle, chip, ago, asArray } from '@/components/superadmin/kit';

export default function DistributionCard() {
  const [pipeline, setPipeline] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [byPipeline, byDestination, latest] = await Promise.all([
        base44.entities.LeadVaultEntry.aggregate({ groupBy: 'pipelineStatus' }),
        base44.entities.LeadVaultEntry.aggregate({ groupBy: 'destination' }),
        base44.entities.LeadVaultEntry.filter({ distributedAt: { $ne: null } }, '-distributedAt', 8),
      ]);
      setPipeline(asArray(byPipeline?.rows).sort((a, b) => (b.count || 0) - (a.count || 0)));
      setDestinations(asArray(byDestination?.rows).sort((a, b) => (b.count || 0) - (a.count || 0)));
      setRecent(asArray(latest));
    } catch { /* vault unavailable */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 45000); return () => clearInterval(t); }, [load]);

  const total = pipeline.reduce((sum, r) => sum + (r.count || 0), 0);
  const DIST_COLOR = { fronter: C.fronter, ai_dialer: C.purple, debt_marketing: C.fronter, none: C.muted };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
        <span style={{ color: C.fronter, fontSize: '19px', fontWeight: 'bold' }}>{total}</span>
        <span style={{ color: C.muted, fontSize: '11px' }}>leads in the vault pipeline</span>
      </div>

      {loading && <div style={emptyStyle}>Loading vault distribution…</div>}

      {destinations.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
          {destinations.map((d) => (
            <span key={d.destination} style={chip(DIST_COLOR[d.destination] || C.coach)}>{(d.destination || 'none').replace('_', ' ')} · {d.count}</span>
          ))}
        </div>
      )}

      {pipeline.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: C.muted, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '7px' }}>Pipeline stages</div>
          {pipeline.map((p) => (
            <div key={p.pipelineStatus} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', fontSize: '11px' }}>
              <span style={{ flex: 1, color: C.muted }}>{p.pipelineStatus || 'unknown'}</span>
              <span style={{ color: C.ink, fontWeight: 'bold' }}>{p.count}</span>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 ? (
        <div style={{ paddingTop: '10px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ color: C.muted, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '7px' }}>Recently distributed</div>
          {recent.map((l) => (
            <div key={l.id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.ink, fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {l.firstName} {l.lastName}
                </div>
                <div style={{ color: C.dim, fontSize: '10px' }}>
                  {l.assignedTo ? `→ ${l.assignedTo}` : `→ ${l.destination || 'unassigned'}`} · {l.city || ''} {l.state || ''}
                </div>
              </div>
              <span style={{ color: C.dim, fontSize: '10px' }}>{ago(l.distributedAt)}</span>
            </div>
          ))}
        </div>
      ) : !loading && <div style={emptyStyle}>Nothing distributed from the vault yet.</div>}
    </div>
  );
}