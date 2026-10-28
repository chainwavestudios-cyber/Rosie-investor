import { useEffect, useRef, useState } from 'react';
import { BookLock, FileUp, KeyRound, Lock, LockKeyhole, ShieldCheck, Trash2, Unlock } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth/mammoth.browser';
import { decryptCustomerContent, encryptCustomerContent, unlockOrganizationKey, createKeyVerifier, verifyOrganizationKey } from '@/lib/bobKnowledgeCrypto';
import './BobSite.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export async function textFromFile(file){
  if(file.size>12*1024*1024)throw new Error('Documents must be under 12MB.');
  const name=file.name.toLowerCase();
  if(/\.(txt|csv|md)$/i.test(name))return file.text();
  if(name.endsWith('.docx')){
    const value=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
    return value.value||'';
  }
  if(name.endsWith('.pdf')){
    const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())});
    const pdf=await task.promise;
    if(pdf.numPages>75)throw new Error('PDF exceeds 75 pages. Split it before importing.');
    const result=[];
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i),content=await page.getTextContent();
      result.push(content.items.map(item=>item.str||'').join(' '));
    }
    return result.join('\n\n');
  }
  throw new Error('Supported formats: PDF, DOCX, TXT, Markdown and CSV.');
}
export function BobVaultLock({ org, isAdmin, vaultKey, setVaultKey, api, onInitialized, compact=false }) {
  const [pass,setPass]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const initialized=!!org?.keyVerifier;
  const unlock=async(e)=>{
    e.preventDefault();setError('');setBusy(true);
    try {
      if(!org?.knowledgeSalt){
        if(!isAdmin)throw new Error('Your organization administrator must initialize private storage first.');
        await api('ensureEncryptionSalt',{organizationId:org.id});
        await onInitialized?.();
        throw new Error('Vault salt generated. Please submit the passphrase once more to initialize.');
      }
      if(!initialized && !isAdmin)throw new Error('An organization administrator must initialize the knowledge vault.');
      if(!initialized && pass!==confirm)throw new Error('The passphrase confirmation does not match.');
      const key=await unlockOrganizationKey(pass,org.knowledgeSalt);
      if(initialized)await verifyOrganizationKey(key,org.keyVerifier,org.id);
      else{
        const verifier=await createKeyVerifier(key,org.id);
        await api('initializeEncryption',{organizationId:org.id,verifier});
        await onInitialized?.();
      }
      setVaultKey(key);setPass('');setConfirm('');
    }catch(e){setError(e.message||'Cannot unlock encrypted knowledge.');}
    finally{setBusy(false);}
  };
  return <section className="bob-panel" style={compact?{marginBottom:18}:undefined}>
    <div className="bob-panel-title"><h3 style={{display:'flex',alignItems:'center',gap:9}}>{vaultKey?<Unlock size={18} color="#84d1ae"/>:<LockKeyhole size={18} color="#d7b978"/>} Customer-owned knowledge vault</h3><span className="bob-pill">{vaultKey?'Unlocked for this tab':initialized?'Locked · encrypted':'Not initialized'}</span></div>
    <p className="bob-tiny">The browser derives a non-exportable encryption key from your organization passphrase. Our database stores encrypted bytes, not your readable documents. BOB cannot recover a lost passphrase. Your team must share it through a trusted channel.</p>
    {vaultKey?<button className="bob-btn bob-btn-ghost" onClick={()=>setVaultKey(null)}><Lock size={15}/> Lock this workspace</button>:
    <form onSubmit={unlock}><div className="bob-field"><label>{initialized?'Organization unlock passphrase':'Choose a strong organization passphrase (never sent to BOB)'}</label><input type="password" autoComplete="off" minLength={14} required value={pass} onChange={e=>setPass(e.target.value)} placeholder="At least 14 characters"/></div>{!initialized&&isAdmin&&<div className="bob-field"><label>Confirm the passphrase</label><input type="password" autoComplete="off" minLength={14} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></div>}{error&&<p className="bob-message error">{error}</p>}<button disabled={busy||(!initialized&&!isAdmin)} className="bob-btn bob-btn-gold" type="submit"><KeyRound size={15}/>{busy?'Deriving key…':initialized?'Unlock private knowledge':'Initialize encrypted vault'}</button></form>}
    <p className="bob-tiny" style={{marginTop:14}}>Privacy limitation: live AI simulations send selected decrypted training material to the voice/AI provider. The application operator also controls future website updates. This is encryption at rest with client-controlled keys, not audited zero-knowledge hosting.</p>
  </section>;
}

