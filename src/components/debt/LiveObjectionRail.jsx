/**
 * Collapsed until a real objection is detected. All priorities remain
 * accessible without adding a permanent call-center dashboard.
 */
import { useState } from 'react';

const hue = { high: '#f0b19a', medium: '#dfc08a', low: '#8fa6b0' };
export default function LiveObjectionRail({ matches, onOpen, onClear }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  if (!matches?.length) return null;
  const newest = matches[0];
  const badge = priority => ({ color: hue[priority] || hue.medium, background: 'rgba(255,255,255,.04)',
    border:'1px solid rgba(154,198,188,.20)', borderRadius:8, padding:'7px 10px', cursor:'pointer',
    fontSize:11, fontWeight:700, textAlign:'left' });
  return (
    <section aria-label="Live objection suggestions" style={{
      margin:'8px 0 12px', border:'1px solid rgba(154,198,188,.24)', borderRadius:12,
      background:'linear-gradient(100deg,#122332,#17272b)', padding:'10px 12px',
      display:'flex', alignItems:'center', flexWrap:'wrap', gap:9
    }}>
      <span style={{color:'#d6ba80',fontWeight:800,fontSize:10,letterSpacing:'1px'}}>OBJECTION ASSIST</span>
      <button type="button" onClick={() => onOpen(newest)} style={{...badge(newest.priority),flex:'1 1 210px',minWidth:0,
        color:'#e9eee8',display:'flex',gap:7,alignItems:'center'}}>
        <span aria-hidden="true" style={{background:hue[newest.priority] || hue.medium,width:7,height:7,borderRadius:'50%',flexShrink:0}}/>
        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{newest.title}</span>
        <span style={{marginLeft:'auto',fontSize:10,color:'#a6bab9',whiteSpace:'nowrap'}}>Read response</span>
      </button>
      <button type="button" onClick={() => setHistoryOpen(v=>!v)}
        aria-expanded={historyOpen}
        style={{...badge('low'),color:'#a8bfbe',whiteSpace:'nowrap'}}>
        {matches.length} detected · {historyOpen?'Hide':'History'}
      </button>
      {historyOpen && <div style={{flex:'1 1 100%',display:'flex',flexDirection:'column',gap:5,borderTop:'1px solid rgba(154,198,188,.17)',paddingTop:9}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{color:'#93aaa8',fontSize:10}}>Most recent first · all priority levels</span>
          <button onClick={() => {onClear();setHistoryOpen(false);}}
            style={{background:'none',border:0,color:'#b6aca1',fontSize:10,cursor:'pointer'}}>Clear history</button>
        </div>
        {matches.map((m,i)=><button key={(m.detectedAt||i)+'-'+m.objectionId} type="button"
          onClick={() => onOpen(m)} style={{...badge(m.priority),color:'#dae7e0',display:'flex',gap:9,alignItems:'center'}}>
          <span style={{color:hue[m.priority]||hue.medium,fontSize:9,fontWeight:800,width:43,textTransform:'uppercase'}}>{m.priority||'medium'}</span>
          <span style={{flex:1,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{m.title}</span>
          <span style={{fontSize:10,color:'#96b5ae'}}>{m.detectedAt ? new Date(m.detectedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}) : ''}</span>
        </button>)}
      </div>}
    </section>
  );
}
