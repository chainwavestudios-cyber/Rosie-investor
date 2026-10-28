import { Link } from 'react-router-dom';
import { ArrowRight, Headphones, GraduationCap, Users, ShieldCheck, AudioLines, ChartNoAxesCombined, BookOpen, CheckCircle2, Play, Layers3 } from 'lucide-react';
import './BobSite.css';

export function BobBrand() {
  return <Link className="bob-brand" to="/bob"><span className="bob-brand-mark">B</span><span>BOB <small>TRAINING INTELLIGENCE</small></span></Link>;
}
export function BobNav() {
  return <nav className="bob-nav"><BobBrand/><div className="bob-nav-links"><Link to="/bob#features">Platform</Link><Link to="/bob/security">Security & code</Link><Link to="/bob/inquire">Talk to sales</Link><Link className="bob-btn bob-btn-ghost" to="/bob/login">Training portal</Link></div></nav>;
}
export function BobFooter() {
  return <footer className="bob-footer"><div className="bob-wrap bob-footer-inner"><span>© {new Date().getFullYear()} BOB Training Intelligence · Powered by Rosie AI</span><span><Link to="/bob/security" style={{color:"#d7b978"}}>Security design & source code</Link> · Train with intelligence. Sell with confidence.</span></div></footer>;
}
const features=[
  {Icon:Headphones,title:'Voice-first simulations',description:'Train with a live AI customer using conversational voice, dynamic responses, and realistic call pacing.'},
  {Icon:Layers3,title:'Inbound & outbound calls',description:'Different opening contexts, prospects, objections, and difficulty levels for practical role-play.'},
  {Icon:BookOpen,title:'Your own training brain',description:'Each organization maintains its own playbook, policies, objection responses, and sales knowledge.'},
  {Icon:Users,title:'Team & seat controls',description:'Allocate trainee seats, appoint team administrators, and manage your training roster.'},
  {Icon:ChartNoAxesCombined,title:'Session intelligence',description:'Review training transcripts, activity and progress in a dedicated organization dashboard.'},
  {Icon:ShieldCheck,title:'Customer-held encryption keys',description:'Encrypted company knowledge and session data. Inspect our actual implementation and its security limits.'},
];
export default function BobMarketing(){
  return <div className="bob-site"><BobNav/><main>
    <div className="bob-wrap"><section className="bob-hero">
      <div><span className="bob-eyebrow">The next generation of sales training</span><h1>Meet BOB.<br/><em>Your toughest customer.</em><br/>Your best training partner.</h1>
      <p>Real conversations. Real objections. Better-prepared people. Give your sales team a voice-powered training environment where they can rehearse the moments that matter—before they're on a live call.</p>
      <div className="bob-hero-actions"><Link className="bob-btn bob-btn-gold" to="/bob/signup">Start your training workspace <ArrowRight size={16}/></Link><Link className="bob-btn bob-btn-ghost" to="/bob/inquire">Request a team demo</Link></div>
      <div className="bob-hero-proof"><span><CheckCircle2 size={15}/> Scenario-driven practice</span><span><CheckCircle2 size={15}/> Flexible team seats</span><span><CheckCircle2 size={15}/> Your company's knowledge</span></div></div>
      <div className="bob-video" aria-label="Marketing video placeholder"><span className="bob-video-label">BOB · PRODUCT FILM</span><div className="bob-video-content"><div className="bob-video-play"><Play size={40} fill="currentColor"/></div><strong>The future of training starts here.</strong><span>Product video coming soon</span><span className="bob-eyebrow">Video premiere placeholder</span></div></div>
    </section></div>
    <div className="bob-wrap" id="features"><section className="bob-section"><span className="bob-eyebrow">Built for teams that take training seriously</span><h2>Everything in one modern training environment.</h2><div className="bob-feature-grid">{features.map(({Icon,title,description})=><article key={title} className="bob-panel"><span className="bob-feature-icon"><Icon size={23}/></span><h3>{title}</h3><p>{description}</p></article>)}</div></section></div>
    <section className="bob-strip"><div className="bob-wrap bob-strip-inner"><div><span className="bob-eyebrow">Ready to put your team in the training room?</span><h2>One platform. Your playbook. Your people.</h2><p>Start with a small team or ask us about a larger organization rollout.</p></div><Link to="/bob/inquire" className="bob-btn bob-btn-gold">Let's talk about seats <ArrowRight size={16}/></Link></div></section>
    <div className="bob-wrap"><section className="bob-section" style={{textAlign:'center',maxWidth:800,margin:'0 auto'}}><GraduationCap color="#d7b978" size={31}/><h2>Practice shouldn't depend on a manager having free time.</h2><p style={{color:'#a5b3c5',fontSize:16,lineHeight:1.8}}>BOB gives every trainee a place to rehearse objections, sharpen their delivery, and build confidence on their own schedule.</p><div style={{display:'flex',justifyContent:'center',gap:12,marginTop:25,flexWrap:'wrap'}}><Link to="/bob/signup" className="bob-btn bob-btn-gold">Create your workspace</Link><Link to="/bob/login" className="bob-btn bob-btn-ghost"><AudioLines size={15}/> Enter training portal</Link></div></section></div>
  </main><BobFooter/></div>
}
