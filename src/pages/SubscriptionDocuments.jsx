import React from 'react';

const AGREEMENT_URL = 'https://media.base44.com/files/public/69cd2741578c9b5ce655395b/4799d48ad_SubscriptionAgreement1pdf2pdfpdf1.pdf';

export default function SubscriptionDocuments() {
  return (
    <main style={{minHeight:'100vh',background:'#08090b',color:'#f7edda',fontFamily:'Inter,system-ui,sans-serif',padding:'48px 20px'}}>
      <div style={{maxWidth:960,margin:'0 auto'}}>
        <a href="/" style={{color:'#c9a76b',textDecoration:'none',fontSize:14}}>ROSIE AI · INVESTOR RELATIONS</a>
        <div style={{height:1,background:'linear-gradient(90deg,#b89456,transparent)',margin:'28px 0 38px'}}/>
        <div style={{fontSize:12,letterSpacing:3,color:'#c9a76b',textTransform:'uppercase',marginBottom:16}}>Investor documents</div>
        <h1 style={{fontFamily:'Georgia,serif',fontWeight:400,fontSize:'clamp(36px,6vw,60px)',lineHeight:1.08,margin:'0 0 16px'}}>Subscription Agreement</h1>
        <p style={{fontSize:17,lineHeight:1.7,color:'#d4c8b4'}}>Review or download the Rosie AI LLC Subscription Agreement. This is the existing seven-page agreement referenced in the Rosie AI investor portal.</p>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'24px 0 28px'}}>
          <a href={AGREEMENT_URL} target="_blank" rel="noopener noreferrer" style={{display:'inline-block',padding:'13px 22px',background:'#c6a268',borderRadius:7,color:'#17120b',fontWeight:700,textDecoration:'none'}}>View Agreement PDF</a>
          <a href={AGREEMENT_URL} download="Rosie_AI_Subscription_Agreement.pdf" target="_blank" rel="noopener noreferrer" style={{display:'inline-block',padding:'12px 22px',border:'1px solid #a98b59',borderRadius:7,color:'#ecd5aa',fontWeight:600,textDecoration:'none'}}>Download PDF</a>
        </div>
        <div style={{background:'#fff',borderRadius:8,overflow:'hidden',minHeight:560}}>
          <iframe src={AGREEMENT_URL} title="Rosie AI Subscription Agreement PDF" style={{width:'100%',height:'min(75vh,900px)',minHeight:560,border:0}} />
        </div>
        <p style={{fontSize:13,color:'#9d9486',marginTop:28,lineHeight:1.7}}>Reviewing or downloading this document does not constitute signing or submitting a subscription. Investors should use the authorized investor portal to complete required documentation.</p>
      </div>
    </main>
  );
}
