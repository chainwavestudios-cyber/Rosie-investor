import { useMemo, useState } from 'react';
import { Code2, ExternalLink, EyeOff, Fingerprint, KeyRound, LockKeyhole, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import cryptoSource from '@/lib/bobKnowledgeCrypto.js?raw';
import gatewaySource from '../../../base44/functions/bobSaas/entry.ts?raw';
import { BobNav, BobFooter } from './BobMarketing';
import './BobSite.css';

export default function BobSecurity(){
  const [section,setSection]=useState('client');
  const source=section==='client'?cryptoSource:gatewaySource;
  const [showCode,setShowCode]=useState(false);
  const gatewayExcerpt=useMemo(()=>{
    const start=gatewaySource.indexOf("  if(action==='knowledge')");
    const end=gatewaySource.indexOf("  if (action==='setDeepgramKey')",start);
    return start>=0&&end>start?gatewaySource.slice(start,end):gatewaySource.slice(0,5000);
  },[]);
  return <div className="bob-site"><BobNav/><main className="bob-wrap" style={{paddingTop:70,paddingBottom:95}}>
    <div style={{maxWidth:920}}>
      <div className="bob-eyebrow">Privacy design · Inspectable implementation</div>
      <h1 style={{fontSize:'clamp(35px,5vw,58px)',lineHeight:1.12,letterSpacing:'-.055em',margin:'15px 0 22px'}}>Your organization's knowledge.<br/><span style={{color:'#d7b978'}}>Your browser-held unlock key.</span></h1>
      <p style={{fontSize:17,color:'#a8bbc9',lineHeight:1.8}}>Commercial BOB encrypts company knowledge and saved conversation text on your device before it is stored. The cloud holds ciphertext; the passphrase and non-exportable browser key are not written to BOB storage. See the actual encryption module and relevant server-side access checks below.</p>
    </div>
    <div className="bob-feature-grid" style={{margin:'35px 0 42px'}}>
      {[{Icon:KeyRound,title:'Customer-selected passphrase',text:'A passphrase your team creates is used to derive the cryptographic key in your browser. It is never submitted to the BOB API.'},
      {Icon:LockKeyhole,title:'AES-256-GCM before upload',text:'Knowledge files, session transcripts, notes, and coaching reports are encrypted before the browser sends them to persistent storage.'},
      {Icon:EyeOff,title:'No plaintext knowledge endpoint',text:'BOB’s tenant gateway only returns encrypted documents to current organization members. Platform operators are not granted customer knowledge access through that gateway.'}].map(({Icon,title,text})=><div className="bob-panel" key={title}><span className="bob-feature-icon"><Icon size={24}/></span><h3>{title}</h3><p>{text}</p></div>)}
    </div>
    <div className="bob-panel" style={{borderColor:'#d4b77760',marginBottom:30}}>
      <div className="bob-panel-title"><h3 style={{display:'flex',alignItems:'center',gap:9}}><ShieldAlert color="#edc77a" size={20}/> Important limits of this privacy model</h3></div>
      <p>**This is not an independently audited, operator-proof zero-knowledge product.** The website operator controls which JavaScript gets delivered to your browser and could change future code. Your administrator must share the passphrase with authorized trainees for them to unlock company knowledge. People with the passphrase can read it. A compromised device or weak passphrase can defeat the protections.</p>
      <p>During a live training conversation, the browser sends selected decrypted training content to Deepgram and the configured AI provider so the model can respond. For AI coaching review, decrypted transcript text is sent transiently for processing. Neither use is end-to-end encryption to the customer's device alone. BOB cannot guarantee external model providers never retain or process submitted content.</p>
      <p>A customer should not upload regulated or highly sensitive records until the provider agreements, retention settings, privacy review, and independent security tests have been completed.</p>
    </div>
    <section style={{marginTop:35}}>
      <span className="bob-eyebrow">Inspect the implementation</span><h2 style={{fontSize:32,letterSpacing:'-.04em'}}>Not just a security promise. Read the code.</h2>
      <p style={{color:'#a5b3c5'}}>These excerpts are bundled from the actual BOB source files used by the build. They demonstrate the design, but displaying code does not independently prove what a server executes or that future builds are unchanged.</p>
      <div className="bob-tabbar" style={{marginTop:20}}><button className={section==='client'?'active':''} onClick={()=>setSection('client')}><Fingerprint size={16}/> Browser encryption module</button><button className={section==='server'?'active':''} onClick={()=>setSection('server')}><ShieldCheck size={16}/> Private data gateway</button></div>
      <div className="bob-panel" style={{padding:0,overflow:'hidden'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 21px',borderBottom:'1px solid #ffffff20',gap:12,flexWrap:'wrap'}}><div><Code2 color="#d7b978" size={17} style={{display:'inline',marginRight:9}}/><strong style={{fontSize:13}}>{section==='client'?'src/lib/bobKnowledgeCrypto.js':'base44/functions/bobSaas/entry.ts'}</strong><span className="bob-tiny" style={{display:'block'}}>Real source from this BOB app build</span></div><button className="bob-btn bob-btn-ghost" onClick={()=>setShowCode(x=>!x)}>{showCode?'Show excerpt only':'Show full source'}</button></div><pre style={{maxHeight:560,overflow:'auto',margin:0,padding:22,whiteSpace:'pre',fontSize:11,color:'#bed3df',lineHeight:1.65}}><code>{section==='client'?(showCode?source:source.slice(0,4500)):(showCode?source:gatewayExcerpt)}</code></pre></div>
      <p className="bob-tiny" style={{marginTop:16}}>Cryptographic API: Web Crypto PBKDF2 (310,000 SHA-256 iterations) with a per-organization salt, non-extractable AES-256-GCM key, random 96-bit per-record IV and organization-bound additional authenticated data. The browser key is deliberately not stored in localStorage.</p>
    </section>
    <div className="bob-strip-inner" style={{marginTop:45,padding:'25px 0'}}><div><h2>Want an external review?</h2><p>Ask for the security architecture, boundaries, and planned third-party audit.</p></div><Link className="bob-btn bob-btn-gold" to="/bob/inquire">Talk to BOB security & sales <ExternalLink size={14}/></Link></div>
  </main><BobFooter/></div>;
}
