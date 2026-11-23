import React from 'react';

export default function SubscriptionDocuments() {
  return (
    <main style={{minHeight:'100vh',background:'#08090b',color:'#f7edda',fontFamily:'Inter,system-ui,sans-serif',padding:'54px 20px'}}>
      <div style={{maxWidth:760,margin:'0 auto'}}>
        <a href="/" style={{color:'#c9a76b',textDecoration:'none',fontSize:14}}>ROSIE AI · INVESTOR RELATIONS</a>
        <div style={{height:1,background:'linear-gradient(90deg,#b89456,transparent)',margin:'30px 0 48px'}}/>
        <div style={{fontSize:12,letterSpacing:3,color:'#c9a76b',textTransform:'uppercase',marginBottom:16}}>Investor documents</div>
        <h1 style={{fontFamily:'Georgia,serif',fontWeight:400,fontSize:'clamp(36px,6vw,60px)',lineHeight:1.08,margin:'0 0 22px'}}>Subscription Agreement</h1>
        <p style={{fontSize:18,lineHeight:1.7,color:'#d4c8b4'}}>The Rosie AI investor subscription agreement is not yet available for public download on this page.</p>
        <div style={{border:'1px solid #4c4232',borderRadius:12,padding:24,marginTop:30,background:'#151411'}}>
          <strong style={{color:'#e7cb94'}}>Document publication pending</strong>
          <p style={{color:'#c9c1b5',lineHeight:1.65,marginBottom:0}}>An approved, investor-facing agreement must be added before this page can provide the official document. No investment or signature is accepted on this page.</p>
        </div>
        <p style={{fontSize:13,color:'#9d9486',marginTop:40,lineHeight:1.7}}>For information only. This page is not an offer to sell securities or a solicitation to buy securities.</p>
      </div>
    </main>
  );
}