export default function BobVault({org,isAdmin,documents,vaultKey,api,refresh,busy,act}){
  const [newDoc,setNewDoc]=useState({title:'',content:'',category:'Sales playbook'});
  const [decoded,setDecoded]=useState([]),[scan,setScan]=useState(false),[err,setErr]=useState('');
  const input=useRef(null);
  useEffect(()=>{
    let live=true;
    (async()=>{
      if(!vaultKey){setDecoded([]);return;}
      const output=await Promise.all(documents.map(async d=>{
        try{const data=await decryptCustomerContent(vaultKey,d.encryptedPayload,org.id);return{id:d.id,...data};}
        catch{return{id:d.id,title:'Encrypted entry — could not decrypt',content:'',category:'Locked'};}
      }));
      if(live)setDecoded(output);
    })().catch(e=>{if(live)setErr(e.message)});
    return()=>{live=false};
  },[documents,vaultKey,org.id]);
  const submit=async(e)=>{
    e.preventDefault();if(!vaultKey)return;
    await act(async()=>{
      const encryptedPayload=await encryptCustomerContent(vaultKey,newDoc,org.id);
      await api('addKnowledge',{organizationId:org.id,encryptedPayload});
      setNewDoc({title:'',content:'',category:'Sales playbook'});
    },'Encrypted knowledge saved. Only team members with the passphrase can decrypt it.');
  };
  const scanFile=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    setScan(true);setErr('');
    try{
      const content=await textFromFile(file);
      if(content.trim().length<20)throw new Error('No selectable text was found. Scanned image PDFs need local OCR before import.');
      setNewDoc(s=>({...s,title:file.name,content:content.slice(0,24000)}));
      if(content.length>24000)setErr('Only the first 24,000 characters were imported. Split this document to include the rest.');
    }catch(ex){setErr(ex.message);}
    finally{setScan(false);e.target.value='';}
  };
  if(!vaultKey)return <div className="bob-empty"><div><BookLock size={30} style={{margin:'0 auto 15px',color:'#d7b978'}}/>Unlock the customer-owned vault above to view or upload training knowledge.</div></div>;
  return <div className="bob-grid-2"><form className="bob-panel" onSubmit={submit}><div className="bob-panel-title"><h3>Add encrypted training material</h3><ShieldCheck size={17} color="#d7b978"/></div><div className="bob-field"><label>Document title</label><input required maxLength={150} value={newDoc.title} onChange={e=>setNewDoc(s=>({...s,title:e.target.value}))}/></div><div className="bob-field"><label>Category</label><select value={newDoc.category} onChange={e=>setNewDoc(s=>({...s,category:e.target.value}))}>{['Sales playbook','Objection handling','Product information','Policies & compliance','Call scripts','FAQ','Other'].map(c=><option key={c}>{c}</option>)}</select></div><div className="bob-field"><label>Training content · locally encrypted before upload</label><textarea style={{minHeight:210}} minLength={10} required maxLength={24000} value={newDoc.content} onChange={e=>setNewDoc(s=>({...s,content:e.target.value}))}/></div><input ref={input} type="file" accept=".pdf,.docx,.txt,.md,.csv" hidden onChange={scanFile}/><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button type="button" className="bob-btn bob-btn-ghost" onClick={()=>input.current?.click()} disabled={scan}><FileUp size={15}/>{scan?'Scanning in browser…':'Import PDF / DOCX / TXT'}</button><button className="bob-btn bob-btn-gold" disabled={busy}><Lock size={15}/> Encrypt & save</button></div>{err&&<p className="bob-message error">{err}</p>}<p className="bob-tiny">PDF and DOCX text extraction happens in your browser. The original document is never uploaded. Image-only PDFs require OCR outside BOB.</p></form><div className="bob-panel"><div className="bob-panel-title"><h3>Decrypted library · {decoded.length} entries</h3></div>{decoded.length===0?<div className="bob-empty">No private knowledge added yet.</div>:<div className="bob-stack">{decoded.map(d=><article key={d.id} style={{borderBottom:'1px solid #ffffff19',paddingBottom:15}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:9}}><div><div style={{fontWeight:700,fontSize:14}}>{d.title}</div><span className="bob-tiny">{d.category}</span></div><button disabled={busy} className="bob-btn bob-btn-danger" aria-label={'Remove '+d.title} onClick={()=>{if(window.confirm('Delete this encrypted document?'))act(()=>api('deleteKnowledge',{organizationId:org.id,documentId:d.id}),'Document removed.')}}><Trash2 size={14}/></button></div><p style={{maxHeight:140,overflow:'auto',whiteSpace:'pre-wrap'}}>{d.content}</p></article>)}</div>}</div></div>;
}
