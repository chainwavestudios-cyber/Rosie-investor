import React from 'react';
import slides from '../data/pitchDeck.json';

const GOLD='#d3ae6d';
const styles={
  page:{minHeight:'100vh',background:'#07090d',color:'#f6f0e6',fontFamily:'Inter,system-ui,sans-serif'},
  nav:{maxWidth:1140,margin:'auto',padding:'22px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:18,flexWrap:'wrap'},
  action:{display:'inline-block',color:'#0d0d0d',background:GOLD,borderRadius:8,padding:'11px 18px',textDecoration:'none',fontWeight:700,fontSize:14},
  slide:{position:'relative',minHeight:490,aspectRatio:'16 / 9',border:'1px solid rgba(211,174,109,.28)',borderRadius:12,overflow:'hidden',padding:'clamp(25px,5vw,62px)',background:'radial-gradient(circle at 95% 10%,rgba(192,140,59,.15),transparent 35%),linear-gradient(130deg,#14161e,#090b10 72%)',boxSizing:'border-box',display:'flex',flexDirection:'column',justifyContent:'center'},
};
function Slide({s,i}) {
  return <section style={styles.slide} className="pitch-slide" aria-label={s.title.replace(/\n/g,' ')}>
    <div style={{position:'absolute',top:0,left:0,width:130,height:4,background:GOLD}}/>
    <div style={{fontSize:12,letterSpacing:2.8,color:GOLD,fontWeight:700,marginBottom:24}}>{s.kicker}</div>
    <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,fontSize:'clamp(30px,4.7vw,62px)',lineHeight:1.09,whiteSpace:'pre-line',margin:'0 0 24px',maxWidth:920}}>{s.title}</h2>
    <p style={{fontSize:'clamp(15px,1.6vw,20px)',color:'#c8c5c1',lineHeight:1.6,maxWidth:860,margin:'0 0 22px'}}>{s.subtitle}</p>
    {s.items&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:13,marginTop:15}}>
      {s.items.map((item,j)=><div key={j} style={{borderLeft:'2px solid '+GOLD,padding:'12px 14px',background:'rgba(255,255,255,.035)',fontSize:15,lineHeight:1.5}}>{item}</div>)}
    </div>}
    <div style={{fontSize:11,letterSpacing:1.2,color:'#92836d',marginTop:'auto',paddingTop:22}}>ROSIE AI  /  INVESTOR OVERVIEW <span style={{float:'right'}}>{String(i+1).padStart(2,'0')} / {slides.length}</span></div>
  </section>
}
export default function SubscriptionDocuments(){
  return <main style={styles.page}>
    <style>{'@media print { .pitch-nav,.pitch-intro{display:none!important} .pitch-wrap{max-width:none!important;padding:0!important} .pitch-slide{break-after:page;page-break-after:always;border-radius:0!important;min-height:0!important;width:100vw;height:56.25vw;padding:5vw!important} @page{size:landscape;margin:0} } @media(max-width:600px){.pitch-slide{aspect-ratio:auto!important;min-height:540px!important}.pitch-slide h2{font-size:32px!important}}'}</style>
    <nav style={styles.nav} className="pitch-nav"><a href="/" style={{color:GOLD,textDecoration:'none',letterSpacing:2,fontWeight:700}}>ROSIE AI · INVESTOR RELATIONS</a>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <a href="/Rosie_AI_Investor_Pitch_Deck.pdf" target="_blank" rel="noopener noreferrer" style={styles.action}>View PDF</a>
        <a href="/Rosie_AI_Investor_Pitch_Deck.pdf" download style={{...styles.action,background:'transparent',color:GOLD,border:'1px solid '+GOLD}}>Download Deck</a>
      </div>
    </nav>
    <header className="pitch-intro" style={{maxWidth:1140,margin:'20px auto 26px',padding:'0 20px'}}>
      <div style={{fontSize:12,color:GOLD,letterSpacing:2.5,fontWeight:700}}>INVESTOR PRESENTATION · NOVEMBER 2026</div>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:36,fontWeight:400,margin:'12px 0'}}>Rosie AI Pitch Deck</h1>
      <p style={{color:'#bdb6ac',lineHeight:1.6,margin:0}}>An overview of Rosie AI's technology vision, portfolio, business model and execution priorities.</p>
    </header>
    <div style={{maxWidth:1140,margin:'auto',padding:'0 20px 50px',display:'grid',gap:20}} className="pitch-wrap">
      {slides.map((s,i)=><Slide key={i} s={s} i={i}/>)}
      <p className="pitch-intro" style={{color:'#948e86',fontSize:12,lineHeight:1.6}}>This presentation is informational only. It is not an offer to sell or a solicitation to buy securities. Product availability and future milestones are subject to change; consult authorized offering documents for applicable terms, risk factors and eligibility.</p>
    </div>
  </main>;
}
