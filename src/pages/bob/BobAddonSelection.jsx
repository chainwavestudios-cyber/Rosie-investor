import { Headphones, MessagesSquare, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export const BOB_ADDON_OPTIONS=[
 {id:'live_qa',name:'Live Q&A',Icon:MessagesSquare,
  subtitle:'Real-time answers for live agents',
  description:'A separate product for call centers, with a knowledge base dedicated to your organization.'},
 {id:'live_coach',name:'Live Coach',Icon:Headphones,
  subtitle:'Real-time guidance during active calls',
  description:'A separate product for call centers, configured around your organization and its own knowledge.'},
];
export function BobAddonSelection({value=[],onChange,disabled=false,compact=false}){
 const selected=Array.isArray(value)?value:[];
 return <div className="bob-stack" style={{gap:12}}>
   <div className="bob-panel-title" style={{marginBottom:0}}><h3>Optional future call-center products</h3><Link to="/bob/live-products" style={{fontSize:12,color:'#d7b978'}}>Learn about Live Q&A & Live Coach</Link></div>
   <p className="bob-tiny" style={{marginTop:0}}>These are separate commercial products under development, not features activated by a BOB subscription. Select any that interest you so our team can discuss future implementation. Each product will use a knowledge base dedicated to your organization.</p>
   <div className={compact?'bob-addon-choice-grid':'bob-feature-grid'} style={{gap:12}}>
     {BOB_ADDON_OPTIONS.map(({id,name,Icon,subtitle,description})=><label key={id} className="bob-panel" style={{
       display:'flex',alignItems:'flex-start',gap:12,padding:17,cursor:disabled?'default':'pointer',
       borderColor:selected.includes(id)?'#d7b97899':'rgba(173,196,208,.17)',background:selected.includes(id)?'#21313d':'#101d2d'
     }}>
       <input type="checkbox" style={{marginTop:7,accentColor:'#d7b978'}} disabled={disabled} checked={selected.includes(id)}
         onChange={e=>onChange(e.target.checked?[...selected,id]:selected.filter(a=>a!==id))}/>
       <div style={{minWidth:0}}><div style={{display:'flex',gap:9,alignItems:'center',marginBottom:7}}>
         <Icon size={18} color="#d7b978"/><strong style={{fontSize:14}}>{name}</strong></div>
         <div style={{color:'#e9d3aa',fontSize:12,marginBottom:5}}>{subtitle}</div><p className="bob-tiny" style={{margin:0}}>{description}</p></div>
     </label>)}
   </div>
   <div className="bob-tiny"><ShieldCheck size={13} style={{display:'inline',marginRight:5,color:'#d7b978'}}/>Indicating interest does not authorize access to your data, create a subscription, or enable live call monitoring.</div>
 </div>;
}
