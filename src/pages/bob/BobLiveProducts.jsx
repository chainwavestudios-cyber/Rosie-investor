import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Headphones, MessagesSquare, ShieldCheck } from 'lucide-react';
import { BobNav, BobFooter } from './BobMarketing';
import './BobSite.css';

export default function BobLiveProducts(){
 return <div className="bob-site"><BobNav/><main>
   <section className="bob-wrap" style={{paddingTop:85,paddingBottom:55}}>
     <div style={{maxWidth:920}}><div className="bob-eyebrow">More than training · Rosie AI</div>
       <h1 style={{fontSize:'clamp(43px,6vw,69px)',lineHeight:1.05,letterSpacing:'-.06em',margin:'20px 0 25px'}}>
        Train with BOB.<br/><span style={{color:'#d7b978'}}>Support your agents live.</span>
       </h1>
       <p style={{fontSize:18,lineHeight:1.75,color:'#aebdcb',maxWidth:800}}>BOB (Bot Operated Buyer) helps teams rehearse real sales conversations. Two additional products—Live Q&A and Live Coach—are being developed for implementation directly within call centers.</p>
       <div style={{display:'flex',gap:12,marginTop:27,flexWrap:'wrap'}}><Link className="bob-btn bob-btn-gold" to="/bob/inquire">Ask about these products <ArrowRight size={16}/></Link><Link className="bob-btn bob-btn-ghost" to="/bob">Explore BOB training</Link></div>
     </div>
   </section>
   <section className="bob-wrap" style={{paddingBottom:82}}><div className="bob-grid-2" style={{gap:22}}>
     <article className="bob-panel" style={{padding:35}}><div className="bob-feature-icon"><MessagesSquare size={24}/></div>
       <div className="bob-eyebrow" style={{marginTop:24}}>Product 02 · In development</div><h2 style={{fontSize:36,lineHeight:1.12,letterSpacing:'-.045em'}}>Live Q&A</h2>
       <p style={{fontSize:15}}>An on-call AI answer assistant designed to help human call-center agents respond to customers while the conversation is happening.</p>
       <p style={{fontSize:14}}>Each subscribing organization will have its own dedicated knowledge base, separate from other companies and from its BOB training knowledge.</p>
     </article>
     <article className="bob-panel" style={{padding:35}}><div className="bob-feature-icon"><Headphones size={24}/></div>
       <div className="bob-eyebrow" style={{marginTop:24}}>Product 03 · In development</div><h2 style={{fontSize:36,lineHeight:1.12,letterSpacing:'-.045em'}}>Live Coach</h2>
       <p style={{fontSize:15}}>Real-time guidance for live human call-center agents, designed to support stronger conversations and better coaching in the moment.</p>
       <p style={{fontSize:14}}>Live Coach will also use organization-specific knowledge and configuration rather than a shared public training brain.</p>
     </article>
   </div></section>
   <section className="bob-strip"><div className="bob-wrap bob-strip-inner"><div><div className="bob-eyebrow">One product today · More capabilities ahead</div><h2>Start with BOB. Grow when you're ready.</h2><p>Register your interest in either future product during BOB signup or through our sales team.</p></div><Link to="/bob/signup" className="bob-btn bob-btn-gold">Explore a training workspace <ArrowRight size={15}/></Link></div></section>
   <section className="bob-wrap" style={{paddingTop:45,paddingBottom:55}}><div className="bob-panel" style={{display:'flex',gap:20,alignItems:'flex-start'}}>
     <ShieldCheck size={27} color="#d7b978" style={{flexShrink:0}}/><div><h3 style={{marginTop:0}}>Your organization's information stays separate.</h3>
     <p>Our commercial design keeps each organization's training knowledge and future live-product knowledge in separate data collections with tenant-scoped access. Commercial AI processing and security certification remain subject to testing and vendor arrangements.</p>
     <Link to="/bob/security" style={{fontSize:13,color:'#d7b978'}}>Read BOB's encryption design and limitations</Link></div>
   </div></section>
 </main><BobFooter/></div>;
}
