/**
 * ConversionFunnel.jsx — Visual funnel showing lead count and conversion rate
 * at each stage of the enrichment-to-enrollment pipeline.
 */
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';
const GOLD = '#10b981';
const EMERALD = '#34d399';

const STAGES = [
  { label: 'Raw Leads Scraped', count: 4832, color: '#4a5568' },
  { label: 'AI-Enriched & Qualified', count: 1247, color: BLUE },
  { label: 'Campaign Triggered', count: 892, color: AMBER },
  { label: 'Engaged (Open + Click)', count: 487, color: PURPLE },
  { label: 'Human-Call Validated', count: 164, color: GOLD },
  { label: 'DAA Enrolled', count: 62, color: EMERALD },
];

export default function ConversionFunnel() {
  const maxCount = STAGES[0].count;

  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '28px 24px' }}>
      <h2 style={{ color: '#e8e0d0', fontSize: '18px', fontWeight: 'normal', margin: '0 0 6px' }}>📉 Conversion Funnel</h2>
      <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 24px' }}>How many leads survive each stage of the pipeline — from raw scrape to DAA enrollment</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {STAGES.map((stage, i) => {
          const widthPct = Math.max(8, (stage.count / maxCount) * 100);
          const prevCount = i > 0 ? STAGES[i - 1].count : null;
          const convRate = prevCount ? ((stage.count / prevCount) * 100).toFixed(1) : null;

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Label */}
              <div style={{ width: '180px', flexShrink: 0, textAlign: 'right' }}>
                <div style={{ color: '#8a9ab8', fontSize: '11px', fontWeight: 'bold' }}>{stage.label}</div>
                {convRate && <div style={{ color: '#4a5568', fontSize: '9px' }}>{convRate}% of previous</div>}
              </div>
              {/* Bar */}
              <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                <div style={{
                  width: `${widthPct}%`,
                  height: '32px',
                  background: `${stage.color}22`,
                  border: `1px solid ${stage.color}55`,
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  padding: '0 12px',
                  transition: 'width 0.5s ease',
                  minWidth: '60px',
                }}>
                  <span style={{ color: stage.color, fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{stage.count.toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall conversion */}
      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ color: '#6b7280', fontSize: '11px' }}>Overall: Raw Lead → DAA Enrolled</div>
        <div style={{ color: EMERALD, fontSize: '16px', fontWeight: 'bold' }}>{((62 / 4832) * 100).toFixed(1)}% end-to-end conversion</div>
      </div>
    </div>
  );
}