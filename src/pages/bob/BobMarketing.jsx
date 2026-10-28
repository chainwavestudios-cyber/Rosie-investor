import { Link } from 'react-router-dom';
import { ArrowRight, Headphones, GraduationCap, Users, ShieldCheck, AudioLines, ChartNoAxesCombined, BookOpen, CheckCircle2, Play, Layers3, GitBranch, PhoneForwarded, Mic2, UserRoundCog, FileText, LockKeyhole, MessagesSquare, CalendarClock } from 'lucide-react';
import './BobSite.css';

export function BobBrand() {
  return <Link className="bob-brand" to="/bob"><span className="bob-brand-mark">B</span><span>BOB <small>TRAINING INTELLIGENCE</small></span></Link>;
}
export function BobNav() {
  return <nav className="bob-nav"><BobBrand/><div className="bob-nav-links"><Link to="/bob#features">BOB platform</Link><Link to="/bob/live-products">Live products</Link><Link to="/bob/security">Security</Link><Link to="/bob/inquire">Sales</Link><Link className="bob-btn bob-btn-ghost" to="/bob/login">Training portal</Link></div></nav>;
}
export function BobFooter() {
  return <footer className="bob-footer"><div className="bob-wrap bob-footer-inner"><span>© {new Date().getFullYear()} BOB Training Intelligence · Powered by Rosie AI</span><span><Link to="/bob/security" style={{color:"#d7b978"}}>Security design & source code</Link> · Train with intelligence. Sell with confidence.</span></div></footer>;
}
const features=[
  {Icon:Headphones,title:'Realistic AI buyer conversations',description:'Train through conversational voice with natural questions, objections, customizable personas and adjustable difficulty.'},
  {Icon:GitBranch,title:'The entire sales call journey',description:'Design the whole workflow, from incoming queue and reception handoff to discovery, objections, closing and a follow-up.'},
  {Icon:PhoneForwarded,title:'Multi-agent handoff simulations',description:'Practice moving from a receptionist or transfer specialist to a simulated closer with voice and role changes.'},
  {Icon:FileText,title:'Private script and workflow studio',description:'Build structured scripts, insert contact-field variables, define role-play actions, and rehearse your company’s process.'},
  {Icon:CalendarClock,title:'Callbacks that remember the context',description:'Carry fictional prospect history forward into a second simulated conversation and continue where practice left off.'},
  {Icon:BookOpen,title:'Your organization's own training brain',description:'Give BOB company-specific policies, approved responses, procedures and product knowledge—without sharing another tenant’s library.'},
  {Icon:Users,title:'Licensed seats and delegated roles',description:'Assign trainees, managers and admins. Organization administrators decide who can change the training environment.'},
  {Icon:Mic2,title:'Consent-aware manager coaching',description:'Monitor training progress and opt-in microphone sessions, and review permitted encrypted practice recordings.'},
  {Icon:ChartNoAxesCombined,title:'Transcript reviews and coaching',description:'Evaluate simulated sessions with an AI coaching scorecard and identify opportunities for improved conversations.'},
  {Icon:ShieldCheck,title:'Customer-held encryption keys',description:'Company knowledge and saved sessions use browser-side encryption. Review our security implementation and its documented limitations.'},
  {Icon:Layers3,title:'Synthetic training actions',description:'Practice mock credit checks, scripted transfers, fictional follow-ups, field collection, and other simulated workflow steps.'},
  {Icon:LockKeyhole,title:'Private organizations, not a shared script bank',description:'Give each training customer its own organization workspace, seat allocation, knowledge, transcripts and scripts.'},
];
const journey=[
  {number:'01',label:'The call arrives',detail:'Choose an incoming queue, a receptionist or transfer agent, or an outbound prospecting scenario.'},
  {number:'02',label:'The agent handles discovery',detail:'An AI buyer responds naturally while the trainee follows your approved script and required steps.'},
  {number:'03',label:'Your company’s actions happen',detail:'Rehearse a mock credit check, a field update, an objection, or a handoff to an AI closer.'},
  {number:'04',label:'The conversation continues',detail:'Complete the close or schedule a simulated callback with access to prior training context.'},
  {number:'05',label:'Managers review progress',detail:'Inspect encrypted training history, coaching observations and consented recordings using your customer-held key.'},
];
export default function BobMarketing(){
  return <div className="bob-site"><BobNav/><main>
    <div className="bob-wrap"><section className="bob-hero">
      <div><span className="bob-eyebrow">The next generation of sales training</span><h1>Meet BOB.<br/><em>Your toughest customer.</em><br/>Your best training partner.</h1>
      <p>Real conversations, realistic objections, and an entire simulated sales process. Build your organization’s own call journeys, AI buyer behaviors, transfers, scripts and coaching workflows—before your people ever speak to a real customer.</p>
      <div className="bob-hero-actions"><Link className="bob-btn bob-btn-gold" to="/bob/signup">Start your training workspace <ArrowRight size={16}/></Link><Link className="bob-btn bob-btn-ghost" to="/bob/inquire">Request a team demo</Link></div>
      <div className="bob-hero-proof"><span><CheckCircle2 size={15}/> Scenario-driven practice</span><span><CheckCircle2 size={15}/> Flexible team seats</span><span><CheckCircle2 size={15}/> Your company's knowledge</span></div></div>
      <div className="bob-video" aria-label="Marketing video placeholder"><span className="bob-video-label">BOB · PRODUCT FILM</span><div className="bob-video-content"><div className="bob-video-play"><Play size={40} fill="currentColor"/></div><strong>The future of training starts here.</strong><span>Product video coming soon</span><span className="bob-eyebrow">Video premiere placeholder</span></div></div>
    </section></div>
    <div className="bob-wrap" id="features"><section className="bob-section"><span className="bob-eyebrow">Built for complete simulated sales operations</span><h2>More than a role-play bot. An entire practice call center.</h2><div className="bob-feature-grid">{features.map(({Icon,title,description})=><article key={title} className="bob-panel"><span className="bob-feature-icon"><Icon size={23}/></span><h3>{title}</h3><p>{description}</p></article>)}</div></section></div>
    <section className="bob-wrap bob-section" style={{paddingTop:30}}>
       <span className="bob-eyebrow">One configurable journey. Multiple AI roles.</span>
       <h2 style={{fontSize:'clamp(29px,4vw,42px)',letterSpacing:'-.045em',margin:'12px 0 26px'}}>From first ring to the final follow-up.</h2>
       <div className="bob-stack" style={{gap:0}}>
        {journey.map(item=><div key={item.number} style={{display:'grid',gridTemplateColumns:'66px minmax(0,1fr)',gap:15,padding:'18px 12px',borderBottom:'1px solid #ffffff20'}}>
          <div style={{fontWeight:850,color:'#d7b978',fontSize:18}}>{item.number}</div>
          <div><strong style={{fontSize:17}}>{item.label}</strong><p className="bob-tiny" style={{fontSize:13,maxWidth:760,margin:'6px 0 0'}}>{item.detail}</p></div>
        </div>)}
       </div>
       <p className="bob-tiny" style={{marginTop:18}}>All customer data, credits, transfers, emails and texts inside a BOB simulation are fictional unless a separate, explicitly authorized live system integration is developed.</p>
    </section>
    <section className="bob-wrap" style={{paddingTop:26,paddingBottom:68}}>
      <div className="bob-panel" style={{padding:'32px 34px',borderColor:'#d7b97845'}}>
        <div className="bob-eyebrow">Extend beyond training · Separate products</div>
        <h2 style={{fontSize:'clamp(29px,4vw,40px)',letterSpacing:'-.045em',margin:'14px 0'}}>Meet Live Q&A and Live Coach.</h2>
        <p style={{maxWidth:750}}>Beyond BOB's simulated training environment, Live Q&A and Live Coach are being developed as separate products for use directly inside customer call centers. Each will have an organization-specific knowledge base distinct from the BOB training library.</p>
        <p className="bob-tiny">During signup, customers can express interest in either product. They are not yet included in BOB subscriptions.</p>
        <div style={{display:'flex',gap:11,flexWrap:'wrap',marginTop:21}}>
          <Link to="/bob/live-products" className="bob-btn bob-btn-gold"><MessagesSquare size={16}/> Explore the two live products</Link>
          <Link to="/bob/signup" className="bob-btn bob-btn-ghost">Start with BOB <ArrowRight size={16}/></Link>
        </div>
      </div>
    </section>
    <section className="bob-strip"><div className="bob-wrap bob-strip-inner"><div><span className="bob-eyebrow">Ready to put your team in the training room?</span><h2>One platform. Your playbook. Your people.</h2><p>Start with a small team or ask us about a larger organization rollout.</p></div><Link to="/bob/inquire" className="bob-btn bob-btn-gold">Let's talk about seats <ArrowRight size={16}/></Link></div></section>
    <div className="bob-wrap"><section className="bob-section" style={{textAlign:'center',maxWidth:800,margin:'0 auto'}}><GraduationCap color="#d7b978" size={31}/><h2>Give every agent the opportunity to practice a complete sales process.</h2><p style={{color:'#a5b3c5',fontSize:16,lineHeight:1.8}}>BOB gives every trainee a place to rehearse objections, sharpen their delivery, and build confidence on their own schedule.</p><div style={{display:'flex',justifyContent:'center',gap:12,marginTop:25,flexWrap:'wrap'}}><Link to="/bob/signup" className="bob-btn bob-btn-gold">Create your workspace</Link><Link to="/bob/login" className="bob-btn bob-btn-ghost"><AudioLines size={15}/> Enter training portal</Link></div></section></div>
  </main><BobFooter/></div>
}
