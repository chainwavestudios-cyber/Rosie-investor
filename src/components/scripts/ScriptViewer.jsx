import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

// Replaces {{firstname}} and {{lastname}} tokens with actual values
const applyTokens = (text, lead) => {
  if (!text) return '';
  return text
    .replace(/\{\{\s*firstname\s*\}\}/gi, lead?.firstName || '')
    .replace(/\{\{\s*lastname\s*\}\}/gi, lead?.lastName || '')
    .replace(/\{\{\s*first_name\s*\}\}/gi, lead?.firstName || '')
    .replace(/\{\{\s*last_name\s*\}\}/gi, lead?.lastName || '')
    .replace(/\{\{\s*name\s*\}\}/gi, `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim());
};

export default function ScriptViewer({ lead }) {
  const [scripts, setScripts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    base44.entities.GlobalScript.list('sortOrder', 200)
      .then(results => {
        setScripts(results || []);
        if (results?.length > 0) setActiveId(results[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const active = scripts.find(s => s.id === activeId) || scripts[0];
  const rendered = active ? applyTokens(active.content, lead) : '';

  const viewer = (
    <div style={{ display:'flex', flexDirection:'column', height: expanded ? 'calc(100vh - 80px)' : '100%' }}>

      {/* Script selector tabs */}
      <div style={{ display:'flex', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:'12px', overflowX:'auto', flexShrink:0, scrollbarWidth:'none' }}>
        {scripts.map(s => (
          <button key={s.id} onClick={() => setActiveId(s.id)}
            style={{ background: activeId===s.id ? 'rgba(184,147,58,0.1)' : 'none', border:'none', borderBottom: activeId===s.id ? `2px solid ${GOLD}` : '2px solid transparent', color: activeId===s.id ? GOLD : '#6b7280', padding:'8px 14px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap', flexShrink:0 }}>
            {s.name}
          </button>
        ))}
        <button onClick={() => setExpanded(e => !e)}
          style={{ marginLeft:'auto', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px', color:'#8a9ab8', cursor:'pointer', fontSize:'11px', padding:'4px 10px', whiteSpace:'nowrap', flexShrink:0 }}>
          {expanded ? '⊡ Collapse' : '⊞ Expand'}
        </button>
      </div>

      {loading && <div style={{ color:'#6b7280', fontSize:'12px', textAlign:'center', padding:'24px' }}>Loading…</div>}

      {!loading && scripts.length === 0 && (
        <div style={{ color:'#4a5568', fontSize:'12px', textAlign:'center', padding:'24px' }}>
          No scripts yet. Go to the Scripts tab in the Leads section to create some.
        </div>
      )}

      {active && (
        <div style={{
          flex:1, overflowY:'auto', background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:'4px', padding:'16px', color: active.color || '#e8e0d0',
          fontSize:`${active.fontSize || 14}px`, lineHeight:1.7, fontFamily:'Georgia, serif',
          whiteSpace:'pre-wrap', minHeight: expanded ? '0' : '260px',
        }}>
          {rendered || <span style={{ color:'#4a5568', fontStyle:'italic' }}>No content yet.</span>}
        </div>
      )}

      {lead && (
        <div style={{ marginTop:'6px', color:'#4a5568', fontSize:'10px', flexShrink:0 }}>
          Showing for: <span style={{ color:'#e8e0d0' }}>{lead.firstName} {lead.lastName}</span>
        </div>
      )}
    </div>
  );

  if (expanded) {
    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.97)', zIndex:99999, display:'flex', flexDirection:'column', padding:'24px', fontFamily:'Georgia, serif' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <span style={{ color:GOLD, fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>
            📝 Script — {lead?.firstName} {lead?.lastName}
          </span>
          <button onClick={() => setExpanded(false)}
            style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'2px', color:'#e8e0d0', cursor:'pointer', fontSize:'12px', padding:'6px 16px' }}>
            ⊡ Close Fullscreen
          </button>
        </div>
        {viewer}
      </div>
    );
  }

  return viewer;
}