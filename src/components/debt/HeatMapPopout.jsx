/**
 * HeatMapPopout.jsx — Alt+H popout heat map for deal distribution.
 * Radial concentric-ring visualization: center = enrolled (hottest),
 * outer rings = cooler (lower scores). Ring intensity scales with
 * deal count. Below the heat map: list of hottest deals, clickable
 * to open the contact card.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { usePopOutPanel } from '@/hooks/usePopOutPanel';

const GOLD = '#10b981';
const RED = '#ef4444';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const DARK = '#0a0f1e';

// Zones from outermost (coldest) to center (hottest)
const ZONES = [
  { id: 'z1', label: '5-25', min: 5, max: 24, color: '#1e40af', size: 320 },
  { id: 'z2', label: '25-50', min: 25, max: 49, color: '#06b6d4', size: 256 },
  { id: 'z3', label: '50-75', min: 50, max: 74, color: '#84cc16', size: 192 },
  { id: 'z4', label: '75-99', min: 75, max: 99, color: '#f97316', size: 128 },
  { id: 'z5', label: 'Enrolled', min: 100, max: 100, color: '#fbbf24', size: 64 },
];

export default function HeatMapPopout({ visible, username, onOpenLead, onClose }) {
  const panel = usePopOutPanel('heat_map', { width: 560, height: 720 }, username, 14700);
  const { poppedOut, floatingStyle, onDragStart, resizeHandles, toggle } = panel;
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLeads = useCallback(async () => {
    try {
      const page = await base44.entities.DebtLead.filter(
        { dealScore: { $gte: 5 } },
        { sort: '-dealScore', limit: 500 }
      );
      const all = page?.items || page || [];
      setLeads(all.filter(l => !l.deletedAt));
    } catch (e) {
      try {
        const all = await base44.entities.DebtLead.list('-dealScore', 500);
        setLeads((all || []).filter(l => (l.dealScore || 0) >= 5 && !l.deletedAt));
      } catch (e2) { console.error('Heat map load failed:', e2); }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible && !poppedOut) {
      toggle();
      loadLeads();
    } else if (!visible && poppedOut) {
      toggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!poppedOut) return;
    loadLeads();
    const interval = setInterval(loadLeads, 30000);
    return () => clearInterval(interval);
  }, [poppedOut, loadLeads]);

  if (!poppedOut) return null;

  // Group leads by zone
  const zones = ZONES.map(z => {
    const zoneLeads = leads.filter(l => {
      const s = l.dealScore || 0;
      return s >= z.min && s <= z.max;
    });
    return { ...z, count: zoneLeads.length, leads: zoneLeads };
  });

  const maxCount = Math.max(...zones.map(z => z.count), 1);
  const totalDeals = leads.length;
  const enrolledCount = zones.find(z => z.id === 'z5')?.count || 0;
  const hotCount = zones.find(z => z.id === 'z4')?.count || 0;
  const avgScore = totalDeals > 0 ? Math.round(leads.reduce((s, l) => s + (l.dealScore || 0), 0) / totalDeals) : 0;

  // Top deals (hottest)
  const topDeals = [...leads].sort((a, b) => (b.dealScore || 0) - (a.dealScore || 0)).slice(0, 12);

  return (
    <div style={{ ...floatingStyle, background: '#0d1b2a', border: `1px solid ${GOLD}44`, borderRadius: '8px', overflow: 'hidden' }}>
      {resizeHandles}
      <style>{`
        @keyframes heat-pulse-ring {
          0%, 100% { box-shadow: 0 0 8px var(--glow), 0 0 16px var(--glow); }
          50% { box-shadow: 0 0 16px var(--glow), 0 0 32px var(--glow); }
        }
        @keyframes heat-radiate {
          0%, 100% { box-shadow: 0 0 12px #fbbf24, 0 0 24px #fbbf24, 0 0 36px #f97316; }
          50% { box-shadow: 0 0 24px #fbbf24, 0 0 48px #fbbf24, 0 0 72px #f97316; }
        }
        @keyframes heat-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Title bar — draggable */}
      <div
        onMouseDown={onDragStart}
        style={{ padding: '10px 14px', background: `linear-gradient(135deg, ${RED}22, ${GOLD}22)`, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', flexShrink: 0 }}
      >
        <span style={{ color: RED, fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>🔥 Deal Heat Map</span>
        <button onClick={() => { toggle(); onClose?.(); }} style={{ background: 'rgba(239,68,68,0.15)', color: RED, border: 'none', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✕</button>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <StatBox label="Total Deals" value={totalDeals} color={BLUE} />
        <StatBox label="Enrolled" value={enrolledCount} color={GOLD} />
        <StatBox label="Hot (75+)" value={hotCount} color="#f97316" />
        <StatBox label="Avg Score" value={avgScore} color={AMBER} />
      </div>

      {/* Content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {loading ? (
          <div style={{ color: '#6b7280', fontSize: '13px', padding: '60px 0' }}>Loading heat map…</div>
        ) : totalDeals === 0 ? (
          <div style={{ color: '#4a5568', fontSize: '13px', padding: '60px 0', textAlign: 'center' }}>
            No deals in the pipeline yet.<br />Deals with a score of 5+ will appear here.
          </div>
        ) : (
          <>
            {/* Radial heat map */}
            <div style={{ position: 'relative', width: 320, height: 320, marginTop: 16, marginBottom: 4 }}>
              {/* Subtle radial gradient background */}
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,191,36,0.04) 0%, transparent 70%)' }} />

              {zones.map((z, i) => {
                const offset = (320 - z.size) / 2;
                const opacity = 0.15 + 0.85 * (z.count / maxCount);
                const isCenter = z.id === 'z5';
                const hasLeads = z.count > 0;
                return (
                  <div
                    key={z.id}
                    style={{
                      position: 'absolute',
                      top: offset,
                      left: offset,
                      width: z.size,
                      height: z.size,
                      borderRadius: '50%',
                      background: z.color,
                      opacity: hasLeads ? opacity : 0.08,
                      '--glow': z.color,
                      animation: hasLeads
                        ? (isCenter ? 'heat-radiate 2s ease-in-out infinite' : 'heat-pulse-ring 3s ease-in-out infinite')
                        : 'none',
                      animationDelay: `${i * 0.3}s`,
                      transition: 'opacity 0.5s',
                    }}
                  >
                    {/* Count + label */}
                    <div style={{
                      position: 'absolute',
                      top: isCenter ? '50%' : '6px',
                      left: '50%',
                      transform: isCenter ? 'translate(-50%, -50%)' : 'translateX(-50%)',
                      textAlign: 'center',
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                    }}>
                      {hasLeads && (
                        <div style={{ color: '#fff', fontSize: isCenter ? '18px' : '12px', fontWeight: 'bold', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                          {z.count}
                        </div>
                      )}
                      <div style={{
                        color: hasLeads ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)',
                        fontSize: isCenter ? '9px' : '8px',
                        fontWeight: 'bold',
                        textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        {z.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Caption */}
            <div style={{ color: '#4a5568', fontSize: '10px', marginBottom: 8, textAlign: 'center' }}>
              The closer to the center, the closer to enrollment 🔥
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '10px', padding: '4px 14px 10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {zones.map(z => (
                <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: z.color,
                    opacity: 0.15 + 0.85 * (z.count / maxCount),
                    boxShadow: z.count > 0 ? `0 0 6px ${z.color}` : 'none',
                  }} />
                  <span style={{ color: '#6b7280', fontSize: '10px' }}>{z.label}</span>
                </div>
              ))}
            </div>

            {/* Hottest deals list */}
            <div style={{ width: '100%', padding: '4px 14px 14px' }}>
              <div style={{ color: RED, fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}>🔥 Hottest Deals</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {topDeals.map(lead => {
                  const score = lead.dealScore || 0;
                  const zone = zones.find(z => score >= z.min && score <= z.max) || zones[0];
                  return (
                    <button
                      key={lead.id}
                      onClick={() => onOpenLead?.(lead)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '5px 8px', borderRadius: '4px',
                        background: `${zone.color}10`,
                        border: `1px solid ${zone.color}22`,
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: zone.color, flexShrink: 0, boxShadow: `0 0 6px ${zone.color}` }} />
                      <span style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold', flex: 1 }}>
                        {lead.firstName} {lead.lastName}
                      </span>
                      {lead.phone && <span style={{ color: '#6b7280', fontSize: '10px' }}>{lead.phone}</span>}
                      <span style={{ color: zone.color, fontSize: '11px', fontWeight: 'bold', minWidth: 30, textAlign: 'right' }}>
                        {score}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: `${color}10`, border: `1px solid ${color}33`, borderRadius: '4px', padding: '8px', textAlign: 'center' }}>
      <div style={{ color, fontSize: '18px', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>{label}</div>
    </div>
  );
}