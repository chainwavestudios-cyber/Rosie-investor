/**
 * PipelineFlow.jsx — Horizontal 5-step pipeline diagram showing the flow from
 * AI enrichment → campaign → engagement → human validation → DAA pitch.
 */
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';
const GOLD = '#10b981';
const EMERALD = '#34d399';
const DARK = '#0a0f1e';

const STEPS = [
  { id: 1, icon: '🧠', title: 'AI Enrichment', subtitle: 'Identity resolution · debt qualification · credit analysis', color: BLUE },
  { id: 2, icon: '✉️', title: 'Campaign Trigger', subtitle: 'Automated email + SMS to enriched leads', color: AMBER },
  { id: 3, icon: '📊', title: 'Engagement Tracking', subtitle: 'Open / click tracking · intent scoring', color: PURPLE },
  { id: 4, icon: '✅', title: 'Human Validation', subtitle: 'Fronter verifies: $10k+ debt · hardship · seeking relief', color: GOLD },
  { id: 5, icon: '🤝', title: 'DAA Pitch', subtitle: 'Transfer to Christopher Bongiorno · pitches DAA program for first time', color: EMERALD },
];

export default function PipelineFlow() {
  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '28px 24px' }}>
      <h2 style={{ color: '#e8e0d0', fontSize: '18px', fontWeight: 'normal', margin: '0 0 6px' }}>🔗 Lead-to-Enrollment Pipeline</h2>
      <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 24px' }}>From raw scraped lead to enrolled DAA client — the full automated + human verification flow</p>

      {/* Desktop: horizontal flow */}
      <div className="pipeline-desktop" style={{ display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto', paddingBottom: '8px' }}>
        {STEPS.map((step, i) => (
          <div key={step.id} style={{ display: 'flex', alignItems: 'stretch', flex: '1 1 0', minWidth: 0 }}>
            {/* Step card */}
            <div style={{
              flex: 1,
              background: `${step.color}08`,
              border: `1px solid ${step.color}33`,
              borderRadius: '8px',
              padding: '16px 12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              position: 'relative',
              minWidth: 0,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: `${step.color}18`, border: `2px solid ${step.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', marginBottom: '10px',
                boxShadow: `0 0 12px ${step.color}33`,
              }}>{step.icon}</div>
              <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>{step.title}</div>
              <div style={{ color: '#8a9ab8', fontSize: '10px', lineHeight: 1.4 }}>{step.subtitle}</div>
            </div>
            {/* Arrow */}
            {i < STEPS.length - 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', flexShrink: 0 }}>
                <div style={{ color: '#4a5568', fontSize: '20px' }}>→</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical flow */}
      <div className="pipeline-mobile" style={{ display: 'none', flexDirection: 'column', gap: '8px' }}>
        {STEPS.map((step, i) => (
          <div key={step.id}>
            <div style={{
              background: `${step.color}08`,
              border: `1px solid ${step.color}33`,
              borderRadius: '8px',
              padding: '14px',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: `${step.color}18`, border: `2px solid ${step.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', flexShrink: 0,
              }}>{step.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{step.title}</div>
                <div style={{ color: '#8a9ab8', fontSize: '10px', lineHeight: 1.4 }}>{step.subtitle}</div>
              </div>
            </div>
            {i < STEPS.length - 1 && <div style={{ textAlign: 'center', color: '#4a5568', fontSize: '16px', padding: '2px 0' }}>↓</div>}
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .pipeline-desktop { display: none !important; }
          .pipeline-mobile { display: flex !important; }
        }
      `}</style>
    </div>
  );
}