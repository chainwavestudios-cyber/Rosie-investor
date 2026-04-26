import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

export default function ResearchTab({ lead, user }) {
  const firstName = lead?.firstName || user?.name?.split(' ')[0] || '';
  const lastName  = lead?.lastName  || user?.name?.split(' ').slice(1).join(' ') || '';
  const email     = lead?.email     || user?.email || '';
  const phone     = lead?.phone     || user?.phone || '';
  const state     = lead?.state     || user?.state || '';
  const address   = lead?.address   || user?.address || '';

  // Editable fields before research
  const [form, setForm] = useState({
    name:     `${firstName} ${lastName}`.trim(),
    email:    email,
    phone:    phone,
    location: address || state || '',
    company:  user?.company || lead?.company || '',
    notes:    lead?.notes || user?.notes || '',
    extra:    '', // any extra context the admin wants to add
  });

  const [research, setResearch]     = useState(null);
  const [loading, setLoading]       = useState(false);
  const [ran, setRan]               = useState(false);

  const run = async () => {
    setLoading(true); setResearch(null);
    try {
      const res = await base44.functions.invoke('liveAssistantResearch', {
        name:     form.name,
        email:    form.email,
        phone:    form.phone,
        location: form.location,
        company:  form.company,
        notes:    [form.notes, form.extra].filter(Boolean).join('\n'),
      });
      setResearch(res?.data || { error: 'No data returned' });
      setRan(true);
    } catch(e) { setResearch({ error: e.message }); }
    setLoading(false);
  };

  const inp = {
    width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
    borderRadius:'4px', padding:'7px 10px', color:'#e8e0d0', fontSize:'12px',
    outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box',
  };
  const ls = { display:'block', color:'#4a5568', fontSize:'9px', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'4px' };

  const Section = ({ title, color, children }) => (
    <div style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'6px', padding:'12px 14px', marginBottom:'10px' }}>
      <div style={{ color: color || GOLD, fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'8px' }}>{title}</div>
      {children}
    </div>
  );

  const Tag = ({ text, color }) => (
    <span style={{ background:`${color||'#60a5fa'}18`, border:`1px solid ${color||'#60a5fa'}33`, color:color||'#60a5fa', borderRadius:'4px', padding:'2px 8px', fontSize:'10px', display:'inline-block', margin:'2px' }}>{text}</span>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>

      {/* Pre-research form */}
      <div style={{ background:'rgba(0,0,0,0.12)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'6px', padding:'14px', marginBottom:'14px' }}>
        <div style={{ color:GOLD, fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'12px' }}>🔍 Research Details</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
          <div>
            <label style={ls}>Full Name</label>
            <input value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} style={inp} />
          </div>
          <div>
            <label style={ls}>Location / City / State</label>
            <input value={form.location} onChange={e => setForm(f => ({...f, location:e.target.value}))} placeholder="e.g. Cleveland, OH" style={inp} />
          </div>
          <div>
            <label style={ls}>Email</label>
            <input value={form.email} onChange={e => setForm(f => ({...f, email:e.target.value}))} style={inp} />
          </div>
          <div>
            <label style={ls}>Company / Business</label>
            <input value={form.company} onChange={e => setForm(f => ({...f, company:e.target.value}))} placeholder="If known…" style={inp} />
          </div>
        </div>
        <div style={{ marginBottom:'10px' }}>
          <label style={ls}>Additional Context (optional — helps AI personalize research)</label>
          <textarea value={form.extra} onChange={e => setForm(f => ({...f, extra:e.target.value}))}
            placeholder="e.g. Mentioned they own a restaurant chain. Interested in passive income. Recently retired. Has background in real estate..."
            rows={3} style={{ ...inp, resize:'vertical' }} />
        </div>
        <button onClick={run} disabled={loading}
          style={{ width:'100%', background: loading ? 'rgba(184,147,58,0.15)' : 'linear-gradient(135deg,#b8933a,#d4aa50)', color: loading ? GOLD : '#0a0f1e', border: loading ? `1px solid ${GOLD}` : 'none', borderRadius:'6px', padding:'10px', cursor: loading ? 'not-allowed' : 'pointer', fontSize:'12px', fontWeight:'bold', letterSpacing:'0.5px' }}>
          {loading ? '⏳ Researching…' : ran ? '↻ Run Research Again' : '🔍 Run Research'}
        </button>
      </div>

      {loading && (
        <div style={{ color:'#6b7280', textAlign:'center', padding:'30px' }}>
          <div style={{ fontSize:'28px', marginBottom:'8px' }}>⏳</div>
          Researching {form.name}…
          <div style={{ fontSize:'11px', color:'#4a5568', marginTop:'4px' }}>Checking location, businesses, talking points…</div>
        </div>
      )}

      {research?.error && (
        <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'6px', padding:'12px', color:'#ef4444', fontSize:'12px' }}>
          Error: {research.error}
        </div>
      )}

      {research && !research.error && !loading && (
        <div>
          {research.summary && (
            <Section title="📋 Summary" color={GOLD}>
              <div style={{ color:'#c4cdd8', fontSize:'12px', lineHeight:1.7 }}>{research.summary}</div>
            </Section>
          )}
          {research.businessOwner && (
            <Section title="💼 Business" color="#f59e0b">
              <div style={{ color:'#f59e0b', fontSize:'12px' }}>{research.businessOwner}</div>
            </Section>
          )}
          {research.localEconomy && (
            <Section title="🏙 Local Economy" color="#60a5fa">
              <div style={{ color:'#c4cdd8', fontSize:'12px', lineHeight:1.6 }}>{research.localEconomy}</div>
            </Section>
          )}
          {research.nearbyBusinesses?.length > 0 && (
            <Section title="🏢 Major Employers / Businesses Nearby" color="#4ade80">
              <div style={{ display:'flex', flexWrap:'wrap' }}>
                {research.nearbyBusinesses.map((b,i) => <Tag key={i} text={b} color="#4ade80" />)}
              </div>
            </Section>
          )}
          {research.universities?.length > 0 && (
            <Section title="🎓 Universities Nearby" color="#a78bfa">
              <div style={{ display:'flex', flexWrap:'wrap' }}>
                {research.universities.map((u,i) => <Tag key={i} text={u} color="#a78bfa" />)}
              </div>
            </Section>
          )}
          {research.talkingPoints?.length > 0 && (
            <Section title="💬 Talking Points" color="#f59e0b">
              {research.talkingPoints.map((tp,i) => (
                <div key={i} style={{ display:'flex', gap:'8px', marginBottom:'4px' }}>
                  <span style={{ color:GOLD, flexShrink:0 }}>•</span>
                  <span style={{ color:'#c4cdd8', fontSize:'12px', lineHeight:1.6 }}>{tp}</span>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}