import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

export default function ResearchTab({ lead, user }) {
  // Works for both lead contact card and investor contact card
  const firstName  = lead?.firstName  || user?.name?.split(' ')[0] || '';
  const lastName   = lead?.lastName   || user?.name?.split(' ').slice(1).join(' ') || '';
  const email      = lead?.email      || user?.email || '';
  const phone      = lead?.phone      || user?.phone || '';
  const state      = lead?.state      || user?.state || '';
  const address    = lead?.address    || user?.address || '';
  const notes      = lead?.notes      || user?.notes || '';
  const company    = user?.company    || '';

  const [research, setResearch]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [ran, setRan]             = useState(false);

  const location = address || state || '';

  const run = async () => {
    setLoading(true);
    setResearch(null);
    try {
      const res = await base44.functions.invoke('liveAssistantResearch', {
        name: `${firstName} ${lastName}`.trim(),
        email,
        phone,
        location,
        company,
        notes,
      });
      setResearch(res?.data || { error: 'No data returned' });
      setRan(true);
    } catch(e) {
      setResearch({ error: e.message });
    }
    setLoading(false);
  };

  // Auto-run on first open
  useEffect(() => {
    if (!ran && (firstName || location)) run();
  }, []);

  const Section = ({ title, color, children }) => (
    <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'6px', padding:'12px 14px', marginBottom:'10px' }}>
      <div style={{ color: color || GOLD, fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'8px' }}>{title}</div>
      {children}
    </div>
  );

  const Tag = ({ text, color }) => (
    <span style={{ background:`${color || '#60a5fa'}18`, border:`1px solid ${color || '#60a5fa'}33`, color: color || '#60a5fa', borderRadius:'4px', padding:'2px 8px', fontSize:'10px', display:'inline-block', margin:'2px' }}>
      {text}
    </span>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div>
          <div style={{ color:'#e8e0d0', fontSize:'15px', marginBottom:'2px' }}>🔍 Lead Research</div>
          <div style={{ color:'#6b7280', fontSize:'11px' }}>
            {firstName} {lastName} {location ? `· ${location}` : ''}
          </div>
        </div>
        <button onClick={run} disabled={loading}
          style={{ background: loading ? 'rgba(184,147,58,0.1)' : 'linear-gradient(135deg,#b8933a,#d4aa50)', color: loading ? GOLD : '#0a0f1e', border: loading ? `1px solid ${GOLD}` : 'none', borderRadius:'6px', padding:'8px 16px', cursor: loading ? 'not-allowed' : 'pointer', fontSize:'11px', fontWeight:'bold', letterSpacing:'0.5px' }}>
          {loading ? '⏳ Researching…' : ran ? '↻ Refresh' : '🔍 Research'}
        </button>
      </div>

      {!ran && !loading && (
        <div style={{ color:'#4a5568', textAlign:'center', padding:'40px', border:'1px dashed rgba(255,255,255,0.08)', borderRadius:'6px' }}>
          <div style={{ fontSize:'32px', marginBottom:'8px' }}>🔍</div>
          Click Research to get AI-powered insights on this contact
        </div>
      )}

      {loading && (
        <div style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>
          <div style={{ fontSize:'28px', marginBottom:'10px', animation:'spin 1s linear infinite', display:'inline-block' }}>⏳</div>
          <div>Researching {firstName} {lastName}…</div>
          <div style={{ fontSize:'11px', marginTop:'4px', color:'#4a5568' }}>Checking location, businesses, talking points…</div>
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {research?.error && (
        <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'6px', padding:'14px', color:'#ef4444', fontSize:'12px' }}>
          Error: {research.error}
        </div>
      )}

      {research && !research.error && !loading && (
        <div style={{ animation:'fadeIn 0.3s ease' }}>
          <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

          {/* Summary */}
          {research.summary && (
            <Section title="📋 Summary" color={GOLD}>
              <div style={{ color:'#c4cdd8', fontSize:'12px', lineHeight:1.7 }}>{research.summary}</div>
            </Section>
          )}

          {/* Business owner */}
          {research.businessOwner && (
            <Section title="💼 Business" color="#f59e0b">
              <div style={{ color:'#f59e0b', fontSize:'12px' }}>{research.businessOwner}</div>
            </Section>
          )}

          {/* Local economy */}
          {research.localEconomy && (
            <Section title="🏙 Local Economy" color="#60a5fa">
              <div style={{ color:'#c4cdd8', fontSize:'12px', lineHeight:1.6 }}>{research.localEconomy}</div>
            </Section>
          )}

          {/* Nearby businesses */}
          {research.nearbyBusinesses?.length > 0 && (
            <Section title="🏢 Major Employers / Businesses Nearby" color="#4ade80">
              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                {research.nearbyBusinesses.map((b, i) => <Tag key={i} text={b} color="#4ade80" />)}
              </div>
            </Section>
          )}

          {/* Universities */}
          {research.universities?.length > 0 && (
            <Section title="🎓 Universities Nearby" color="#a78bfa">
              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                {research.universities.map((u, i) => <Tag key={i} text={u} color="#a78bfa" />)}
              </div>
            </Section>
          )}

          {/* Talking points */}
          {research.talkingPoints?.length > 0 && (
            <Section title="💬 Talking Points" color="#f59e0b">
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {research.talkingPoints.map((tp, i) => (
                  <div key={i} style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
                    <span style={{ color:GOLD, flexShrink:0, marginTop:'1px' }}>•</span>
                    <span style={{ color:'#c4cdd8', fontSize:'12px', lineHeight:1.6 }}>{tp}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Contact details used */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'10px', marginTop:'4px' }}>
            <div style={{ color:'#4a5568', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'6px' }}>Based on</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
              {firstName && <Tag text={`${firstName} ${lastName}`} color="#8a9ab8" />}
              {email && <Tag text={email} color="#8a9ab8" />}
              {location && <Tag text={location} color="#8a9ab8" />}
              {company && <Tag text={company} color="#8a9ab8" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}