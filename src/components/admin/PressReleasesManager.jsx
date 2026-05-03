import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const ls = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' };

export default function PressReleasesManager() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const EMPTY = { title:'', summary:'', content:'', sourceUrl:'', imageUrl:'', status:'NEW' };
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    setLoading(true);
    try { const arr = await base44.entities.PressRelease.list('-publishedAt', 200); setItems(arr||[]); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handlePost = async () => {
    if (!form.title) return;
    try {
      await base44.entities.PressRelease.create({ ...form, publishedAt: new Date().toISOString() });
      setForm(EMPTY); setShowForm(false); await load();
    } catch(e) { alert('Error: ' + e.message); }
  };

  const ta = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px 14px', color:'#e8e0d0', fontSize:'13px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box', resize:'vertical' };
  const statusColors = { NEW:'#60a5fa', PENDING:'#f59e0b', COMPLETED:'#4ade80', ARCHIVED:'#4a5568' };

  return (
    <div style={{ fontFamily:'Georgia, serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <div>
          <h3 style={{ color:'#e8e0d0', margin:'0 0 4px', fontWeight:'normal', fontSize:'18px' }}>Press Releases</h3>
          <p style={{ color:'#6b7280', fontSize:'12px', margin:0 }}>Manage press releases visible in the investor portal.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'2px', padding:'9px 20px', cursor:'pointer', fontWeight:'700', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase' }}>
          {showForm ? '✕ Cancel' : '+ New Release'}
        </button>
      </div>

      {showForm && (
        <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(184,147,58,0.25)', borderRadius:'6px', padding:'24px', marginBottom:'28px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'12px', marginBottom:'12px' }}>
            <div>
              <label style={ls}>Headline</label>
              <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Press release headline…" style={{ ...ta, resize:'none' }} />
            </div>
            <div>
              <label style={ls}>Status</label>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={{ ...ta, cursor:'pointer', resize:'none' }}>
                {['NEW','PENDING','COMPLETED','ARCHIVED'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom:'12px' }}>
            <label style={ls}>Summary (1–2 sentences)</label>
            <input value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})} placeholder="Short summary…" style={{ ...ta, resize:'none' }} />
          </div>
          <div style={{ marginBottom:'12px' }}>
            <label style={ls}>Full Content</label>
            <textarea value={form.content} onChange={e=>setForm({...form,content:e.target.value})} placeholder="Full press release text…" rows={5} style={ta} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'20px' }}>
            <div>
              <label style={ls}>Source URL (optional)</label>
              <input value={form.sourceUrl} onChange={e=>setForm({...form,sourceUrl:e.target.value})} placeholder="https://…" style={{ ...ta, resize:'none' }} />
            </div>
            <div>
              <label style={ls}>Image URL (optional)</label>
              <input value={form.imageUrl} onChange={e=>setForm({...form,imageUrl:e.target.value})} placeholder="https://…" style={{ ...ta, resize:'none' }} />
            </div>
          </div>
          <button onClick={handlePost} disabled={!form.title}
            style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'11px 28px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase', opacity:!form.title?0.5:1 }}>
            📰 Publish
          </button>
        </div>
      )}

      {loading && <div style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading…</div>}
      {!loading && items.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px', color:'#4a5568' }}>
          <div style={{ fontSize:'40px', marginBottom:'10px' }}>📰</div>
          <p>No press releases yet. Click "+ New Release" to create one.</p>
        </div>
      )}
      {items.map(item => (
        <div key={item.id} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'6px', padding:'18px 20px', marginBottom:'10px', display:'flex', gap:'16px', alignItems:'flex-start' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px', flexWrap:'wrap' }}>
              <div>
                <span style={{ background:`${statusColors[item.status]||'#6b7280'}22`, color:statusColors[item.status]||'#6b7280', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', padding:'2px 8px', borderRadius:'2px', marginRight:'8px' }}>{item.status}</span>
                <span style={{ color:'#e8e0d0', fontWeight:'bold', fontSize:'14px' }}>{item.title}</span>
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexShrink:0 }}>
                <span style={{ color:'#4a5568', fontSize:'11px' }}>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : ''}</span>
                {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color:'#60a5fa', fontSize:'10px', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'10px', padding:'1px 7px', textDecoration:'none' }}>↗ Source</a>}
                <button onClick={async()=>{ if(window.confirm('Delete this press release?')){ await base44.entities.PressRelease.delete(item.id); await load(); } }}
                  style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'4px', padding:'3px 10px', cursor:'pointer', fontSize:'11px' }}>
                  Delete
                </button>
              </div>
            </div>
            {item.summary && <p style={{ color:'#6b7280', fontSize:'12px', margin:'6px 0 0', lineHeight:1.5 }}>{item.summary}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}